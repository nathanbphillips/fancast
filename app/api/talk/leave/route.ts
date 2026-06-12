import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { setPublishPermission } from "@/lib/livekit";
import { isAdmin } from "@/lib/roles";

const bodySchema = z.object({
  roomId: z.uuid(),
  /** commentator/admin removing a guest; omitted = leaving yourself */
  userId: z.uuid().optional(),
});

/**
 * Leave Air (self, instant — FR-4.3) or commentator removal via speaker
 * chip X. Removal permanently bars future call-ins (FR-4.4).
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
    room.commentator_id !== caller.userId &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { data: accepted } = await service
    .from("talk_requests")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("status", "accepted")
    .maybeSingle();
  if (!accepted) {
    return NextResponse.json({ error: "Not on air." }, { status: 404 });
  }

  await setPublishPermission(roomId, targetUserId, false);
  await service
    .from("talk_requests")
    .update({ status: "completed" })
    .eq("id", accepted.id);
  await service.from("speaker_events").insert({
    room_id: roomId,
    user_id: targetUserId,
    action: isRemoval ? "removed" : "left_air",
  });

  await publish(channels.control(roomId), "speaker_left", {
    userId: targetUserId,
    removed: isRemoval,
  });
  return NextResponse.json({ ok: true });
}
