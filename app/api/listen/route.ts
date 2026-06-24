import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient, createSupabaseServerClient } from "@/lib/db/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * Listener-metrics instrumentation (Phase 9, FR-9.4). Listening is open, so this
 * route is unauthenticated (anonymous listeners count too); a signed-in user is
 * attributed when present. The unguessable segment id returned by `start` is the
 * caller's capability to `heartbeat`/`stop` that one segment — no other auth is
 * needed. Fire-and-forget from the client; never blocks audio.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), roomId: z.uuid(), mode: z.enum(["live", "radio"]) }),
  z.object({ action: z.literal("heartbeat"), id: z.uuid() }),
  z.object({ action: z.literal("stop"), id: z.uuid() }),
]);

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const service = createServiceClient();

  if (body.action === "start") {
    // only `start` inserts a row, so it's the lone flood vector here (heartbeat
    // /stop just touch one existing segment by its capability id). Cap new
    // segments per IP; a real listener opens 1-2 per session (live/radio).
    if (!rateLimit(`listen:${clientIp(request)}`, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // don't open segments against bogus room ids
    const { data: room } = await service
      .from("rooms")
      .select("id")
      .eq("id", body.roomId)
      .maybeSingle();
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    const { data, error } = await service
      .from("listener_segments")
      .insert({ room_id: body.roomId, user_id: user?.id ?? null, mode: body.mode })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  }

  const now = new Date().toISOString();
  if (body.action === "heartbeat") {
    await service
      .from("listener_segments")
      .update({ last_seen_at: now })
      .eq("id", body.id)
      .is("ended_at", null);
    return NextResponse.json({ ok: true });
  }

  // stop — idempotent: only closes a still-open segment
  await service
    .from("listener_segments")
    .update({ ended_at: now, last_seen_at: now })
    .eq("id", body.id)
    .is("ended_at", null);
  return NextResponse.json({ ok: true });
}
