import type { PredictionAggregate } from "@/lib/db/types";

/**
 * Score-predictor distribution (FR-12.1): scorelines grouped by frequency,
 * most-predicted first (top 6). Pure + shared by the route, the room page, and
 * the snapshot endpoint, so the aggregate is computed identically everywhere.
 */
export function predictionAggregate(
  rows: { home_score: number; away_score: number }[],
): PredictionAggregate {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = `${r.home_score}-${r.away_score}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
  return { total: rows.length, top };
}
