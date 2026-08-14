import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { setPublishPermission } from "@/lib/livekit";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";

const bodySchema = z.object({
  roomId: z.uuid(),
  /** commentator/admin removing a guest; omitted = leaving yourself */
  userId: z.uuid().optional(),
});

/**
 * Leave Air (self, instant — FR-4.3) or commentator ending a call via the
 * speaker chip X. Both are NEUTRAL (founder decision 2026-06-11): no
 * effect on the caller's profile or future eligibility. Problem callers
 * are handled separately via /api/callers (flag / block).
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId } = parsed.data;
  const targetUserId = parsed.data.userId ?? caller.userId;
  const isRemoval = targetUserId !== caller.userId;

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, commentator_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (
    isRemoval &&
    !(await isRoomHost(service, caller.userId, room.id)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { data: acceptedRows } = await service
    .from("talk_requests")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("status", "accepted")
    .limit(1);
  const accepted = (acceptedRows ?? [])[0];

  // UNCONDITIONAL KILL SWITCH (founder 2026-08-05). This used to 404 when there
  // was no 'accepted' row, skipping the revoke entirely — so the host's ✕ did
  // nothing whenever state had drifted (e.g. the row was completed when the
  // caller re-requested). Revoking publish and announcing the departure must
  // happen regardless; the row update is best-effort on top.
  const revoked = await setPublishPermission(roomId, targetUserId, false);
  if (accepted) {
    await service
      .from("talk_requests")
      .update({ status: "completed" })
      .eq("id", accepted.id);
  }
  await service.from("speaker_events").insert({
    room_id: roomId,
    user_id: targetUserId,
    action: isRemoval ? "call_ended" : "left_air",
  });

  await publish(channels.control(roomId), "speaker_left", {
    userId: targetUserId,
    removed: isRemoval,
  });
  // re-enable the (former) caller's Request to Talk button once the call ends
  // (M-10), on THEIR per-user channel — no id on the shared control channel
  // (FR-4.2). speaker_left above legitimately carries the id (on-air speakers
  // are already public via LiveKit); a resolution must not be.
  await publish(channels.userPrivate(roomId, targetUserId), "talk_resolved", {
    requestId: accepted?.id ?? null,
  });
  // If LiveKit refused the revoke, say so — this used to return 200 regardless,
  // so the host's X looked like it worked while the caller stayed live.
  if (!revoked) {
    return NextResponse.json(
      { error: "Couldn't cut them off — audio service didn't respond. Try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
