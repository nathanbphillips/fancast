import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";
import { voteWeight } from "@/lib/standing";

const bodySchema = z.object({
  linkId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/** Vote on a link. Hiding rule (FR-9.2): hidden when downvotes:upvotes
 *  exceeds 2:1 AND total votes >= 5. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  if (!rateLimit(`linkvote:${caller.userId}`, 40, 60_000)) {
    return NextResponse.json({ error: "Slow down on the votes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const { linkId, value } = parsed.data;

  const service = createServiceClient();
  const { data: link } = await service
    .from("links")
    .select("id, room_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  // Mutate the vote row, recompute counts, and re-evaluate the FR-9.2 hide
  // threshold atomically under a parent-row lock (M-3, audit).
  const { data, error } = await service
    .rpc("cast_link_vote", {
      p_link_id: linkId,
      p_user_id: caller.userId,
      p_value: value,
      p_weight: voteWeight(caller.profile),
    })
    .single<{ up: number; down: number; score: number; is_hidden: boolean }>();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Vote failed." },
      { status: 500 },
    );
  }
  // numeric serializes as a JSON string; coerce to a real number
  const { up, down, is_hidden: shouldHide } = data;
  const score = Number(data.score);

  await publish(channels.links(link.room_id), "vote", {
    linkId,
    up,
    down,
    score,
    hidden: shouldHide,
  });
  return NextResponse.json({ up, down, score, hidden: shouldHide });
}
