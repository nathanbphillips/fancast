import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { ratingsAggregate } from "@/lib/ratings";
import type { RoomState } from "@/lib/db/types";

// FR-12.3: player ratings open postgame (after Stop 2H / full time).
const OPEN_STATES: RoomState[] = ["postgame"];

const bodySchema = z.object({
  roomId: z.uuid(),
  playerId: z.number().int().positive(),
  rating: z.number().int().min(1).max(10),
});

/** Rate a player 1-10. Same model as the slider: validate → service upsert →
 *  recompute per-player averages → publish on the control channel. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating." }, { status: 400 });
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
      { error: "Ratings open at full time." },
      { status: 403 },
    );
  }

  const { error } = await service.from("player_ratings").upsert({
    room_id: room.id,
    user_id: caller.userId,
    player_id: parsed.data.playerId,
    rating: parsed.data.rating,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: rows } = await service
    .from("player_ratings")
    .select("player_id, rating")
    .eq("room_id", room.id);
  const agg = ratingsAggregate(rows ?? []);

  await publish(channels.control(room.id), "ratings", agg);
  return NextResponse.json(agg);
}
