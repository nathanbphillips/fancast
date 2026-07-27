"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While a scheduled room shows the "doors open soon" screen, softly re-render
 * the route on an interval so it auto-swaps to the live matchday room the
 * moment the host opens it — no manual refresh. router.refresh() re-runs the
 * server component (which branches on room.state) and preserves the ticking
 * Countdown's client state, so the wait stays smooth until it flips.
 */
export function WaitingRoomWatcher({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
