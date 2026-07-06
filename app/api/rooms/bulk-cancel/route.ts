import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { isAdmin } from "@/lib/roles";
import { notifyRoomsCanceled } from "@/lib/notify/producers";

const schema = z.object({
  roomIds: z.array(z.uuid()).min(1).max(200),
});

/**
 * Bulk cancel scheduled rooms from the My rooms dashboard (FR-20.4). Every
 * room is host-gated via isRoomHost; only scheduled rooms cancel. One summary
 * count back (FR-20.7): the dashboard shows a single confirmation, never per
 * room. RSVP holders + co-hosts get room_change("canceled") per room (FR-21;
 * collapsing to one summary per recipient is a follow-up).
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const admin = isAdmin(caller.userId, caller.profile);
  let canceled = 0;
  let skipped = 0;
  const canceledIds: string[] = [];

  for (const roomId of parsed.data.roomIds) {
    const host = admin || (await isRoomHost(service, caller.userId, roomId));
    if (!host) {
      skipped++;
      continue;
    }
    const { data, error } = await service
      .from("rooms")
      .update({ state: "canceled" })
      .eq("id", roomId)
      .eq("state", "scheduled")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      skipped++;
      continue;
    }
    canceled++;
    canceledIds.push(roomId);
  }

  if (canceledIds.length > 0) {
    const actorId = caller.userId;
    after(async () => {
      await notifyRoomsCanceled(createServiceClient(), canceledIds, actorId);
    });
  }

  return NextResponse.json({ ok: true, canceled, skipped });
}
