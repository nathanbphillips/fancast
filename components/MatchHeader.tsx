import { ClockState, type RoomState } from "./ClockState";

/**
 * Combined room top bar (redesign 2026-06-29): the global app header hides on
 * room routes, so this single bar carries the chrome (wordmark · theme · user
 * menu — passed in as slots so the client bits stay in RealtimeRoom) alongside
 * the score + clock/state + LIVE + listeners. Score stays the largest match
 * element but lives in a pill to fit the 56px bar; team names use the display
 * face, the score digits stay on the body font with tabular-nums (no jitter).
 */
export function MatchHeader({
  home,
  away,
  homeScore,
  awayScore,
  state,
  clock,
  listeners,
  wordmark,
  themeToggle,
  userMenu,
}: {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  state: RoomState;
  clock?: string;
  listeners?: number;
  wordmark?: React.ReactNode;
  themeToggle?: React.ReactNode;
  userMenu?: React.ReactNode;
}) {
  const isLive =
    state === "live_1h" || state === "live_2h" || state === "extra_time";

  return (
    <section
      aria-label="Match status"
      className="border-b border-line bg-surface"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        {wordmark && <div className="hidden shrink-0 sm:flex">{wordmark}</div>}

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 font-display text-base font-bold sm:text-lg">
            <span className="truncate">{home}</span>
            <span className="shrink-0 rounded-md border border-line px-2 py-0.5 font-sans text-sm tabular-nums">
              {homeScore}–{awayScore}
            </span>
            <span className="truncate">{away}</span>
          </div>
          <ClockState
            state={state}
            clock={clock}
            className="shrink-0 text-base sm:text-lg"
          />
          {isLive && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
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

        {(themeToggle || userMenu) && (
          <div className="flex shrink-0 items-center gap-1">
            {themeToggle}
            {userMenu}
          </div>
        )}
      </div>
    </section>
  );
}
