import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const schema = z.object({ userId: z.uuid() });

/**
 * Admin moderation: clear another user's avatar back to the initial-circle
 * fallback (audit 2026-07-02 — an abusive avatar previously had no removal
 * path short of banning the account or manual DB surgery).
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", parsed.data.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
