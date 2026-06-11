import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
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

  // eligibility gates (FR-4.4); "never removed from air" joins in Phase 5
  // when speaker_events exists
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
    .select("*, author:profiles!talk_requests_user_id_fkey(username, role)")
    .single<TalkRequest>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(`room:${room.id}:private`, "talk_request", talkRequest);
  return NextResponse.json({ request: talkRequest }, { status: 201 });
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
    .select("id, room_id, status, room:rooms!talk_requests_room_id_fkey(commentator_id)")
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string;
      room_id: string;
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

  const { error } = await service
    .from("talk_requests")
    .update({ status: parsed.data.status })
    .eq("id", talkRequest.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(`room:${talkRequest.room_id}:private`, "talk_update", {
    requestId: talkRequest.id,
    status: parsed.data.status,
  });
  return NextResponse.json({ ok: true });
}
