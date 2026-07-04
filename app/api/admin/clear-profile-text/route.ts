import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const schema = z.object({
  userId: z.uuid(),
  section: z.enum(["about", "social_links"]),
});

/**
 * Admin moderation (FR-18.6): clear a profile's about text or social links,
 * the same way avatars are cleared. Typically follows a profile report.
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
    .update({ [parsed.data.section]: null })
    .eq("user_id", parsed.data.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
