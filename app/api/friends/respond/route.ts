import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { flushRows } from "@/lib/notify/outbox";
import { enqueueFriendAccept } from "@/lib/notify/producers";

const schema = z.object({
  userId: z.uuid(), // the requester whose pending request we're responding to
  action: z.enum(["accept", "decline"]),
});

/**
 * Respond to a pending friend request (FR-23.1). Only the addressee of a
 * pending request may respond. Accept creates the friendship and notifies the
 * requester (friend_accept); decline is silent (status flips, no notification,
 * the requester keeps seeing "Requested").
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const requesterId = parsed.data.userId;

  const service = createServiceClient();
  // claim the pending request atomically: only the addressee, only if pending
  const nextStatus = parsed.data.action === "accept" ? "accepted" : "declined";
  const { data: updated, error } = await service
    .from("friendships")
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq("requester_id", requesterId)
    .eq("addressee_id", caller.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "No pending request from that user." },
      { status: 404 },
    );
  }

  if (parsed.data.action === "accept") {
    // clear any stale declined row for this pair: they're friends now, so an
    // old decline must not linger and corrupt friendState after a later
    // unfriend (review 2026-07-03)
    await service
      .from("friendships")
      .delete()
      .eq("status", "declined")
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${caller.userId}),and(requester_id.eq.${caller.userId},addressee_id.eq.${requesterId})`,
      );
    after(async () => {
      const svc = createServiceClient();
      const ids = await enqueueFriendAccept(svc, {
        requesterId,
        accepterId: caller.userId,
        accepterName: caller.profile.username,
      });
      await flushRows(svc, ids);
    });
  }

  return NextResponse.json({
    ok: true,
    state: parsed.data.action === "accept" ? "friends" : "none",
  });
}
