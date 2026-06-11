import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const bodySchema = z.object({
  userId: z.uuid(),
  roomId: z.uuid(),
});

/** Admin purge (FR-8.4): hide all of a user's messages in a session. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { userId, roomId } = parsed.data;

  const service = createServiceClient();
  const { data: hidden } = await service
    .from("chat_messages")
    .update({ hidden_by: "admin", hidden_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .is("hidden_by", null)
    .select("id");

  for (const m of hidden ?? []) {
    await publish(channels.chat(roomId), "hide", {
      messageId: m.id,
      hiddenBy: "admin",
    });
  }

  return NextResponse.json({ purged: hidden?.length ?? 0 });
}
