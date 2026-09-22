import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";

/**
 * Host-only RSVP name list for the production desk (founder 2026-09-22, the
 * room mock's "RSVP list - 41 going"). room_rsvps RLS is select-own-only, so
 * this is a service-role read behind the same isRoomHost gate as the roster
 * route; it is the first place RSVP NAMES are shown to anyone, and they reach
 * exactly one person: the room's host. The public surface stays a count.
 * RSVPs only accumulate while a room is 'scheduled', so this list is pre-open
 * interest, not live attendance.
 */
export async function GET(
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
    return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  }

  const { data, error } = await service
    .from("room_rsvps")
    .select("user:profiles!room_rsvps_user_id_fkey(username)")
    .eq("room_id", roomId)
    .limit(500);
  if (error) {
    return NextResponse.json({ error: "Could not load RSVPs." }, { status: 500 });
  }
  const names = (data ?? [])
    .map((r) => (r.user as unknown as { username: string } | null)?.username)
    .filter((n): n is string => !!n)
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ names, count: names.length });
}
