import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { recomputeUser } from "@/lib/fanScore";
import { isRoomHost } from "@/lib/roomHosts";
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
  const ownsRoom = await isRoomHost(service, caller.userId, message.room_id);
  if (!ownsRoom && !admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const hiddenBy = admin && !ownsRoom ? "admin" : "commentator";
  // cascade the hide through the whole reply subtree (Phase 11): the RPC hides
  // every not-yet-hidden descendant and returns the affected ids so live clients
  // blank each one — matching the reload path where RLS drops the subtree
  const { data: cascadeData } = await service.rpc("hide_message_subtree", {
    p_message_id: messageId,
    p_hidden_by: hiddenBy,
  });
  const affectedIds = ((cascadeData ?? []) as { id: string }[]).map((r) => r.id);
  for (const id of affectedIds) {
    await publish(channels.chat(message.room_id), "hide", {
      messageId: id,
      hiddenBy,
    });
  }

  // FR-24.5/24.6: a hidden message and its votes drop out of the author's fan
  // score; recompute every affected author (the cascade may span authors)
  after(async () => {
    const svc = createServiceClient();
    if (affectedIds.length === 0) return;
    const { data: authors } = await svc
      .from("chat_messages")
      .select("user_id")
      .in("id", affectedIds);
    const uniq = [...new Set((authors ?? []).map((a) => a.user_id as string))];
    for (const uid of uniq) await recomputeUser(svc, uid);
  });

  return NextResponse.json({ hidden: true });
}
