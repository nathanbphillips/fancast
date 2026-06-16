import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const bodySchema = z.object({
  roomId: z.uuid(),
  tab: z.enum(["stats", "events", "lineups"]),
});

/**
 * Commentator pushes a stats tab to all listeners (FR-11.2) — a transient UI
 * hint published on the control channel, NOT persisted (no DB write, no
 * clock_events row). A reconnecting client re-inherits via the control
 * channel's rewind window. Listeners can override locally after a push.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, commentator_id")
    .eq("id", parsed.data.roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (
    room.commentator_id !== caller.userId &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  await publish(channels.control(room.id), "stats_tab", {
    tab: parsed.data.tab,
    ts: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
