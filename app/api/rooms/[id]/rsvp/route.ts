import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { cancelUserRoomNotifications } from "@/lib/notify/outbox";
import { enqueueRsvpReminder } from "@/lib/notify/producers";

/**
 * RSVP toggle (FR-22.1). "Count me in" on a scheduled room. Recomputes the
 * denormalized rsvp_count on every write (the vote-aggregate pattern),
 * schedules/cancels the 30-min rsvp_reminder, and publishes the new count on
 * the room's control channel so open scheduled-room pages update live.
 */

type RoomRow = {
  id: string;
  state: string;
  broadcast_start: string | null;
  slug: string;
  fixture: { home_team: string; away_team: string } | null;
};

async function recomputeCount(
  service: ReturnType<typeof createServiceClient>,
  roomId: string,
): Promise<number> {
  const { count } = await service
    .from("room_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);
  const n = count ?? 0;
  await service.from("rooms").update({ rsvp_count: n }).eq("id", roomId);
  return n;
}

async function loadRoom(
  service: ReturnType<typeof createServiceClient>,
  id: string,
): Promise<RoomRow | null> {
  const { data } = await service
    .from("rooms")
    .select("id, state, broadcast_start, slug, fixture:fixtures(home_team, away_team)")
    .eq("id", id)
    .maybeSingle<RoomRow>();
  return data;
}

export async function POST(
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
  const room = await loadRoom(service, id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (room.state !== "scheduled") {
    return NextResponse.json(
      { error: "This room isn't taking RSVPs." },
      { status: 409 },
    );
  }

  const { error } = await service
    .from("room_rsvps")
    .upsert(
      { room_id: id, user_id: caller.userId },
      { onConflict: "room_id,user_id", ignoreDuplicates: true },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = await recomputeCount(service, id);
  await publish(channels.control(id), "rsvp", { count });

  // schedule the 30-min reminder (FR-22.1); after the response
  after(async () => {
    const svc = createServiceClient();
    await enqueueRsvpReminder(svc, {
      roomId: id,
      userId: caller.userId,
      broadcastStart: room.broadcast_start,
      payload: room.fixture
        ? {
            matchLabel: `${room.fixture.home_team} vs ${room.fixture.away_team}`,
            roomSlug: room.slug,
          }
        : { roomSlug: room.slug },
    });
  });

  return NextResponse.json({ rsvped: true, count }, { status: 201 });
}

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
  const { error } = await service
    .from("room_rsvps")
    .delete()
    .eq("room_id", id)
    .eq("user_id", caller.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = await recomputeCount(service, id);
  await publish(channels.control(id), "rsvp", { count });
  after(async () => {
    const svc = createServiceClient();
    await cancelUserRoomNotifications(svc, caller.userId, id, "rsvp_reminder");
  });

  return NextResponse.json({ rsvped: false, count });
}
