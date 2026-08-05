import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";
import { voteWeight } from "@/lib/standing";
import { recomputeUser } from "@/lib/fanScore";

const bodySchema = z.object({
  messageId: z.uuid(),
  /** 1 = up, -1 = down, 0 = remove my vote */
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/** Vote on a message (FR-8.2 → Phase 11): raw up/down for display plus a
 *  weighted `score` (established accounts count full, new ones 0.3) used by the
 *  "top" sort, so a few sock-puppets can't drive the ranking. Per-user rate
 *  limited since votes now affect ordering. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  // votes now drive ranking, so cap the rate per user (a real voter toggles a
  // handful of items, not dozens a second)
  if (!rateLimit(`chatvote:${caller.userId}`, 40, 60_000)) {
    return NextResponse.json({ error: "Slow down on the votes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const { messageId, value } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select("id, room_id, user_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  // Self-votes are ALLOWED (founder 2026-08-05) but carry ZERO weight. FR-24.6
  // blocked them outright to stop an author inflating their own fan score —
  // since fan_score and the "top" sort both read the WEIGHTED columns
  // (migration 0033: comments + upvotes_weighted - downvotes_weighted), a
  // weight-0 vote keeps that protection while letting the author use the arrows
  // on their own message. Only the raw up/down display moves.
  const selfVote = message.user_id === caller.userId;

  // Mutate the vote row and recompute the denormalized counts atomically
  // under a parent-row lock (M-3, audit) — vote rows stay the source of truth.
  const { data, error } = await service
    .rpc("cast_message_vote", {
      p_message_id: messageId,
      p_user_id: caller.userId,
      p_value: value,
      p_weight: selfVote ? 0 : voteWeight(caller.profile),
    })
    .single<{ up: number; down: number; score: number }>();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Vote failed." },
      { status: 500 },
    );
  }
  // Postgres numeric serializes as a JSON string; coerce so the wire payload
  // and the type both say number
  const { up, down } = data;
  const score = Number(data.score);

  await publish(channels.chat(message.room_id), "vote", {
    messageId,
    up,
    down,
    score,
  });

  // FR-24.5: a vote changes the message author's fan score (incremental bump;
  // the nightly cron self-heals any drift)
  const authorId = message.user_id;
  after(() => recomputeUser(createServiceClient(), authorId));

  return NextResponse.json({ up, down, score });
}
