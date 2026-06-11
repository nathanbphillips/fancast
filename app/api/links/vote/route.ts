import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

const bodySchema = z.object({
  linkId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/** Vote on a link. Hiding rule (FR-9.2): hidden when downvotes:upvotes
 *  exceeds 2:1 AND total votes >= 5. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const { linkId, value } = parsed.data;

  const service = createServiceClient();
  const { data: link } = await service
    .from("links")
    .select("id, room_id, hidden")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  if (value === 0) {
    await service
      .from("link_votes")
      .delete()
      .eq("link_id", linkId)
      .eq("user_id", caller.userId);
  } else {
    const { error } = await service
      .from("link_votes")
      .upsert(
        { link_id: linkId, user_id: caller.userId, value },
        { onConflict: "link_id,user_id" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: votes } = await service
    .from("link_votes")
    .select("value")
    .eq("link_id", linkId);
  const up = votes?.filter((v) => v.value === 1).length ?? 0;
  const down = votes?.filter((v) => v.value === -1).length ?? 0;

  const shouldHide = down > 2 * up && up + down >= 5;

  await service
    .from("links")
    .update({ up_count: up, down_count: down, hidden: shouldHide })
    .eq("id", linkId);

  await publish(channels.links(link.room_id), "vote", {
    linkId,
    up,
    down,
    hidden: shouldHide,
  });
  return NextResponse.json({ up, down, hidden: shouldHide });
}
