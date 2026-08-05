import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { isAdmin } from "@/lib/roles";
import { muteParticipantMic } from "@/lib/livekit";

/**
 * Host control: mute / unmute an on-air guest (founder 2026-08-05). Host-gated;
 * the guest keeps their slot and can be unmuted, unlike ending the call.
 */
const schema = z.object({
  roomId: z.uuid(),
  userId: z.string().min(1).max(64),
  muted: z.boolean(),
});

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, userId, muted } = parsed.data;

  const service = createServiceClient();
  if (
    !(await isRoomHost(service, caller.userId, roomId)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  }

  const ok = await muteParticipantMic(roomId, userId, muted);
  if (!ok) {
    return NextResponse.json(
      { error: "They're not on air right now." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, muted });
}
