"use client";

import { useState } from "react";
import type { RoomState } from "@/lib/db/types";

/** Commentator clock controls (FR-7.3): Start/Stop each period, ±1s. */
export function ClockControls({
  roomId,
  state,
}: {
  roomId: string;
  state: RoomState;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: string, offsetSeconds?: number) {
    setBusy(true);
    setError(null);
    // .catch: a network-level rejection would throw past setBusy(false) and
    // leave Half time / Full time dead for the rest of the match
    const res = await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, action, offsetSeconds }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError("Couldn't reach the server. Try again.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Clock action failed.");
    }
  }

  const primary = (label: string, action: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => send(action)}
      className="h-9 rounded-md bg-red px-3 text-xs font-bold text-white disabled:opacity-60"
    >
      {label}
    </button>
  );

  const adjusters = (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => send("adjust", -1)}
        aria-label="Clock back one second"
        className="h-9 w-9 rounded-md border border-line text-xs font-bold tabular-nums hover:bg-raised disabled:opacity-60"
      >
        −1s
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => send("adjust", 1)}
        aria-label="Clock forward one second"
        className="h-9 w-9 rounded-md border border-line text-xs font-bold tabular-nums hover:bg-raised disabled:opacity-60"
      >
        +1s
      </button>
    </span>
  );

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {state === "pregame" && primary("Start 1H", "start1h")}
      {state === "live_1h" && (
        <>
          {adjusters}
          {primary("Halftime", "stop1h")}
        </>
      )}
      {state === "halftime" && primary("Start 2H", "start2h")}
      {state === "live_2h" && (
        <>
          {adjusters}
          {primary("Full time", "stop2h")}
        </>
      )}
      {/* Extra time retired (founder 2026-09-01): the five segments are
          Pre-game / 1H / Halftime / 2H / Post-game. The End ET button below
          stays only as the exit for a room already in that legacy state. */}
      {state === "extra_time" && (
        <>
          {adjusters}
          {primary("End ET", "stop_et")}
        </>
      )}
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  );
}
