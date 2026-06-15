import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const bodySchema = z.object({ messageId: z.uuid() });

/** Commentator instant-hide / admin hide (FR-8.4). */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const admin = isAdmin(caller.userId, caller.profile);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { messageId } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select(
      "id, room_id, hidden_by, room:rooms!chat_messages_room_id_fkey(commentator_id)",
    )
    .eq("id", messageId)
    .maybeSingle<{
      id: string;
      room_id: string;
      hidden_by: string | null;
      room: { commentator_id: string };
    }>();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  // room-scoped: only THIS room's commentator (or an admin) may hide here —
  // the global commentator role alone is not enough (cross-room hide hole)
  const ownsRoom = message.room.commentator_id === caller.userId;
  if (!ownsRoom && !admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const hiddenBy = admin && !ownsRoom ? "admin" : "commentator";
  if (message.hidden_by === null) {
    await service
      .from("chat_messages")
      .update({ hidden_by: hiddenBy, hidden_at: new Date().toISOString() })
      .eq("id", messageId);
    await publish(channels.chat(message.room_id), "hide", {
      messageId,
      hiddenBy,
    });
  }

  return NextResponse.json({ hidden: true });
}
