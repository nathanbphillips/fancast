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

  // Mutate the vote row and recompute the denormalized counts atomically
  // under a parent-row lock (M-3, audit) — vote rows stay the source of truth.
  const { data, error } = await service
    .rpc("cast_message_vote", {
      p_message_id: messageId,
      p_user_id: caller.userId,
      p_value: value,
    })
    .single<{ up: number; down: number }>();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Vote failed." },
      { status: 500 },
    );
  }
  const { up, down } = data;

  await publish(channels.chat(message.room_id), "vote", {
    messageId,
    up,
    down,
  });
  return NextResponse.json({ up, down });
}
