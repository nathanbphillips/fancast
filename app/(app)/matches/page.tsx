import type { Metadata } from "next";
import { FixtureCard } from "@/components/FixtureCard";
import { OpenWaitingButton } from "@/components/OpenWaitingButton";
import { loadFixtures } from "@/lib/db/fixtures";

/**
 * Matches: the full live + upcoming schedule (FR-1). The home page shows a
 * teaser (live + next 4) and links here for the full list. A DB failure throws
 * to the (app) error boundary rather than reading as an empty schedule.
 */

export const metadata: Metadata = { title: "Matches" };
export const revalidate = 60;

export default async function MatchesPage() {
  const { live, upcoming } = await loadFixtures();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <section aria-label="Introduction" className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Matches
        </h1>
        <p className="mt-2 text-secondary">Live now and what&apos;s coming up.</p>
      </section>

      {live.length > 0 && (
        <section aria-label="Happening now" className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
            <span className="text-gold" aria-hidden="true">
              ●
            </span>
            Happening now
          </h2>
          <div className="space-y-3">
            {live.map((w) => (
              <FixtureCard key={w.card.id} fixture={w.card} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Upcoming fixtures">
        <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
          <span aria-hidden="true">🏆</span>
          Upcoming matches
        </h2>
        {upcoming.length === 0 && live.length === 0 ? (
          <p className="rounded-xl border-[0.75px] border-line bg-surface p-4 text-sm text-secondary shadow-card">
            No fixtures on the schedule yet — check back soon.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((w) => (
              <FixtureCard
                key={w.card.id}
                fixture={w.card}
                action={
                  w.canOpen ? (
                    <OpenWaitingButton fixtureId={w.card.id} />
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
