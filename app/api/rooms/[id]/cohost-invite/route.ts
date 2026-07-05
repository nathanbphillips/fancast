import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { flushRows } from "@/lib/notify/outbox";
import { enqueueCohostInvite } from "@/lib/notify/producers";

const schema = z.object({ username: z.string().trim().min(1).max(20) });

const INVITABLE_STATES = ["scheduled", "waiting"];
const HOST_CAP = 2; // accepted hosts in v1 (schema supports N)

/**
 * Invite a co-host by username (FR-25.1). Caller must be an accepted host; the
 * invitee must hold a commentator account. Only on scheduled/waiting rooms
 * (mid-broadcast invites are out of scope). Cap: 2 accepted hosts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const { id: roomId } = await params;
  if (!z.uuid().safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a username." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!(await isRoomHost(service, caller.userId, roomId))) {
    return NextResponse.json({ error: "Only a host can invite." }, { status: 403 });
  }

  const { data: room } = await service
    .from("rooms")
    .select("id, state, slug, fixture:fixtures(home_team, away_team)")
    .eq("id", roomId)
    .maybeSingle<{
      id: string;
      state: string;
      slug: string;
      fixture: { home_team: string; away_team: string } | null;
    }>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!INVITABLE_STATES.includes(room.state)) {
    return NextResponse.json(
      { error: "You can only invite a co-host before the broadcast starts." },
      { status: 409 },
    );
  }

  const { data: invitee } = await service
    .from("profiles")
    .select("user_id, role")
    .eq("username", parsed.data.username)
    .maybeSingle<{ user_id: string; role: string }>();
  if (!invitee) {
    return NextResponse.json({ error: "No user with that name." }, { status: 404 });
  }
  if (invitee.user_id === caller.userId) {
    return NextResponse.json({ error: "That's you." }, { status: 400 });
  }
  if (invitee.role === "listener") {
    return NextResponse.json(
      { error: "A co-host needs a commentator account." },
      { status: 409 },
    );
  }

  // host cap counts accepted AND pending invites, so you can't stack two
  // pending invites for one remaining seat (which enabled an accept race,
  // review 2026-07-03)
  const { data: hosts } = await service
    .from("room_hosts")
    .select("user_id, status")
    .eq("room_id", roomId);
  const takenCount = (hosts ?? []).filter(
    (h) => h.status === "accepted" || h.status === "invited",
  ).length;
  if (takenCount >= HOST_CAP) {
    return NextResponse.json(
      { error: `This room already has ${HOST_CAP} hosts or pending invites.` },
      { status: 409 },
    );
  }
  const existing = (hosts ?? []).find((h) => h.user_id === invitee.user_id);
  if (existing?.status === "accepted") {
    return NextResponse.json({ error: "They already host this room." }, { status: 409 });
  }
  if (existing?.status === "invited") {
    return NextResponse.json({ error: "They already have a pending invite." }, { status: 409 });
  }

  // fresh invite, or re-invite after a decline/leave (allowed once)
  const { error } = await service.from("room_hosts").upsert(
    {
      room_id: roomId,
      user_id: invitee.user_id,
      status: "invited",
      invited_by: caller.userId,
      responded_at: null,
    },
    { onConflict: "room_id,user_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(async () => {
    const svc = createServiceClient();
    const ids = await enqueueCohostInvite(svc, {
      roomId,
      inviteeId: invitee.user_id,
      inviterId: caller.userId,
      payload: {
        actorName: caller.profile.username,
        matchLabel: room.fixture
          ? `${room.fixture.home_team} vs ${room.fixture.away_team}`
          : undefined,
        roomSlug: room.slug,
      },
    });
    await flushRows(svc, ids);
  });

  return NextResponse.json({ ok: true, invited: parsed.data.username }, { status: 201 });
}
