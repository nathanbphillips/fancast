import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { Bulletin, RoomState } from "@/lib/db/types";
import { rateLimit } from "@/lib/ratelimit";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";

/**
 * Team-news bulletin (Programme room rebuild, founder 2026-09-22): the host
 * types a line at the production desk and pushes it; the card lands in every
 * listener's stats rail. Persisted to room_bulletins (latest row = the card,
 * recovered via the snapshot - the 'stat_overrides' pattern, never the
 * transient 'stats_tab' one) then published on the control channel with ts
 * ordering so Ably rewind replays can't regress it.
 */

const OPEN_STATES: RoomState[] = [
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const bodySchema = z.object({
  body: z.string().trim().min(1).max(280),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  if (!rateLimit(`bulletin:${caller.userId}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Give the last bulletin a minute to land." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulletin." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", id)
    .maybeSingle<{ id: string; state: RoomState }>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (
    !(await isRoomHost(service, caller.userId, room.id)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!OPEN_STATES.includes(room.state)) {
    return NextResponse.json(
      { error: "Bulletins go out while the room is open." },
      { status: 409 },
    );
  }

  const { data: row, error } = await service
    .from("room_bulletins")
    .insert({ room_id: room.id, user_id: caller.userId, body: parsed.data.body })
    .select("id, body, created_at")
    .single<{ id: string; body: string; created_at: string }>();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Bulletin failed." },
      { status: 500 },
    );
  }

  const bulletin: Bulletin = {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
  };
  await publish(channels.control(room.id), "bulletin", {
    bulletin,
    ts: row.created_at,
  });
  return NextResponse.json({ bulletin }, { status: 201 });
}
