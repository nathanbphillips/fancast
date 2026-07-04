import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { isAdmin } from "@/lib/roles";

/**
 * Cancel a scheduled room (FR-19.7). Host-only via isRoomHost (admin as
 * backstop); only `scheduled` rooms cancel this way (waiting/live rooms end
 * through End Broadcast). RSVP holders get a cancellation notification once
 * FR-21 ships; silent until then.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", id)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const host = await isRoomHost(service, caller.userId, room.id);
  if (!host && !isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (room.state !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled rooms can be canceled." },
      { status: 409 },
    );
  }

  // guard on still-scheduled so a concurrent open-waiting wins cleanly
  const { data: canceled, error } = await service
    .from("rooms")
    .update({ state: "canceled" })
    .eq("id", room.id)
    .eq("state", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!canceled) {
    return NextResponse.json(
      { error: "The room just changed state. Refresh and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
