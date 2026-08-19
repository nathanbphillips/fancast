import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUserAndProfile } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { MatchFactRow } from "@/components/MatchFactRow";
import { getMatchFacts, groupFacts, type MatchFactSet } from "@/lib/matchFacts";

export const metadata: Metadata = { title: "Match facts" };
// always fresh on load; the fetch layer caches upstream calls for 10 minutes
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Every match fact we can see, for every upcoming fixture (founder 2026-08-19).
 * A standing reference rather than a matchday tool: open it any time to see
 * what talking points exist for the games coming up.
 *
 * Fixtures come from OUR synced table, so this shows what the platform actually
 * knows about rather than whatever Sportmonks happens to return. Facts are
 * fetched per fixture in parallel and capped, because each one is a metered
 * call against the add-on; lib/matchFacts caches them for 10 minutes so a
 * refresh is nearly free.
 */

// enough to cover a full matchweek without turning a page load into 40 calls
const MAX_FIXTURES = 12;
const WINDOW_DAYS = 21;

type Row = {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  competition: string;
  sportmonks_fixture_id: number | null;
};

/** London calendar day, so "today" and "tomorrow" mean the day, not 24h bands. */
function londonDayNumber(d: Date): number {
  const s = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
  return Math.floor(Date.parse(`${s}T00:00:00Z`) / 864e5);
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const when = d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Rounding elapsed hours called an 8pm kickoff "tomorrow" when read in the
  // morning, so compare calendar days instead.
  const days = londonDayNumber(d) - londonDayNumber(new Date());
  const rel =
    days < 0 ? "earlier" : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `${when} · ${rel}`;
}

export default async function AdminMatchFactsPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) redirect("/");

  const service = createServiceClient();
  const from = new Date(Date.now() - 3 * 3600_000).toISOString();
  const to = new Date(Date.now() + WINDOW_DAYS * 864e5).toISOString();
  // The cap is deliberate (one metered call per fixture), so the page has to
  // say how many it left out rather than presenting 12 as the whole slate.
  const { data, count } = await service
    .from("fixtures")
    .select("id, home_team, away_team, kickoff_utc, competition, sportmonks_fixture_id", {
      count: "exact",
    })
    .gte("kickoff_utc", from)
    .lte("kickoff_utc", to)
    .order("kickoff_utc", { ascending: true })
    .limit(MAX_FIXTURES);
  const fixtures = (data ?? []) as Row[];
  const totalUpcoming = count ?? fixtures.length;
  const notShown = Math.max(0, totalUpcoming - fixtures.length);

  // one metered call each, in parallel, all failures contained
  const sets = await Promise.all(
    fixtures.map(async (f): Promise<MatchFactSet | { error: string }> => {
      if (f.sportmonks_fixture_id == null) return { error: "not linked to Sportmonks" };
      try {
        return await getMatchFacts(f.sportmonks_fixture_id);
      } catch (e) {
        return { error: (e as Error).message };
      }
    }),
  );

  const withFacts = sets.filter((s) => "facts" in s && s.facts.length > 0).length;
  const totalFacts = sets.reduce((n, s) => n + ("facts" in s ? s.facts.length : 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin" className="text-sm text-secondary transition-colors hover:text-primary">
        ← Admin
      </Link>
      <h1 className="t-h2 mt-2">Match facts</h1>
      <p className="mt-1.5 text-[15px] text-secondary">
        Pre-written talking points from the Sportmonks Match Facts add-on.{" "}
        <span className="tabular-nums">{totalFacts}</span> facts across{" "}
        <span className="tabular-nums">{withFacts}</span> of the next{" "}
        <span className="tabular-nums">{fixtures.length}</span> fixtures.
      </p>
      <p className="mt-1 text-xs text-secondary">
        Facts are generated close to kickoff, so fixtures further out are
        normally empty. Hosts see the same list in the room&apos;s Match Facts
        tab.
        {notShown > 0 && (
          <>
            {" "}
            <span className="text-primary">
              {notShown} further fixture{notShown === 1 ? "" : "s"} in the next{" "}
              {WINDOW_DAYS} days {notShown === 1 ? "is" : "are"} not shown
            </span>{" "}
            (each one costs a metered call, so the page loads the nearest{" "}
            {MAX_FIXTURES}).
          </>
        )}
      </p>

      {fixtures.length === 0 && (
        <p className="mt-8 rounded-xl border border-line bg-surface p-6 text-center text-sm text-secondary">
          No upcoming fixtures in the window. Run a fixture sync.
        </p>
      )}

      <div className="mt-7 space-y-4">
        {fixtures.map((f, i) => {
          const set = sets[i];
          const failed = "error" in set;
          const facts = failed ? [] : set.facts;
          return (
            <section key={f.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-[17px] font-bold">
                  {f.home_team} vs {f.away_team}
                </h2>
                <span className="font-mono text-[11px] text-secondary tabular-nums">
                  {facts.length} facts
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-secondary tabular-nums">
                {whenLabel(f.kickoff_utc)} · {f.competition}
              </p>

              {failed && (
                <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
                  Couldn&apos;t load: {set.error}
                </p>
              )}
              {!failed && set.stale && (
                <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
                  Showing the last set we loaded; the live fetch didn&apos;t
                  come back.
                </p>
              )}
              {!failed && facts.length === 0 && (
                <p className="mt-3 text-sm text-secondary">
                  No facts published for this fixture yet.
                </p>
              )}

              {groupFacts(facts).map((g) => (
                <div key={g.category} className="mt-3">
                  <h3 className="mb-1.5 font-mono text-[10px] font-bold tracking-[0.08em] text-secondary uppercase">
                    {g.label} <span className="tabular-nums">({g.facts.length})</span>
                  </h3>
                  <ul className="space-y-1">
                    {g.facts.map((fact) => (
                      <MatchFactRow key={fact.id} text={fact.text} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
