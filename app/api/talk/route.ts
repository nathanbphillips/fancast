import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { callerFlagSummary } from "@/lib/callers";
import { createServiceClient } from "@/lib/db/server";
import { setPublishPermission } from "@/lib/livekit";
import type { RoomState, TalkRequest } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";

const OPEN_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const MIN_ACCOUNT_AGE_MS = 48 * 60 * 60 * 1000;
const MIN_PRIOR_MESSAGES = 5;

const submitSchema = z.object({
  roomId: z.uuid(),
  topic: z.string().trim().min(1).max(120),
  /** must be true on the account's first-ever request (Terms §5) */
  consent: z.boolean().optional(),
});

const updateSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["accepted", "dismissed"]),
});

/** Request to talk (FR-4.2/4.4). */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = submitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state, commentator_id")
    .eq("id", parsed.data.roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!OPEN_STATES.includes(room.state as RoomState)) {
    return NextResponse.json(
      { error: "Call-ins open when the broadcast starts." },
      { status: 403 },
    );
  }
  if (room.commentator_id === caller.userId) {
    return NextResponse.json(
      { error: "You're already on air." },
      { status: 400 },
    );
  }

  // eligibility gates (FR-4.4, amended 2026-06-11): the explicit,
  // reversible block list replaces the old "ever removed from air" rule
  const { data: blocked } = await service
    .from("call_in_blocks")
    .select("user_id")
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (blocked) {
    return NextResponse.json(
      { error: "Call-ins aren't available on this account." },
      { status: 403 },
    );
  }
  const accountAge =
    Date.now() - new Date(caller.profile.created_at).getTime();
  if (accountAge < MIN_ACCOUNT_AGE_MS) {
    return NextResponse.json(
      { error: "Accounts need to be at least 48 hours old to call in." },
      { status: 403 },
    );
  }
  const { count: priorMessages } = await service
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", caller.userId);
  if ((priorMessages ?? 0) < MIN_PRIOR_MESSAGES) {
    return NextResponse.json(
      { error: "Join the chat a bit first — call-ins need 5 prior messages." },
      { status: 403 },
    );
  }

  // one open request per room per user
  const { data: existing } = await service
    .from("talk_requests")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", caller.userId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Your request is already in." },
      { status: 409 },
    );
  }

  // first-use consent (checkbox copy in docs/LEGAL_PAGES.md)
  const { data: priorConsent } = await service
    .from("talk_requests")
    .select("consent_at")
    .eq("user_id", caller.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let consentAt: string;
  if (priorConsent) {
    consentAt = priorConsent.consent_at;
  } else if (parsed.data.consent === true) {
    consentAt = new Date().toISOString();
  } else {
    return NextResponse.json(
      { error: "Consent is required before your first call-in.", code: "consent_required" },
      { status: 400 },
    );
  }

  const { data: talkRequest, error } = await service
    .from("talk_requests")
    .insert({
      room_id: room.id,
      user_id: caller.userId,
      topic: parsed.data.topic,
      consent_at: consentAt,
    })
    .select("*, author:profiles!talk_requests_user_id_fkey(username, role, avatar_url)")
    .single<TalkRequest>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // attach the caller-flag summary so the commentator's request card can
  // warn about previously flagged callers (commentator-only channel)
  const withFlags: TalkRequest = {
    ...talkRequest,
    caller_flags: await callerFlagSummary(service, caller.userId),
  };

  await publish(`room:${room.id}:private`, "talk_request", withFlags);
  return NextResponse.json({ request: withFlags }, { status: 201 });
}

/** Accept/dismiss (room commentator). Dismissal is silent to the
 *  requester (FR-4.2). Accept wires LiveKit elevation in Phase 5. */
export async function PATCH(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: talkRequest } = await service
    .from("talk_requests")
    .select(
      "id, room_id, user_id, status, room:rooms!talk_requests_room_id_fkey(commentator_id)",
    )
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string;
      room_id: string;
      user_id: string;
      status: string;
      room: { commentator_id: string };
    }>();
  if (!talkRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (
    talkRequest.room.commentator_id !== caller.userId &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (talkRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Request already handled." },
      { status: 409 },
    );
  }

  // FR-4.1: max on-air = commentator + 2 guests. The accept path enforces the
  // cap atomically (M-3/M-6): the RPC re-checks status + count under row locks,
  // so two concurrent accepts of different requests can't both pass.
  if (parsed.data.status === "accepted") {
    const { data: outcome, error: rpcErr } = await service.rpc(
      "accept_talk_request",
      { p_request_id: talkRequest.id },
    );
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }
    if (outcome === "cap_full") {
      return NextResponse.json(
        { error: "Two guests are already on air." },
        { status: 409 },
      );
    }
    if (outcome !== "accepted") {
      return NextResponse.json(
        { error: "Request already handled." },
        { status: 409 },
      );
    }
  } else {
    // dismissed: no cap; guard the write on still-pending so a concurrent
    // resolve no-ops instead of clobbering
    const { error } = await service
      .from("talk_requests")
      .update({ status: parsed.data.status })
      .eq("id", talkRequest.id)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (parsed.data.status === "accepted") {
    // live LiveKit permission elevation (FR-4.2) + on-air history
    await setPublishPermission(talkRequest.room_id, talkRequest.user_id, true);
    await service.from("speaker_events").insert({
      room_id: talkRequest.room_id,
      user_id: talkRequest.user_id,
      action: "elevated",
    });
  }

  await publish(channels.private(talkRequest.room_id), "talk_update", {
    requestId: talkRequest.id,
    status: parsed.data.status,
  });
  // Tell the requester their request left pending so their button re-enables
  // (M-10), on THEIR per-user channel — no userId on the shared control channel,
  // so listeners can't enumerate who requested + was dismissed (FR-4.2).
  await publish(
    channels.userPrivate(talkRequest.room_id, talkRequest.user_id),
    "talk_resolved",
    { requestId: talkRequest.id },
  );
  return NextResponse.json({ ok: true });
}
