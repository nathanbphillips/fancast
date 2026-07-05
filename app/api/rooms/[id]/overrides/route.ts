import { NextResponse, type NextRequest } from "next/server";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";
import { statOverridesSchema, type StatOverrides } from "@/lib/statOverrides";

/**
 * Commentator overrides for the Info + Line-ups panels (Phase 11).
 *   GET — current overrides (public; the room also seeds them server-side).
 *   PUT — replace the overrides (room commentator or admin only). Persists to
 *         room_stat_overrides, then publishes on the control channel so every
 *         listener merges the correction live.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("room_stat_overrides")
    .select("overrides")
    .eq("room_id", id)
    .maybeSingle<{ overrides: StatOverrides }>();
  return NextResponse.json({ overrides: data?.overrides ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = statOverridesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid overrides." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, commentator_id")
    .eq("id", id)
    .maybeSingle<{ id: string; commentator_id: string }>();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!(await isRoomHost(service, caller.userId, room.id)) && !isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const overrides = parsed.data;
  const { error } = await service.from("room_stat_overrides").upsert(
    {
      room_id: room.id,
      overrides,
      updated_at: new Date().toISOString(),
      updated_by: caller.userId,
    },
    { onConflict: "room_id" },
  );
  if (error) return NextResponse.json({ error: "Save failed." }, { status: 500 });

  await publish(channels.control(room.id), "stat_overrides", {
    overrides,
    ts: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
