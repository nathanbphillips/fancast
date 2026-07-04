import type { SupabaseClient } from "@supabase/supabase-js";
import { roomSlugBase } from "@/lib/slug";
import type { Room, RoomState } from "@/lib/db/types";

/**
 * The one way a room row comes into existence (FR-19.3/19.4): every path
 * (commentator create, open-waiting shortcut, admin game) gets an immutable
 * unique slug and an accepted room_hosts row for the creator. rooms.slug is
 * NOT NULL, so inserting anywhere else breaks by design.
 */

export async function generateUniqueSlug(
  service: SupabaseClient,
  home: string,
  away: string,
  kickoffUtc: string | Date,
  creatorUsername: string,
): Promise<string> {
  const base = roomSlugBase(home, away, kickoffUtc, creatorUsername);
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data } = await service
      .from("rooms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n}`;
  }
  // pathological collision storm: fall back to a random suffix
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function insertRoomWithHost(
  service: SupabaseClient,
  args: {
    fixtureId: number;
    creatorId: string;
    creatorUsername: string;
    homeTeam: string;
    awayTeam: string;
    kickoffUtc: string;
    state: RoomState;
    broadcastStart?: string | null;
    blurb?: string | null;
    openedAt?: string | null;
  },
): Promise<{ room: Room | null; error: string | null }> {
  const slug = await generateUniqueSlug(
    service,
    args.homeTeam,
    args.awayTeam,
    args.kickoffUtc,
    args.creatorUsername,
  );

  const { data: room, error } = await service
    .from("rooms")
    .insert({
      fixture_id: args.fixtureId,
      commentator_id: args.creatorId,
      state: args.state,
      scheduled_kickoff: args.kickoffUtc,
      slug,
      broadcast_start: args.broadcastStart ?? null,
      blurb: args.blurb ?? null,
      opened_at: args.openedAt ?? null,
    })
    .select()
    .single<Room>();
  if (error || !room) {
    return { room: null, error: error?.message ?? "Couldn't create the room." };
  }

  // creator is an accepted host (equal hosts, FR-19.4); best-effort but loud:
  // a room without its host row would break isRoomHost gating
  const { error: hostErr } = await service.from("room_hosts").insert({
    room_id: room.id,
    user_id: args.creatorId,
    status: "accepted",
    responded_at: new Date().toISOString(),
  });
  if (hostErr) {
    console.error("room_hosts insert failed for room", room.id, hostErr);
  }

  return { room, error: null };
}
