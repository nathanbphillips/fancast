import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { predictionAggregate } from "@/lib/predictions";
import type { RoomState } from "@/lib/db/types";

// FR-12.1: score predictions are open during pregame only (after Start
// Broadcast, before kickoff) and resolve read-only once the match is underway.
const OPEN_STATES: RoomState[] = ["pregame"];

const bodySchema = z.object({
  roomId: z.uuid(),
  home: z.number().int().min(0).max(20),
  away: z.number().int().min(0).max(20),
});

/** Submit/update a scoreline prediction. Same model as the slider: validate →
 *  service-role upsert → recompute the public distribution → publish it on the
 *  control channel. Individual scorelines stay RLS-private. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prediction." }, { status: 400 });
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
      { error: "Predictions close at kickoff." },
      { status: 403 },
    );
  }

  const { error } = await service.from("predictions").upsert({
    room_id: room.id,
    user_id: caller.userId,
    home_score: parsed.data.home,
    away_score: parsed.data.away,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: rows } = await service
    .from("predictions")
    .select("home_score, away_score")
    .eq("room_id", room.id);
  const agg = predictionAggregate(rows ?? []);

  await publish(channels.control(room.id), "prediction", agg);
  return NextResponse.json(agg);
}
