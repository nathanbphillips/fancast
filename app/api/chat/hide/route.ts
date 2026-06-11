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
  if (caller.profile.role !== "commentator" && !admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { messageId } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select("id, room_id, hidden_by")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const hiddenBy = admin && caller.profile.role !== "commentator" ? "admin" : "commentator";
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
