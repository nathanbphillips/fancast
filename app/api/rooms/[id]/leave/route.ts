import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";

/**
 * Leave a room as a host (FR-25.5). Removes the caller from the hosts; the room
 * continues with the remaining host. If the caller is the LAST accepted host of
 * a scheduled room, the room is canceled (RSVP holders notified once wired).
 * During waiting/live, End Broadcast is the separate control; leaving there just
 * drops the host from the roster.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const { id: roomId } = await params;
  if (!z.uuid().safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!(await isRoomHost(service, caller.userId, roomId))) {
    return NextResponse.json({ error: "You don't host this room." }, { status: 403 });
  }

  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", roomId)
    .maybeSingle<{ id: string; state: string }>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // drop this host
  await service
    .from("room_hosts")
    .update({ status: "left", responded_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .eq("status", "accepted");

  const { count: remaining } = await service
    .from("room_hosts")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("status", "accepted");

  // last host leaving a scheduled room cancels it (FR-25.5)
  let canceled = false;
  if ((remaining ?? 0) === 0 && room.state === "scheduled") {
    await service
      .from("rooms")
      .update({ state: "canceled" })
      .eq("id", roomId)
      .eq("state", "scheduled");
    canceled = true;
  }

  return NextResponse.json({ ok: true, canceled, remainingHosts: remaining ?? 0 });
}
