import {
  createServiceClient,
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { friendIdsOf } from "@/lib/friends";
import type { RoomState } from "@/lib/db/types";

/**
 * Date-grouped schedule for /matches (FR-22.4): every fixture with its rooms
 * beneath it. Multiple rooms per fixture render together; fixtures with no
 * rooms still show (schedule info, no join affordance). RSVP counts come from
 * the denormalized rooms.rsvp_count; the viewer's own RSVP state is resolved
 * from their room_rsvps rows (own-only RLS).
 */

export type ScheduleRoom = {
  id: string;
  slug: string;
  state: RoomState;
  hostUsername: string;
  /** all accepted hosts, creator first (FR-25.4 both-badge display) */
  hostUsernames: string[];
  blurb: string | null;
  rsvpCount: number;
  viewerRsvped: boolean;
  postponed: boolean;
  /** the viewer's accepted friends among this room's RSVPs (FR-22.3 chips) */
  friendNames: string[];
};

export type ScheduleFixture = {
  id: number;
  home: string;
  away: string;
  competition: string | null;
  kickoffUtc: string;
  rooms: ScheduleRoom[];
};

export type ScheduleGroup = {
  label: string;
  fixtures: ScheduleFixture[];
};

type FixtureRow = {
  id: number;
  home_team: string;
  away_team: string;
  competition: string | null;
  kickoff_utc: string;
  rooms: {
    id: string;
    slug: string | null;
    state: RoomState;
    blurb: string | null;
    postponed: boolean;
    rsvp_count: number;
    commentator: { username: string } | null;
  }[];
};

const HIDDEN_STATES: RoomState[] = ["canceled", "wrapped"];

/** London calendar day (yyyy-mm-dd) for grouping. */
function londonDayKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Today" / "Tomorrow" / "Sat 5 Jul" for a London day key. */
function dayLabel(dayKey: string, todayKey: string, tomorrowKey: string): string {
  if (dayKey === todayKey) return "Today";
  if (dayKey === tomorrowKey) return "Tomorrow";
  // dayKey is yyyy-mm-dd (London); render as "Sat 5 Jul"
  const d = new Date(`${dayKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(d);
}

export async function loadMatchesSchedule(): Promise<ScheduleGroup[]> {
  const supabase = await createSupabaseServerClient();

  // last 3h (keep an in-play match on the board) through the next 60 days
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(
    Date.now() + 60 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      "id, home_team, away_team, competition, kickoff_utc, rooms(id, slug, state, blurb, postponed, rsvp_count, commentator:profiles!rooms_commentator_id_fkey(username))",
    )
    .gte("kickoff_utc", windowStart)
    .lte("kickoff_utc", windowEnd)
    .order("kickoff_utc", { ascending: true })
    .returns<FixtureRow[]>();
  // a real DB failure must surface to the error boundary, not read as empty
  if (error) throw error;

  // the viewer's own RSVPs (to mark "counted in")
  const { user } = await getCurrentUserAndProfile();
  const rsvpedRoomIds = new Set<string>();
  if (user) {
    const { data: myRsvps } = await supabase
      .from("room_rsvps")
      .select("room_id")
      .eq("user_id", user.id);
    for (const r of myRsvps ?? []) rsvpedRoomIds.add(r.room_id as string);
  }

  // friend chips (FR-22.3): the viewer's accepted friends among each room's
  // RSVPs. room_rsvps is own-only under RLS, so this viewer-scoped join uses
  // the service role but only ever reveals the viewer's OWN friends.
  const friendRsvpNames = new Map<string, string[]>(); // roomId -> usernames
  if (user) {
    const allRoomIds = (fixtures ?? []).flatMap((f) =>
      (f.rooms ?? []).map((r) => r.id),
    );
    const service = createServiceClient();
    const friendIds = await friendIdsOf(service, user.id);
    if (friendIds.length > 0 && allRoomIds.length > 0) {
      const { data: fr } = await service
        .from("room_rsvps")
        .select(
          "room_id, user:profiles!room_rsvps_user_id_fkey(username)",
        )
        .in("room_id", allRoomIds)
        .in("user_id", friendIds);
      for (const r of fr ?? []) {
        const name = (r.user as unknown as { username: string } | null)
          ?.username;
        if (!name) continue;
        const roomId = r.room_id as string;
        const list = friendRsvpNames.get(roomId) ?? [];
        list.push(name);
        friendRsvpNames.set(roomId, list);
      }
    }
  }

  // accepted hosts per room (FR-25.4): both badges. room_hosts is world-readable.
  const allRoomIds2 = (fixtures ?? []).flatMap((f) =>
    (f.rooms ?? []).map((r) => r.id),
  );
  const hostsByRoom = new Map<string, string[]>();
  if (allRoomIds2.length > 0) {
    const { data: hostRows } = await supabase
      .from("room_hosts")
      .select(
        "room_id, created_at, host:profiles!room_hosts_user_id_fkey(username)",
      )
      .in("room_id", allRoomIds2)
      .eq("status", "accepted")
      .order("created_at", { ascending: true });
    for (const h of hostRows ?? []) {
      const name = (h.host as unknown as { username: string } | null)?.username;
      if (!name) continue;
      const list = hostsByRoom.get(h.room_id as string) ?? [];
      list.push(name);
      hostsByRoom.set(h.room_id as string, list);
    }
  }

  const todayKey = londonDayKey(new Date().toISOString());
  const tomorrowKey = londonDayKey(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  );

  const groups = new Map<string, ScheduleFixture[]>();
  for (const f of fixtures ?? []) {
    const rooms: ScheduleRoom[] = (f.rooms ?? [])
      .filter((r) => !HIDDEN_STATES.includes(r.state) && r.slug)
      .map((r) => ({
        id: r.id,
        slug: r.slug as string,
        state: r.state,
        hostUsername: r.commentator?.username ?? "unknown",
        hostUsernames:
          hostsByRoom.get(r.id) ??
          (r.commentator?.username ? [r.commentator.username] : []),
        blurb: r.blurb,
        rsvpCount: r.rsvp_count ?? 0,
        viewerRsvped: rsvpedRoomIds.has(r.id),
        postponed: r.postponed,
        friendNames: friendRsvpNames.get(r.id) ?? [],
      }))
      // live-ish rooms first, then scheduled
      .sort(
        (a, b) =>
          Number(b.state !== "scheduled") - Number(a.state !== "scheduled"),
      );

    const key = londonDayKey(f.kickoff_utc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: f.id,
      home: f.home_team,
      away: f.away_team,
      competition: f.competition,
      kickoffUtc: f.kickoff_utc,
      rooms,
    });
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, fixtures]) => ({
      label: dayLabel(key, todayKey, tomorrowKey),
      fixtures,
    }));
}
