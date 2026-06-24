import type { RatingsAggregate } from "@/lib/db/types";

/**
 * Player ratings (FR-12.3): average rating per player, one decimal. Pure +
 * shared by the route, the room page, and the snapshot endpoint.
 */
export function ratingsAggregate(
  rows: { player_id: number; rating: number }[],
): RatingsAggregate {
  const m = new Map<number, { sum: number; count: number }>();
  for (const r of rows) {
    const e = m.get(r.player_id) ?? { sum: 0, count: 0 };
    e.sum += r.rating;
    e.count++;
    m.set(r.player_id, e);
  }
  return [...m.entries()].map(([playerId, e]) => ({
    playerId,
    avg: Math.round((e.sum / e.count) * 10) / 10,
    count: e.count,
  }));
}
