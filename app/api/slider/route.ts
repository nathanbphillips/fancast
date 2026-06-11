import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { RoomState } from "@/lib/db/types";

const OPEN_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const bodySchema = z.object({
  roomId: z.uuid(),
  value: z.number().int().min(0).max(100),
});

/** Commentary<->Discussion preference (FR-10.2). Advisory only; the room
 *  aggregate is public and rides the control channel. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid value." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", parsed.data.roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!OPEN_STATES.includes(room.state as RoomState)) {
    return NextResponse.json(
      { error: "The slider opens when the broadcast starts." },
      { status: 403 },
    );
  }

  const { error } = await service.from("slider_votes").upsert({
    room_id: room.id,
    user_id: caller.userId,
    value: parsed.data.value,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: votes } = await service
    .from("slider_votes")
    .select("value")
    .eq("room_id", room.id);
  const count = votes?.length ?? 0;
  const avg =
    count === 0
      ? 50
      : Math.round(votes!.reduce((s, v) => s + v.value, 0) / count);

  await publish(channels.control(room.id), "slider", { avg, count });
  return NextResponse.json({ avg, count });
}
