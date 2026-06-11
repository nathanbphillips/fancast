/**
 * The clock/state unit (docs/DESIGN.md, PRD FR-7).
 * One component, two presentations, never both:
 *  - live play: period label + running clock ("1H 23:14")
 *  - otherwise: the state word replaces the clock entirely
 * Phase 1: static display only; event-sourced derivation arrives in Phase 6.
 */

export type RoomState =
  | "scheduled"
  | "waiting"
  | "pregame"
  | "live_1h"
  | "halftime"
  | "live_2h"
  | "extra_time"
  | "postgame"
  | "wrapped";

const PERIOD_LABEL: Partial<Record<RoomState, string>> = {
  live_1h: "1H",
  live_2h: "2H",
  extra_time: "ET",
};

const STATE_WORD: Partial<Record<RoomState, string>> = {
  waiting: "PRE-GAME",
  pregame: "PRE-GAME",
  halftime: "HALFTIME",
  postgame: "POST-GAME",
  wrapped: "FULL TIME",
};

export function ClockState({
  state,
  clock,
  className = "",
}: {
  state: RoomState;
  /** "MM:SS" — required for live states, ignored otherwise */
  clock?: string;
  className?: string;
}) {
  const period = PERIOD_LABEL[state];

  if (period && clock) {
    return (
      <span className={`font-bold tabular-nums ${className}`}>
        <span className="mr-1.5 text-secondary">{period}</span>
        {clock}
      </span>
    );
  }

  return (
    <span className={`font-bold tracking-wide ${className}`}>
      {STATE_WORD[state] ?? ""}
    </span>
  );
}
