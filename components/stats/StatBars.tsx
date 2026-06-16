import type { StatBar } from "@/lib/stats";

/**
 * Compact stacked home-vs-away stat bars. pct stats (possession, pass
 * accuracy) use the raw home value as the bar width; count stats split
 * proportionally by total. The colored segments carry no text, so AA contrast
 * holds in both themes. `size="radio"` enlarges everything for background
 * listening.
 */
export function StatBars({
  stats,
  size = "compact",
}: {
  stats: StatBar[];
  size?: "compact" | "radio";
}) {
  const big = size === "radio";
  return (
    <div className={big ? "space-y-5" : "space-y-3"}>
      {stats.map((s) => {
        const total = s.home + s.away;
        const homePct =
          s.unit === "pct"
            ? Math.max(0, Math.min(100, s.home))
            : total === 0
              ? 50
              : (s.home / total) * 100;
        const fmt = (v: number) => (s.unit === "pct" ? `${v}%` : `${v}`);
        return (
          <div key={s.code}>
            <div
              className={`flex justify-between ${big ? "text-base" : "text-xs"}`}
            >
              <span className="font-semibold tabular-nums">{fmt(s.home)}</span>
              <span className="text-secondary">{s.label}</span>
              <span className="font-semibold tabular-nums">{fmt(s.away)}</span>
            </div>
            <div
              className={`mt-1 flex overflow-hidden rounded-full bg-raised ${big ? "h-3" : "h-1.5"}`}
              role="img"
              aria-label={`${s.label}: ${fmt(s.home)} home, ${fmt(s.away)} away`}
            >
              <span className="bg-red" style={{ width: `${homePct}%` }} />
              <span className="bg-navy" style={{ width: `${100 - homePct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
