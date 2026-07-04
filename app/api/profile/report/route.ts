import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

const schema = z.object({
  userId: z.uuid(),
  reason: z.enum([
    "impersonation",
    "abuse",
    "spam",
    "inappropriate_content",
    "other",
  ]),
  note: z.string().trim().max(500).optional(),
});

const DAILY_LIMIT = 5;

/**
 * Report a profile (FR-18.6). Reports land in the moderation surface
 * (profile_reports has no client SELECT; admin reads via service role).
 * Per-user daily budget keeps report-bombing cheap to absorb.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  if (parsed.data.userId === caller.userId) {
    return NextResponse.json(
      { error: "You can't report yourself." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("user_id")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("profile_reports")
    .select("*", { count: "exact", head: true })
    .eq("reporter_id", caller.userId)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "Report limit reached for today." },
      { status: 429 },
    );
  }

  const { error } = await service.from("profile_reports").insert({
    profile_user_id: parsed.data.userId,
    reporter_id: caller.userId,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
