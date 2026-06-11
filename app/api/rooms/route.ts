import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { Room, RoomState } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";

/**
 * Room lifecycle (FR-3). Phase 4 transitions:
 *   open_waiting: (no room | scheduled) -> waiting   [commentator]
 *   start:        waiting -> pregame                 [room commentator]
 *   end:          pregame..postgame -> wrapped       [room commentator]
 * Clock-driven transitions (live_1h etc.) arrive with the clock in Phase 6.
 * Every transition persists first, then publishes a `state` event on the
 * control channel; clients unlock/lock without reload.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open_waiting"), fixtureId: z.number().int() }),
  z.object({ action: z.literal("start"), roomId: z.uuid() }),
  z.object({ action: z.literal("end"), roomId: z.uuid() }),
]);

const END_FROM: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

async function publishState(roomId: string, state: RoomState) {
  await publish(channels.control(roomId), "state", {
    state,
    ts: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const service = createServiceClient();

  if (body.action === "open_waiting") {
    if (
      caller.profile.role !== "commentator" &&
      !isAdmin(caller.userId, caller.profile)
    ) {
      return NextResponse.json(
        { error: "Only commentators can open a waiting room." },
        { status: 403 },
      );
    }

    const { data: fixture } = await service
      .from("fixtures")
      .select("id, kickoff_utc")
      .eq("id", body.fixtureId)
      .maybeSingle();
    if (!fixture) {
      return NextResponse.json({ error: "Fixture not found." }, { status: 404 });
    }

    const { data: existing } = await service
      .from("rooms")
      .select("*")
      .eq("fixture_id", body.fixtureId)
      .eq("commentator_id", caller.userId)
      .maybeSingle<Room>();

    if (existing && existing.state !== "scheduled") {
      // already open — just go there
      return NextResponse.json({ room: existing });
    }

    const now = new Date().toISOString();
    const { data: room, error } = existing
      ? await service
          .from("rooms")
          .update({ state: "waiting", opened_at: now })
          .eq("id", existing.id)
          .select()
          .single<Room>()
      : await service
          .from("rooms")
          .insert({
            fixture_id: body.fixtureId,
            commentator_id: caller.userId,
            state: "waiting",
            opened_at: now,
            scheduled_kickoff: fixture.kickoff_utc,
          })
          .select()
          .single<Room>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await publishState(room.id, "waiting");
    return NextResponse.json({ room }, { status: 201 });
  }

  // start / end act on an existing room owned by the caller
  const { data: room } = await service
    .from("rooms")
    .select("*")
    .eq("id", body.roomId)
    .maybeSingle<Room>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (
    room.commentator_id !== caller.userId &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json(
      { error: "Only the room's commentator can do that." },
      { status: 403 },
    );
  }

  if (body.action === "start") {
    if (room.state !== "waiting") {
      return NextResponse.json(
        { error: `Can't start from ${room.state}.` },
        { status: 409 },
      );
    }
    const { data: updated, error } = await service
      .from("rooms")
      .update({ state: "pregame", started_at: new Date().toISOString() })
      .eq("id", room.id)
      .select()
      .single<Room>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await publishState(room.id, "pregame");
    return NextResponse.json({ room: updated });
  }

  // end
  if (!END_FROM.includes(room.state)) {
    return NextResponse.json(
      { error: `Can't end from ${room.state}.` },
      { status: 409 },
    );
  }
  const { data: updated, error } = await service
    .from("rooms")
    .update({ state: "wrapped", ended_at: new Date().toISOString() })
    .eq("id", room.id)
    .select()
    .single<Room>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await publishState(room.id, "wrapped");
  return NextResponse.json({ room: updated });
}
