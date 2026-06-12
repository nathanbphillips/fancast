/**
 * Event-sourced match clock (FR-7, golden rule 6). The server stores
 * clock_events; every client derives display time locally from the event
 * list and its own wall clock — one message per transition, never a tick
 * over the wire. Reconnect-safe by construction: replaying the events
 * always lands on the same answer.
 *
 * Periods count continuously: 1H from 0:00, 2H from 45:00, ET from 90:00,
 * each running past 45:00/90:00/105:00 freely (FR-7.1).
 */

export type ClockAction =
  | "start1h"
  | "stop1h"
  | "start2h"
  | "stop2h"
  | "start_et"
  | "stop_et"
  | "adjust";

export type ClockEventInput = {
  action: ClockAction;
  /** ISO timestamp from the server */
  server_ts: string;
  /** signed seconds; only meaningful for `adjust` */
  offset_seconds: number;
};

export type ClockDisplay =
  | { running: true; period: "1H" | "2H" | "ET"; elapsedSeconds: number }
  | { running: false };

const PERIOD_BASE_SECONDS = { "1H": 0, "2H": 45 * 60, ET: 90 * 60 } as const;

const START_PERIOD: Partial<Record<ClockAction, "1H" | "2H" | "ET">> = {
  start1h: "1H",
  start2h: "2H",
  start_et: "ET",
};

const STOP_ACTIONS: ClockAction[] = ["stop1h", "stop2h", "stop_et"];

/** Derive what the clock shows right now from the full event history. */
export function deriveClock(
  events: ClockEventInput[],
  nowMs: number,
): ClockDisplay {
  const ordered = [...events].sort((a, b) =>
    a.server_ts.localeCompare(b.server_ts),
  );

  let period: "1H" | "2H" | "ET" | null = null;
  let periodStartMs = 0;
  let adjustSeconds = 0;

  for (const e of ordered) {
    const startsPeriod = START_PERIOD[e.action];
    if (startsPeriod) {
      period = startsPeriod;
      periodStartMs = new Date(e.server_ts).getTime();
      adjustSeconds = 0;
    } else if (STOP_ACTIONS.includes(e.action)) {
      period = null;
    } else if (e.action === "adjust" && period !== null) {
      adjustSeconds += e.offset_seconds;
    }
  }

  if (period === null) return { running: false };

  const elapsed =
    PERIOD_BASE_SECONDS[period] +
    Math.max(0, Math.floor((nowMs - periodStartMs) / 1000) + adjustSeconds);
  return { running: true, period, elapsedSeconds: elapsed };
}

/** "MM:SS" with free-running minutes (78:40, 104:12). Tabular-nums ready. */
export function formatClock(elapsedSeconds: number): string {
  const m = Math.floor(elapsedSeconds / 60);
  const s = elapsedSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
