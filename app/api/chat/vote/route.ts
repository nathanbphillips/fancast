import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

const bodySchema = z.object({
  messageId: z.uuid(),
  /** 1 = up, -1 = down, 0 = remove my vote */
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/** Vote on a message (FR-8.2): one vote per user, changeable, social
 *  signal only. Recomputes aggregates and publishes them. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const { messageId, value } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select("id, room_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  if (value === 0) {
    await service
      .from("message_votes")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", caller.userId);
  } else {
    const { error } = await service
      .from("message_votes")
      .upsert(
        { message_id: messageId, user_id: caller.userId, value },
        { onConflict: "message_id,user_id" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // recompute aggregates (single source of truth: vote rows)
  const { data: votes } = await service
    .from("message_votes")
    .select("value")
    .eq("message_id", messageId);
  const up = votes?.filter((v) => v.value === 1).length ?? 0;
  const down = votes?.filter((v) => v.value === -1).length ?? 0;

  await service
    .from("chat_messages")
    .update({ up_count: up, down_count: down })
    .eq("id", messageId);

  await publish(channels.chat(message.room_id), "vote", {
    messageId,
    up,
    down,
  });
  return NextResponse.json({ up, down });
}
