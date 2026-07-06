import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { notifyRoomsCanceled } from "@/lib/notify/producers";

/**
 * Unsubscribe (FR-20.4): deactivate the subscription and cancel the FUTURE
 * scheduled rooms it created. Past and live rooms are untouched; RSVP holders
 * + co-hosts of the canceled rooms get room_change("canceled") per room
 * (FR-21; a one-summary-per-recipient collapse is a follow-up).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: sub } = await service
    .from("host_team_subscriptions")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  if (sub.user_id !== caller.userId && !isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error: deErr } = await service
    .from("host_team_subscriptions")
    .update({ active: false, deactivated_at: new Date().toISOString() })
    .eq("id", id);
  if (deErr) {
    return NextResponse.json({ error: deErr.message }, { status: 500 });
  }

  // cancel only this subscription's FUTURE scheduled rooms (FR-20.4)
  const { data: canceled, error: cancelErr } = await service
    .from("rooms")
    .update({ state: "canceled" })
    .eq("subscription_id", id)
    .eq("state", "scheduled")
    .gt("scheduled_kickoff", new Date().toISOString())
    .select("id");
  if (cancelErr) {
    return NextResponse.json({ error: cancelErr.message }, { status: 500 });
  }

  const canceledIds = (canceled ?? []).map((r) => r.id as string);
  if (canceledIds.length > 0) {
    const actorId = caller.userId;
    after(async () => {
      await notifyRoomsCanceled(createServiceClient(), canceledIds, actorId);
    });
  }

  return NextResponse.json({ ok: true, roomsCanceled: canceledIds.length });
}
