import { brand } from "@/lib/brand";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Fixture, RoomState } from "@/lib/db/types";
import {
  FixtureCard,
  type FixtureCardData,
  type FixtureCardState,
} from "@/components/FixtureCard";

/**
 * Home: next fixtures from the DB with enterability gating by room state
 * (FR-1). Followed commentators' sessions sort first for signed-in users
 * (FR-1.3). Live data replaces the seeds when API-Football sync runs.
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

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // include fixtures from the last 3h so an in-play match stays on top
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      "*, rooms(id, state, commentator_id, commentator:profiles!rooms_commentator_id_fkey(username))",
    )
    .gte("kickoff_utc", windowStart)
    .order("kickoff_utc", { ascending: true })
    .limit(10)
    .returns<FixtureWithRooms[]>();

  const { user } = await getCurrentUserAndProfile();
  const followedIds = new Set<string>();
  if (user) {
    const { data: follows } = await supabase
      .from("follows")
      .select("commentator_id")
      .eq("follower_id", user.id);
    follows?.forEach((f) => followedIds.add(f.commentator_id));
  }

  const withFollowed = (fixtures ?? []).map((f) => {
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
    return { card, followed: room ? followedIds.has(room.commentator_id) : false };
  });

  // followed commentators' sessions first (FR-1.3); stable sort keeps
  // kickoff order within each group
  withFollowed.sort((a, b) => Number(b.followed) - Number(a.followed));
  const cards = withFollowed.map((w) => w.card);

  const live = cards.filter((c) => c.state !== "scheduled");
  const upcoming = cards.filter((c) => c.state === "scheduled");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <section aria-label="Introduction" className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
        <p className="mt-1 text-secondary">{brand.tagline}</p>
      </section>

      {live.length > 0 && (
        <section aria-label="Happening now" className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-secondary uppercase">
            Happening now
          </h2>
          <div className="space-y-3">
            {live.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Upcoming fixtures">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-secondary uppercase">
          Upcoming
        </h2>
        {upcoming.length === 0 && live.length === 0 ? (
          <p className="rounded-xl border-[0.75px] border-line bg-surface p-4 text-sm text-secondary">
            No fixtures on the schedule yet — check back soon.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
