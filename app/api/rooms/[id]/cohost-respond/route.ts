import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { flushRows } from "@/lib/notify/outbox";
import { enqueueCohostResponse } from "@/lib/notify/producers";

const schema = z.object({ action: z.enum(["accept", "decline"]) });
const HOST_CAP = 2;

/**
 * Respond to a co-host invite (FR-25.1). Only the invitee with a pending
 * 'invited' row may respond. Accept writes an accepted host row (re-checking
 * the cap) and notifies the inviter; decline flips to declined and notifies.
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: invite } = await service
    .from("room_hosts")
    .select("invited_by, status")
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .maybeSingle<{ invited_by: string | null; status: string }>();
  if (!invite || invite.status !== "invited") {
    return NextResponse.json(
      { error: "No pending invite for this room." },
      { status: 404 },
    );
  }

  if (parsed.data.action === "accept") {
    // re-check the cap: another accept may have filled the last seat
    const { count } = await service
      .from("room_hosts")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "accepted");
    if ((count ?? 0) >= HOST_CAP) {
      return NextResponse.json(
        { error: "This room already has the maximum number of hosts." },
        { status: 409 },
      );
    }
  }

  const nextStatus = parsed.data.action === "accept" ? "accepted" : "declined";
  // atomic claim: only flip a still-'invited' row
  const { data: updated } = await service
    .from("room_hosts")
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .eq("status", "invited")
    .select("user_id")
    .maybeSingle();
  if (!updated) {
    return NextResponse.json(
      { error: "The invite is no longer pending." },
      { status: 409 },
    );
  }

  if (invite.invited_by) {
    const inviterId = invite.invited_by;
    after(async () => {
      const svc = createServiceClient();
      const { data: room } = await svc
        .from("rooms")
        .select("slug, fixture:fixtures(home_team, away_team)")
        .eq("id", roomId)
        .maybeSingle<{
          slug: string;
          fixture: { home_team: string; away_team: string } | null;
        }>();
      const ids = await enqueueCohostResponse(svc, {
        roomId,
        inviterId,
        responderId: caller.userId,
        payload: {
          actorName: caller.profile.username,
          matchLabel: room?.fixture
            ? `${room.fixture.home_team} vs ${room.fixture.away_team}`
            : undefined,
          roomSlug: room?.slug,
          change: parsed.data.action,
        },
      });
      await flushRows(svc, ids);
    });
  }

  return NextResponse.json({
    ok: true,
    state: parsed.data.action === "accept" ? "accepted" : "declined",
  });
}
