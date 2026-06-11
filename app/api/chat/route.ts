import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { ChatMessage } from "@/lib/db/types";

const bodySchema = z.object({
  roomId: z.uuid(),
  body: z.string().trim().min(1).max(500),
});

/** Send a chat message. Rate limit (FR-8.5): 1 msg / 2s, burst 3 —
 *  approximated as max 3 messages in any rolling 6s window. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  const { roomId, body } = parsed.data;

  const service = createServiceClient();

  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (room.state === "wrapped") {
    return NextResponse.json(
      { error: "This room has ended." },
      { status: 403 },
    );
  }

  const windowStart = new Date(Date.now() - 6000).toISOString();
  const { count: recent } = await service
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .gte("created_at", windowStart);
  if ((recent ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Easy — you're sending too fast." },
      { status: 429 },
    );
  }

  const { data: message, error } = await service
    .from("chat_messages")
    .insert({
      room_id: roomId,
      user_id: caller.userId,
      body,
      is_waiting_room: room.state === "waiting",
    })
    .select("*, author:profiles!chat_messages_user_id_fkey(username, role)")
    .single<ChatMessage>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(channels.chat(roomId), "message", message);
  return NextResponse.json({ message }, { status: 201 });
}
