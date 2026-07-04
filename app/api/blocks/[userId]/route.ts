import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

/**
 * Block (FR-23.4): severs any friendship or pending request between the pair,
 * records the block, and (by removing the friendship) drops both from each
 * other's friend chips and RSVP-presence visibility. Invisible to the blocked
 * user. Unblock removes only the block row; friendship is not restored.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }
  if (userId === caller.userId) {
    return NextResponse.json({ error: "You can't block yourself." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: exists } = await service
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!exists) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // sever accepted + pending relationships (either direction). A DECLINED row
  // is preserved: deleting it would let block -> unblock erase a decline and
  // bypass no-re-request-after-decline (review 2026-07-03).
  await service
    .from("friendships")
    .delete()
    .in("status", ["accepted", "pending"])
    .or(
      `and(requester_id.eq.${caller.userId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${caller.userId})`,
    );

  const { error } = await service
    .from("user_blocks")
    .upsert(
      { blocker_id: caller.userId, blocked_id: userId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, blocked: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  const service = createServiceClient();
  await service
    .from("user_blocks")
    .delete()
    .eq("blocker_id", caller.userId)
    .eq("blocked_id", userId);
  return NextResponse.json({ ok: true, blocked: false });
}
