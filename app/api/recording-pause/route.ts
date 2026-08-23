import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { emitMarker } from "@/lib/markers";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";
import { recordingPauseState } from "@/lib/recordingPause";

/**
 * Pause / resume the RECORDING (founder 2026-08-22). The broadcast stays on
 * air and radio keeps streaming; only the produced files skip the paused
 * stretch (processing drops those seconds before stitching). Drops a
 * record_pause / record_resume marker and publishes `recording` on the control
 * channel so every host's bar and every listener's card updates. Any accepted
 * host can pause or resume; the state is shared.
 *
 * Pauses are final (no post-show editing) and live only while the broadcast
 * does: a pause still open at End Broadcast is closed by the end action.
 */
const schema = z.object({
  roomId: z.uuid(),
  action: z.enum(["pause", "resume"]),
});

// recording exists only between Start and End Broadcast
const RECORDING_STATES = ["pregame", "live_1h", "halftime", "live_2h", "extra_time", "postgame"];

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, action } = parsed.data;
  const service = createServiceClient();

  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", roomId)
    .maybeSingle<{ id: string; state: string }>();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!(await isRoomHost(service, caller.userId, room.id)) && !isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  }
  if (!RECORDING_STATES.includes(room.state)) {
    return NextResponse.json(
      { error: "Nothing is recording right now." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const current = await recordingPauseState(service, roomId);
  const wantPaused = action === "pause";
  // idempotent: a double tap or a stale second host tab is a no-op
  if (current.paused === wantPaused) {
    return NextResponse.json({ paused: current.paused, since: current.since, at: now });
  }
  await emitMarker(
    service,
    roomId,
    wantPaused ? "record_pause" : "record_resume",
    now,
    "auto", // 'auto' skips emitMarker's 30s manual-merge rule: two quick pauses must both count
    wantPaused ? "Recording paused" : "Recording resumed",
  );
  // re-read rather than trust the write (review 2026-08-23): emitMarker does
  // not surface insert errors, and publishing a pause the DB does not hold
  // would show every host "paused" while processing records straight through
  const after = await recordingPauseState(service, roomId);
  if (after.paused !== wantPaused) {
    return NextResponse.json(
      { error: "Could not update the recording. Try again." },
      { status: 500 },
    );
  }
  // `at` orders events on the client (rewind replays, stale snapshots)
  const next = { paused: after.paused, since: after.since, at: now };
  await publish(channels.control(roomId), "recording", next);
  return NextResponse.json(next);
}
