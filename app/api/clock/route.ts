import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { emitClockMarker } from "@/lib/markers";
import type { Room, RoomState } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";

/**
 * Commentator clock controls (FR-7.3/7.4). Clock transitions drive room
 * state; every action persists a clock_event then publishes one control
 * message — clients derive the running display locally (golden rule 6).
 * Auto segment markers attach here in Phase 8.
 */

const bodySchema = z.object({
  roomId: z.uuid(),
  action: z.enum(["start1h", "stop1h", "start2h", "stop2h", "start_et", "stop_et", "adjust"]),
  /** for adjust: ±1s steps from the bar (small bounds for safety) */
  offsetSeconds: z.number().int().min(-10).max(10).optional(),
});

/** action -> [legal from-state, resulting state] */
const TRANSITIONS: Record<
  string,
  { from: RoomState[]; to: RoomState | null }
> = {
  start1h: { from: ["pregame"], to: "live_1h" },
  stop1h: { from: ["live_1h"], to: "halftime" },
  start2h: { from: ["halftime"], to: "live_2h" },
  stop2h: { from: ["live_2h"], to: "postgame" },
  start_et: { from: ["postgame"], to: "extra_time" },
  stop_et: { from: ["extra_time"], to: "postgame" },
  adjust: { from: ["live_1h", "live_2h", "extra_time"], to: null },
};

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, action } = parsed.data;
  const offsetSeconds = action === "adjust" ? (parsed.data.offsetSeconds ?? 0) : 0;
  if (action === "adjust" && offsetSeconds === 0) {
    return NextResponse.json({ error: "Nothing to adjust." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle<Room>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (
    !(await isRoomHost(service, caller.userId, room.id)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json(
      { error: "Only the room's hosts can run the clock." },
      { status: 403 },
    );
  }

  const transition = TRANSITIONS[action];
  if (!transition.from.includes(room.state)) {
    return NextResponse.json(
      { error: `Can't ${action} from ${room.state}.` },
      { status: 409 },
    );
  }

  const serverTs = new Date().toISOString();

  // For a state transition, claim the from->to flip atomically (L-1, audit):
  // only one of two concurrent same-action requests wins, so we don't insert a
  // duplicate period event that nudges the derived clock backward. `adjust`
  // has no state change and is intentionally repeatable, so it skips the claim.
  if (transition.to) {
    const { data: claimed, error: stateErr } = await service
      .from("rooms")
      .update({ state: transition.to })
      .eq("id", room.id)
      .in("state", transition.from)
      .select("id")
      .maybeSingle();
    if (stateErr) {
      return NextResponse.json({ error: stateErr.message }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json(
        { error: `Can't ${action} from ${room.state}.` },
        { status: 409 },
      );
    }
  }

  const { error: insertErr } = await service.from("clock_events").insert({
    room_id: room.id,
    action,
    server_ts: serverTs,
    offset_seconds: offsetSeconds,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // clock transitions auto-emit segment markers (FR-13.3)
  await emitClockMarker(service, room.id, action, serverTs);

  // one message per transition — clients resync their derivation on it
  await publish(channels.control(room.id), "clock", {
    action,
    server_ts: serverTs,
    offset_seconds: offsetSeconds,
  });
  if (transition.to) {
    await publish(channels.control(room.id), "state", {
      state: transition.to,
      ts: serverTs,
    });
  }

  return NextResponse.json({
    ok: true,
    state: transition.to ?? room.state,
  });
}
