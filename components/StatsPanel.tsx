/**
 * Stats panel shell (Phase 1: static placeholders).
 * Live API-Football data, events timeline, and XI tabs arrive in Phase 7.
 */

// pre-match defaults: zeros, possession 50/50 — live values arrive from
// API-Football at kickoff (Phase 7)
const PLACEHOLDER_STATS: { label: string; home: number; away: number }[] = [
  { label: "Possession", home: 50, away: 50 },
  { label: "Shots", home: 0, away: 0 },
  { label: "On target", home: 0, away: 0 },
  { label: "Corners", home: 0, away: 0 },
  { label: "Fouls", home: 0, away: 0 },
];

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePct = total === 0 ? 50 : (home / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold tabular-nums">{home}</span>
        <span className="text-secondary">{label}</span>
        <span className="font-semibold tabular-nums">{away}</span>
      </div>
      <div
        className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`${label}: ${home} home, ${away} away`}
      >
        <span className="bg-red" style={{ width: `${homePct}%` }} />
        <span className="bg-navy" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

export function StatsPanel() {
  return (
    <div className="space-y-4 p-3">
      <section aria-label="Match stats" className="rounded-xl border-[0.75px] border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold">Match stats</h2>
        <div className="space-y-3">
          {PLACEHOLDER_STATS.map((s) => (
            <StatBar key={s.label} {...s} />
          ))}
        </div>
        <p className="mt-3 text-xs text-secondary">
          Live match data arrives at kickoff.
        </p>
      </section>
      <section aria-label="Lineups" className="rounded-xl border-[0.75px] border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold">Lineups</h2>
        <p className="text-sm text-secondary">
          Home and away XIs with formations arrive in Phase 7.
        </p>
      </section>
    </div>
  );
}
