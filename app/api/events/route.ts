import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Product-telemetry sink (migration 0041). Open to signed-in users AND guests,
 * so it's IP rate-limited and writes through the service role into an
 * admin-only table. Fire-and-forget from the client (sendBeacon/keepalive);
 * always answers ok so a failed beacon never surfaces to the user.
 */

const schema = z.object({
  event: z.string().trim().min(1).max(60),
  roomId: z.string().uuid().optional(),
  path: z.string().trim().max(300).optional(),
  sessionId: z.string().trim().max(80).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  // generous: telemetry is chatty, but this still blunts a naive flood
  if (!rateLimit(`events:${clientIp(request)}`, 300, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const d = parsed.data;

  const { user, profile } = await getCurrentUserAndProfile();
  const service = createServiceClient();
  await service.from("events").insert({
    event: d.event,
    user_id: profile ? user!.id : null,
    session_id: d.sessionId ?? null,
    room_id: d.roomId ?? null,
    path: d.path ?? null,
    props: d.props ?? null,
  });

  return NextResponse.json({ ok: true });
}
