"use client";

import { useEffect, useState } from "react";
import type { MatchHistory } from "@/lib/history";

/**
 * Fetches the pre-game history (league standings + form) for a fixture from the
 * cached /api/history proxy. Slow-changing, so just load on mount + refresh
 * every 5 min; seed fixtures (id <= 0) never call. Non-critical — failures leave
 * `history` null and the panel falls back to "not available".
 */
export function useMatchHistory(fixtureId: number): {
  history: MatchHistory | null;
  loading: boolean;
} {
  const [history, setHistory] = useState<MatchHistory | null>(null);
  const [loading, setLoading] = useState(fixtureId > 0);

  useEffect(() => {
    if (fixtureId <= 0) {
      setHistory(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/history/${fixtureId}`, { cache: "no-store" });
        if (!cancelled && res.ok) setHistory((await res.json()) as MatchHistory);
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fixtureId]);

  return { history, loading };
}
