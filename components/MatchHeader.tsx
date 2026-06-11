import { ClockState, type RoomState } from "./ClockState";

/**
 * Match header: score + clock/state are the largest elements on the page
 * (docs/DESIGN.md). Phase 1: static placeholder data.
 */
export function MatchHeader({
  home,
  away,
  homeScore,
  awayScore,
  state,
  clock,
  listeners,
}: {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  state: RoomState;
  clock?: string;
  listeners?: number;
}) {
  const isLive =
    state === "live_1h" || state === "live_2h" || state === "extra_time";

  return (
    <section
      aria-label="Match status"
      className="border-b border-line bg-surface"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-2 text-lg font-bold sm:text-2xl">
          <span className="truncate">{home}</span>
          <span className="shrink-0 tabular-nums">
            {homeScore}–{awayScore}
          </span>
          <span className="truncate">{away}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ClockState state={state} clock={clock} className="text-lg sm:text-xl" />
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
          {listeners !== undefined && (
            <span className="hidden text-sm text-secondary tabular-nums sm:inline">
              {listeners} listening
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
