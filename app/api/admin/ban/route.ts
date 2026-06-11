import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const bodySchema = z.object({
  userId: z.uuid(),
  reason: z.string().max(300).optional(),
  /** ISO timestamp; omit for permanent */
  expiresAt: z.iso.datetime().optional(),
});

/** Admin ban (FR-8.4). Device fingerprinting joins in a later phase;
 *  the bans table already carries device_hash for it. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (parsed.data.userId === caller.userId) {
    return NextResponse.json(
      { error: "You can't ban yourself." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("bans").upsert({
    user_id: parsed.data.userId,
    reason: parsed.data.reason ?? null,
    expires_at: parsed.data.expiresAt ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ banned: true });
}

/** Lift a ban. */
export async function DELETE(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = z
    .object({ userId: z.uuid() })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  await service.from("bans").delete().eq("user_id", parsed.data.userId);
  return NextResponse.json({ unbanned: true });
}
