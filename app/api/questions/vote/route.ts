import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";
import { voteWeight } from "@/lib/standing";

const bodySchema = z.object({
  questionId: z.uuid(),
  /** 1 = upvote, 0 = remove my vote (questions are upvote-only, per the mock) */
  value: z.union([z.literal(1), z.literal(0)]),
});

/** Upvote a question (Programme room rebuild, founder 2026-09-22): votes push
 *  a question up the host's list, so the ranking rules from chat votes apply
 *  verbatim - per-user rate limit, established-account weighting, self-votes
 *  at weight 0 (the raw count moves, the ranked score does not). */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  if (!rateLimit(`qvote:${caller.userId}`, 40, 60_000)) {
    return NextResponse.json({ error: "Slow down on the votes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const { questionId, value } = parsed.data;

  const service = createServiceClient();
  const { data: question } = await service
    .from("questions")
    .select("id, room_id, user_id, status")
    .eq("id", questionId)
    .maybeSingle();
  if (!question || question.status === "dismissed") {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const selfVote = question.user_id === caller.userId;

  const { data, error } = await service
    .rpc("cast_question_vote", {
      p_question_id: questionId,
      p_user_id: caller.userId,
      p_value: value,
      p_weight: selfVote ? 0 : voteWeight(caller.profile),
    })
    .single<{ up: number; score: number }>();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Vote failed." },
      { status: 500 },
    );
  }
  const { up } = data;
  const score = Number(data.score);

  await publish(channels.chat(question.room_id), "question_vote", {
    questionId,
    up,
    score,
  });

  return NextResponse.json({ up, score });
}
