import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { recomputeUser } from "@/lib/fanScore";

const bodySchema = z.object({ messageId: z.uuid() });

/**
 * Delete your OWN chat message (founder 2026-08-05). Author-only — moderation
 * lives in /api/chat/hide and is a different thing.
 *
 * Soft delete: the row stays so threaded replies aren't orphaned, but the
 * content is destroyed (body + any link preview), not just hidden. Deleting
 * also drops the message from the author's fan score.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { messageId } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select("id, room_id, user_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle<{
      id: string;
      room_id: string;
      user_id: string;
      deleted_at: string | null;
    }>();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  if (message.user_id !== caller.userId) {
    return NextResponse.json(
      { error: "You can only delete your own messages." },
      { status: 403 },
    );
  }
  if (message.deleted_at) {
    return NextResponse.json({ deleted: true }); // idempotent
  }

  // destroy the content; keep the row so the reply chain survives
  const { error } = await service
    .from("chat_messages")
    .update({
      body: "[deleted]",
      deleted_at: new Date().toISOString(),
      link_url: null,
      link_title: null,
      link_description: null,
      link_image: null,
      link_domain: null,
    })
    .eq("id", messageId)
    .eq("user_id", caller.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(channels.chat(message.room_id), "delete", { messageId });

  // a deleted message no longer counts toward the author's fan score
  after(async () => {
    await recomputeUser(createServiceClient(), caller.userId).catch(() => {});
  });

  return NextResponse.json({ deleted: true });
}
