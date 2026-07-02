import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";
import type { RoomState } from "@/lib/db/types";

/** The five reactions the composer offers (Cloud Design set). Anything else is
 *  rejected. Kept in sync with REACTION_EMOJI on the client. */
const schema = z.object({
  roomId: z.uuid(),
  emoji: z.enum(["⚽", "🔥", "👏", "😱", "🙌"]),
});

const LIVE_STATES: RoomState[] = [
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

/**
 * Floating reaction emoji (Phase 5a). Ephemeral: a participant's tap is
 * validated + per-user rate-limited, then published to the room's reactions
 * channel — no DB row, never rehydrated on reconnect. Clients hold
 * subscribe-only tokens and never publish directly (golden rule 5).
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  // soft per-user flood guard (per-lambda memory) so a held finger can't spam Ably
  if (!rateLimit(`react:${caller.userId}:${parsed.data.roomId}`, 12, 4000)) {
    return NextResponse.json({ error: "Slow down a touch." }, { status: 429 });
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
  if (!LIVE_STATES.includes(room.state as RoomState)) {
    return NextResponse.json({ error: "Reactions are closed." }, { status: 403 });
  }

  await publish(channels.reactions(room.id), "reaction", {
    emoji: parsed.data.emoji,
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
