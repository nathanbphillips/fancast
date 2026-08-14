import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { identityUserId, keepOnlyPublisher } from "@/lib/livekit";

/**
 * "I'm the one on air" — called by a client right after it publishes its mic.
 * Revokes publish on every OTHER connection this account holds in the room, so
 * one account is only ever on air from one device (founder 2026-08-05). The
 * per-user accept event reaches all of their tabs/devices, so without this they
 * would each open a microphone.
 */
const schema = z.object({
  roomId: z.uuid(),
  identity: z.string().min(1).max(120),
});

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, identity } = parsed.data;

  // the identity must actually belong to the caller — otherwise this would be a
  // way to silence someone else's connections
  if (identityUserId(identity) !== caller.userId) {
    return NextResponse.json({ error: "Not your connection." }, { status: 403 });
  }

  // only somebody entitled to publish may claim: an accepted caller or a host
  const service = createServiceClient();
  const { data: accepted } = await service
    .from("talk_requests")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .eq("status", "accepted")
    .limit(1);
  const { data: host } = await service
    .from("room_hosts")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", caller.userId)
    .eq("status", "accepted")
    .maybeSingle();
  if ((accepted ?? []).length === 0 && !host) {
    return NextResponse.json({ error: "Not on air." }, { status: 403 });
  }

  await keepOnlyPublisher(roomId, caller.userId, identity);
  return NextResponse.json({ ok: true });
}
