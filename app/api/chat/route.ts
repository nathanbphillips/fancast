import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { ChatMessage } from "@/lib/db/types";

const bodySchema = z.object({
  roomId: z.uuid(),
  body: z.string().trim().min(1).max(500),
  // Phase 11: a threaded reply targets a parent message in the same room
  parentId: z.uuid().optional(),
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
  const { roomId, body, parentId } = parsed.data;

  const service = createServiceClient();

  const { data: room } = await service
    .from("rooms")
    .select("id, state, commentator_id, chat_open")
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
  if (room.state === "scheduled") {
    return NextResponse.json(
      { error: "This room hasn't opened yet." },
      { status: 403 },
    );
  }
  // waiting room: commentator-only chat (FR-3.2) unless the commentator
  // opened chat early (founder decision 2026-06-11)
  if (
    room.state === "waiting" &&
    !room.chat_open &&
    room.commentator_id !== caller.userId
  ) {
    return NextResponse.json(
      { error: "Chat opens when the broadcast starts." },
      { status: 403 },
    );
  }

  // a reply must point at a message in this room; the DB trigger fills
  // root_id/depth, and a depth ceiling stops pathological self-reply chains
  if (parentId) {
    const { data: parent } = await service
      .from("chat_messages")
      .select("room_id, depth, hidden_by")
      .eq("id", parentId)
      .maybeSingle<{ room_id: string; depth: number; hidden_by: string | null }>();
    if (!parent || parent.room_id !== roomId) {
      return NextResponse.json({ error: "Reply target not found." }, { status: 404 });
    }
    if (parent.hidden_by !== null) {
      return NextResponse.json(
        { error: "You can't reply to a hidden message." },
        { status: 409 },
      );
    }
    if (parent.depth >= 40) {
      return NextResponse.json(
        { error: "This thread is too deep to reply to." },
        { status: 422 },
      );
    }
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
      parent_id: parentId ?? null,
    })
    .select("*, author:profiles!chat_messages_user_id_fkey(username, role)")
    .single<ChatMessage>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(channels.chat(roomId), "message", message);
  return NextResponse.json({ message }, { status: 201 });
}
