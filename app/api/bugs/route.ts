import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * In-app bug reporter (short-term testing tool). Open to signed-in users AND
 * guests (the room allows both), so it's IP rate-limited and writes through the
 * service role into a table with no anon-readable policy (migration 0040). The
 * reporter + page/device context are attached for triage.
 */

const schema = z.object({
  description: z.string().trim().min(3).max(4000),
  category: z.string().trim().max(60).optional(),
  roomId: z.string().uuid().optional(),
  roomState: z.string().trim().max(40).optional(),
  path: z.string().trim().max(300).optional(),
  viewport: z.string().trim().max(40).optional(),
});

export async function POST(request: NextRequest) {
  if (!rateLimit(`bugs:${clientIp(request)}`, 15, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many reports just now. Try again in a bit." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // reporter is optional — attach it (and the readable username) when signed in
  const { user, profile } = await getCurrentUserAndProfile();

  const service = createServiceClient();
  const { error } = await service.from("bug_reports").insert({
    user_id: profile ? user!.id : null,
    username: profile?.username ?? null,
    room_id: d.roomId ?? null,
    room_state: d.roomState ?? null,
    category: d.category ?? null,
    description: d.description,
    path: d.path ?? null,
    viewport: d.viewport ?? null,
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (error) {
    return NextResponse.json(
      { error: "Couldn't submit that. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
