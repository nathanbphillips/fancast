import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

/**
 * Caller management (founder decision 2026-06-11), commentator/admin only:
 *  - flag: informational note shared between commentators; zero effect on
 *    the flagged account
 *  - block / unblock: explicit, reversible bar on future talk requests
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("flag"),
    userId: z.uuid(),
    roomId: z.uuid().optional(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("block"),
    userId: z.uuid(),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal("unblock"), userId: z.uuid() }),
]);

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (
    caller.profile.role !== "commentator" &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  if (body.userId === caller.userId) {
    return NextResponse.json(
      { error: "You can't flag or block yourself." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  if (body.action === "flag") {
    const { error } = await service.from("caller_flags").insert({
      user_id: body.userId,
      flagged_by: caller.userId,
      room_id: body.roomId ?? null,
      note: body.note || null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ flagged: true }, { status: 201 });
  }

  if (body.action === "block") {
    const { error } = await service.from("call_in_blocks").upsert({
      user_id: body.userId,
      blocked_by: caller.userId,
      reason: body.reason || null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ blocked: true }, { status: 201 });
  }

  // unblock
  await service.from("call_in_blocks").delete().eq("user_id", body.userId);
  return NextResponse.json({ unblocked: true });
}
