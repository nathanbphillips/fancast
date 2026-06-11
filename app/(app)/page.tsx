import { brand } from "@/lib/brand";
import { FixtureCard, type Fixture } from "@/components/FixtureCard";

/**
 * Home page shell (Phase 1): placeholder fixtures covering all three card
 * states. Real fixtures from API-Football + enterability gating in Phase 2.
 */

const PLACEHOLDER_FIXTURES: Fixture[] = [
  {
    id: "live-demo",
    home: "Arsenal",
    away: "Chelsea",
    competition: "Premier League · Matchweek 1",
    kickoffLabel: "Today, 17:30",
    commentator: "ClockEndKev",
    state: "live",
    listeners: 47,
  },
  {
    id: "waiting-demo",
    home: "Arsenal",
    away: "Newcastle",
    competition: "Premier League · Matchweek 2",
    kickoffLabel: "Sat 22 Aug, 15:00",
    commentator: "ClockEndKev",
    state: "waiting",
  },
  {
    id: "scheduled-demo-1",
    home: "Manchester United",
    away: "Arsenal",
    competition: "Premier League · Matchweek 3",
    kickoffLabel: "Sat 29 Aug, 17:30",
    commentator: "ClockEndKev",
    state: "scheduled",
  },
  {
    id: "scheduled-demo-2",
    home: "Arsenal",
    away: "Brighton",
    competition: "Premier League · Matchweek 4",
    kickoffLabel: "Sat 12 Sep, 15:00",
    state: "scheduled",
  },
];

export default function HomePage() {
  const live = PLACEHOLDER_FIXTURES.filter((f) => f.state === "live");
  const upcoming = PLACEHOLDER_FIXTURES.filter((f) => f.state !== "live");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <section aria-label="Introduction" className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
        <p className="mt-1 text-secondary">{brand.tagline}</p>
      </section>

      {live.length > 0 && (
        <section aria-label="Live now" className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-secondary uppercase">
            Live now
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
        <div className="space-y-3">
          {upcoming.map((f) => (
            <FixtureCard key={f.id} fixture={f} />
          ))}
        </div>
      </section>
    </div>
  );
}
