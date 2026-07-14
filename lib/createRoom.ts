import type { SupabaseClient } from "@supabase/supabase-js";
import { roomSlugBase, roomSlugBaseDiscussion } from "@/lib/slug";
import type { Room, RoomKind, RoomState } from "@/lib/db/types";

/**
 * The one way a room row comes into existence (FR-19.3/19.4): every path
 * (commentator create, open-waiting shortcut, admin game) gets an immutable
 * unique slug and an accepted room_hosts row for the creator. rooms.slug is
 * NOT NULL, so inserting anywhere else breaks by design.
 */

export async function generateUniqueSlug(
  service: SupabaseClient,
  base: string,
): Promise<string> {
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
    /** 'match' (default) links a fixture; 'discussion' is a free-topic room */
    kind?: RoomKind;
    /** the room's own fixture (match rooms); null/omitted for discussion */
    fixtureId?: number | null;
    /** OPTIONAL stats-only fixture a discussion room is watching */
    linkedFixtureId?: number | null;
    /** discussion room's free-text name (drives its slug + display) */
    title?: string | null;
    creatorId: string;
    creatorUsername: string;
    /** match rooms only — used to build the {home}-vs-{away} slug */
    homeTeam?: string | null;
    awayTeam?: string | null;
    kickoffUtc: string;
    state: RoomState;
    broadcastStart?: string | null;
    blurb?: string | null;
    openedAt?: string | null;
    /** season-hosting provenance (FR-20.4); null for manual rooms */
    subscriptionId?: string | null;
  },
): Promise<{ room: Room | null; error: string | null }> {
  const kind: RoomKind = args.kind ?? "match";
  const base =
    kind === "discussion"
      ? roomSlugBaseDiscussion(
          args.title ?? "room",
          args.kickoffUtc,
          args.creatorUsername,
        )
      : roomSlugBase(
          args.homeTeam ?? "",
          args.awayTeam ?? "",
          args.kickoffUtc,
          args.creatorUsername,
        );
  const slug = await generateUniqueSlug(service, base);

  const { data: room, error } = await service
    .from("rooms")
    .insert({
      fixture_id: args.fixtureId ?? null,
      kind,
      title: args.title ?? null,
      linked_fixture_id: args.linkedFixtureId ?? null,
      commentator_id: args.creatorId,
      state: args.state,
      scheduled_kickoff: args.kickoffUtc,
      slug,
      broadcast_start: args.broadcastStart ?? null,
      blurb: args.blurb ?? null,
      opened_at: args.openedAt ?? null,
      subscription_id: args.subscriptionId ?? null,
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
