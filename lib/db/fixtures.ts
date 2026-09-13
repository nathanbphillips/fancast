import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { competitionLine } from "@/lib/strings/competition";
import type { Fixture, RoomState } from "@/lib/db/types";

/** Home-teaser fixture card shape (was in the now-removed FixtureCard). */
export type FixtureCardState = "scheduled" | "waiting" | "live";
export type FixtureCardData = {
  id: number;
  home: string;
  away: string;
  competition: string;
  kickoffUtc: string;
  commentator?: string;
  state: FixtureCardState;
  roomHref?: string;
  listeners?: number;
};

/**
 * Shared loader for the home teaser and the /matches schedule (FR-1). Returns
 * live + upcoming Arsenal fixtures with enterability gating by room state, and
 * followed commentators' sessions sorted first for signed-in users (FR-1.3).
 */

type FixtureWithRooms = Fixture & {
  rooms: {
    id: string;
    slug: string | null;
    state: RoomState;
    postponed: boolean;
    broadcast_start: string | null;
    commentator_id: string;
    commentator: { username: string } | null;
  }[];
};

const LIVE_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

function cardState(roomState: RoomState | undefined): FixtureCardState {
  if (!roomState) return "scheduled";
  if (roomState === "waiting") return "waiting";
  if (LIVE_STATES.includes(roomState)) return "live";
  return "scheduled"; // scheduled or wrapped
}

export type HomeFixture = {
  card: FixtureCardData;
  followed: boolean;
};

export async function loadFixtures(): Promise<{
  live: HomeFixture[];
  upcoming: HomeFixture[];
}> {
  const supabase = await createSupabaseServerClient();

  // Programme front page (founder 2026-09-13): ONLY fixtures somebody is
  // broadcasting - a game with no room does not make the page, whoever is
  // playing - and EVERY scheduled broadcast on the books shows (the founder
  // rooms the whole season; hiding one behind a page cap is what this change
  // exists to stop). The 3h look-back keeps an in-play room on top; the inner
  // join, state list and postponed filter keep dead rooms from reviving a
  // fixture OR eating a row of the cap. The cap is a sanity backstop, far
  // above the fixture sync's ~120-day horizon, not a paging device.
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      "*, rooms!inner(id, slug, state, postponed, broadcast_start, commentator_id, commentator:profiles!rooms_commentator_id_fkey(username))",
    )
    .gte("kickoff_utc", windowStart)
    .in("rooms.state", [
      "scheduled",
      "waiting",
      "pregame",
      "live_1h",
      "halftime",
      "live_2h",
      "extra_time",
      "postgame",
    ])
    .eq("rooms.postponed", false)
    .order("kickoff_utc", { ascending: true })
    .limit(50)
    .returns<FixtureWithRooms[]>();
  // surface a real DB failure to the error boundary (vs a genuinely empty
  // schedule, which must read as "no broadcasts yet")
  if (error) throw error;
  const merged: FixtureWithRooms[] = fixtures ?? [];

  const { user } = await getCurrentUserAndProfile();
  const followedIds = new Set<string>();
  if (user) {
    const { data: follows } = await supabase
      .from("follows")
      .select("commentator_id")
      .eq("follower_id", user.id);
    follows?.forEach((f) => followedIds.add(f.commentator_id));
  }

  const withFollowed: HomeFixture[] = merged.map((f) => {
    // multiple rooms per fixture are possible now (FR-19); until PRD-05's
    // multi-room cards land, the card carries the most-advanced ACTIVE room.
    // A scheduled room only counts as a no-show by the platform's own rule
    // (the sweep in lib/fixtures.ts): kickoff AND broadcast start both 2h
    // gone - so a late-opening host, or a deliberate post-game-only show
    // whose start sits after kickoff, stays on the books here exactly as
    // long as it does on /matches and in the sweep.
    const twoH = 2 * 60 * 60 * 1000;
    const kickoffMs = new Date(f.kickoff_utc).getTime();
    const noShow = (start: string | null) =>
      Date.now() > kickoffMs + twoH &&
      Date.now() > (start ? new Date(start).getTime() : kickoffMs) + twoH;
    const activeRooms = f.rooms.filter(
      (r) =>
        r.state !== "canceled" &&
        r.state !== "wrapped" &&
        !r.postponed &&
        !(r.state === "scheduled" && noShow(r.broadcast_start)),
    );
    const room =
      activeRooms.find((r) => r.state !== "scheduled") ?? activeRooms[0];
    const card: FixtureCardData = {
      id: f.id,
      home: f.home_team,
      away: f.away_team,
      competition: competitionLine(f.competition, f.round),
      kickoffUtc: f.kickoff_utc,
      commentator: room?.commentator?.username,
      state: cardState(room?.state),
      // canonical slug URL (FR-19.3); id fallback covers any pre-0027 cache
      roomHref: room ? `/room/${room.slug ?? room.id}` : undefined,
    };
    return {
      card,
      followed: room ? followedIds.has(room.commentator_id) : false,
    };
  });

  // rooms-only page: a fixture whose every room fell to the active filter
  // above (postponed, or a scheduled room that no-showed past kickoff) has
  // nothing to broadcast and drops off with the rest
  const broadcasts = withFollowed.filter((w) => w.card.roomHref);

  // followed commentators first (FR-1.3); stable sort keeps kickoff order
  broadcasts.sort((a, b) => Number(b.followed) - Number(a.followed));

  return {
    live: broadcasts.filter((w) => w.card.state !== "scheduled"),
    upcoming: broadcasts.filter((w) => w.card.state === "scheduled"),
  };
}

const OPEN_ROOM_STATES: RoomState[] = [
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

/** Count of currently-open rooms (waiting through post-game) for the nav
 *  "N LIVE" pill. Head-count only, cheap enough for the shared layout. */
export async function countLiveRooms(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .in("state", OPEN_ROOM_STATES);
  return count ?? 0;
}
