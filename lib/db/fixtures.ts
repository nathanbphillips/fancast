import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Fixture, RoomState } from "@/lib/db/types";
import type {
  FixtureCardData,
  FixtureCardState,
} from "@/components/FixtureCard";

/**
 * Shared loader for the home teaser and the /matches schedule (FR-1). Returns
 * live + upcoming Arsenal fixtures with enterability gating by room state, and
 * followed commentators' sessions sorted first for signed-in users (FR-1.3).
 */

type FixtureWithRooms = Fixture & {
  rooms: {
    id: string;
    state: RoomState;
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
  /** commentator's own open-waiting affordance for this fixture */
  canOpen: boolean;
  followed: boolean;
};

export async function loadFixtures(): Promise<{
  live: HomeFixture[];
  upcoming: HomeFixture[];
}> {
  const supabase = await createSupabaseServerClient();

  // include fixtures from the last 3h so an in-play match stays on top
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      "*, rooms(id, state, commentator_id, commentator:profiles!rooms_commentator_id_fkey(username))",
    )
    .gte("kickoff_utc", windowStart)
    .order("kickoff_utc", { ascending: true })
    .limit(10)
    .returns<FixtureWithRooms[]>();
  // surface a real DB failure to the error boundary (vs a genuinely empty
  // schedule, which must read as "no fixtures yet")
  if (error) throw error;

  const { user, profile } = await getCurrentUserAndProfile();
  const followedIds = new Set<string>();
  if (user) {
    const { data: follows } = await supabase
      .from("follows")
      .select("commentator_id")
      .eq("follower_id", user.id);
    follows?.forEach((f) => followedIds.add(f.commentator_id));
  }

  const viewerIsCommentator = profile?.role === "commentator";

  const withFollowed: HomeFixture[] = (fixtures ?? []).map((f) => {
    const room = f.rooms[0];
    const card: FixtureCardData = {
      id: f.id,
      home: f.home_team,
      away: f.away_team,
      competition: f.round ? `${f.competition} · ${f.round}` : f.competition,
      kickoffUtc: f.kickoff_utc,
      commentator: room?.commentator?.username,
      state: cardState(room?.state),
      roomHref: room ? `/room/${room.id}` : undefined,
    };
    const ownRoom = f.rooms.find((r) => r.commentator_id === user?.id);
    const canOpen =
      viewerIsCommentator && (!ownRoom || ownRoom.state === "scheduled");
    return {
      card,
      canOpen,
      followed: room ? followedIds.has(room.commentator_id) : false,
    };
  });

  // followed commentators first (FR-1.3); stable sort keeps kickoff order
  withFollowed.sort((a, b) => Number(b.followed) - Number(a.followed));

  return {
    live: withFollowed.filter((w) => w.card.state !== "scheduled"),
    upcoming: withFollowed.filter((w) => w.card.state === "scheduled"),
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
 *  "N LIVE" pill. Head-count only — cheap enough for the shared layout. */
export async function countLiveRooms(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .in("state", OPEN_ROOM_STATES);
  return count ?? 0;
}
