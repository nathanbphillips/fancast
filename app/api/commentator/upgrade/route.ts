import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { COMMENTATOR_TERMS_VERSION } from "@/lib/commentator-terms";
import { createServiceClient } from "@/lib/db/server";
import type { Profile } from "@/lib/db/types";

const schema = z.object({
  termsVersion: z.literal(COMMENTATOR_TERMS_VERSION),
  accepted: z.literal(true),
});

/**
 * Self-serve commentator upgrade (FR-18.1, supersedes FR-2.2's manual grant).
 * A signed-in listener accepts the commentator terms and becomes a
 * commentator in the same session; acceptance time + version are recorded.
 * Admin grant (grant-role script / ADMIN_USER_IDS) still works as a backstop.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Accept the current commentator terms to continue." },
      { status: 400 },
    );
  }

  if (caller.profile.role === "commentator") {
    return NextResponse.json(
      { error: "You're already a commentator." },
      { status: 409 },
    );
  }
  // admins already hold every commentator capability; record acceptance only
  const nextRole = caller.profile.role === "admin" ? "admin" : "commentator";

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .update({
      role: nextRole,
      commentator_terms_accepted_at: new Date().toISOString(),
      commentator_terms_version: COMMENTATOR_TERMS_VERSION,
    })
    .eq("user_id", caller.userId)
    .select()
    .single<Profile>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
