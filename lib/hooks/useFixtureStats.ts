"use client";

import { useEffect, useRef, useState } from "react";
import type { FixtureStats } from "@/lib/stats";

/**
 * Polls the public /api/stats proxy for live match detail (Phase 7). Cadence
 * is 60s normally, 15s while the room is live or within 90s of a detected
 * goal. Seed/dev fixtures (id <= 0) never poll — they degrade to the static
 * placeholder. The route is cache-backed (10s TTL), so many listeners polling
 * at 15s collapse to ~1 upstream Sportmonks call per window.
 */
export function useFixtureStats({
  fixtureId,
  live,
}: {
  fixtureId: number;
  live: boolean;
}): {
  stats: FixtureStats | null;
  isStale: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const [stats, setStats] = useState<FixtureStats | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(fixtureId > 0);
  const [error, setError] = useState<string | null>(null);
  const goalBurstUntil = useRef(0);
  const prevTotal = useRef<number | null>(null);

  useEffect(() => {
    if (fixtureId <= 0) {
      setStats(null);
      setIsLoading(false);
      setError(null);
      setIsStale(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const poll = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(`/api/stats/${fixtureId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(`stats ${res.status}`);
        } else {
          const data = (await res.json()) as FixtureStats;
          if (cancelled) return;
          const total = data.score.home + data.score.away;
          if (prevTotal.current !== null && total > prevTotal.current) {
            goalBurstUntil.current = Date.now() + 90_000;
          }
          prevTotal.current = total;
          setStats(data);
          setIsStale(Boolean(data.stale));
          setError(null);
        }
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          const fast = live || Date.now() < goalBurstUntil.current;
          timer = setTimeout(poll, fast ? 15_000 : 60_000);
        }
      }
    };

    setIsLoading(true);
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [fixtureId, live]);

  return { stats, isStale, isLoading, error };
}
