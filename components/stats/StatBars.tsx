import type { StatBar } from "@/lib/stats";
import { barFillStyle, type DiscColor } from "@/lib/teamColors";

/**
 * Compact stacked home-vs-away stat bars. pct stats (possession, pass
 * accuracy) use the raw home value as the bar width; count stats split
 * proportionally by total. The colored segments carry no text, so AA contrast
 * holds in both themes. `size="radio"` enlarges everything for background
 * listening. With `colors` the segments wear the same club colours as the
 * line-up discs (Arsenal always red, founder 2026-09-12); without them
 * (no fixture data) they keep the red-home / navy-away placeholder look.
 */
export function StatBars({
  stats,
  size = "compact",
  colors,
}: {
  stats: StatBar[];
  size?: "compact" | "radio";
  colors?: { home: DiscColor; away: DiscColor };
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
          <div key={s.code} data-stat-code={s.code}>
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
              <span
                className={colors ? undefined : "bg-red"}
                style={{ width: `${homePct}%`, ...(colors ? barFillStyle(colors.home) : null) }}
              />
              <span
                className={colors ? undefined : "bg-navy"}
                style={{ width: `${100 - homePct}%`, ...(colors ? barFillStyle(colors.away) : null) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
