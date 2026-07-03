import Link from "next/link";
import { ClockState, type RoomState } from "./ClockState";

/**
 * Room match bar (Cloud Design "1a"): a 54px full-bleed bar carrying Leave →
 * matches · match title · LIVE · clock · score · listener presence · theme ·
 * Share. Purely presentational — fed by props from RealtimeRoom; the audio /
 * realtime engine is untouched. Team CODES use the Anton display face; the
 * score DIGITS stay on the body font with tabular-nums (golden rule: no jitter
 * on anything that ticks). `themeToggle`/`userMenu`/`share` are passed as slots
 * so the client bits stay in RealtimeRoom.
 */
export function MatchHeader({
  home,
  away,
  homeScore,
  awayScore,
  state,
  clock,
  listeners,
  competition,
  leaveHref = "/matches",
  showOnMobile = false,
  themeToggle,
  userMenu,
  share,
}: {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  state: RoomState;
  clock?: string;
  listeners?: number;
  competition?: string;
  leaveHref?: string;
  /** show at all widths — the commentator has no listener transport carrying
   *  score/clock on mobile, so their match bar must stay (audit 2026-07-02) */
  showOnMobile?: boolean;
  themeToggle?: React.ReactNode;
  userMenu?: React.ReactNode;
  share?: React.ReactNode;
}) {
  const isLive =
    state === "live_1h" || state === "live_2h" || state === "extra_time";
  const abbr = (s: string) => s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();

  return (
    <section
      aria-label="Match status"
      // listeners: desktop-only (the mobile sync transport carries leave/LIVE/
      // clock/score itself). Commentators: all widths (no listener transport).
      className={`${showOnMobile ? "flex" : "hidden"} h-[54px] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:flex`}
    >
      {/* left: leave · competition · title */}
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={leaveHref}
          className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-secondary transition-colors hover:text-primary"
        >
          <span aria-hidden="true" className="text-[15px] leading-none">
            ‹
          </span>
          Leave
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
        {competition && (
          <span className="hidden shrink-0 rounded-[5px] border border-line px-1.5 py-[3px] font-mono text-[10px] tracking-[0.08em] text-secondary uppercase md:inline">
            {competition}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-bold tracking-[-0.01em]">
          {home} vs {away}
        </span>
      </div>

      {/* center: live · clock · score */}
      <div className="flex shrink-0 items-center gap-3">
        {isLive && (
          <span className="hidden items-center gap-1.5 rounded-md bg-red px-2 py-1 font-mono text-[11px] tracking-[0.1em] text-white sm:flex">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white"
            />
            LIVE
          </span>
        )}
        <ClockState
          state={state}
          clock={clock}
          className="hidden shrink-0 font-mono text-[13px] text-secondary tabular-nums sm:block"
        />
        <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <span className="display text-lg tracking-[0.04em]">{abbr(home)}</span>
          <span className="text-lg font-bold tabular-nums">{homeScore}</span>
          <span aria-hidden="true" className="text-secondary">
            –
          </span>
          <span className="text-lg font-bold tabular-nums">{awayScore}</span>
          <span className="display text-lg tracking-[0.04em]">{abbr(away)}</span>
        </span>
      </div>

      {/* right: presence · theme · share · menu */}
      <div className="flex shrink-0 items-center gap-2.5">
        {listeners !== undefined && (
          <span className="hidden items-center gap-2 lg:flex">
            <span aria-hidden="true" className="flex">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-[22px] w-[22px] rounded-full border-[1.5px] border-surface"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #3a3a40, #1b1b1f)",
                    marginLeft: i ? -8 : 0,
                  }}
                />
              ))}
            </span>
            <span className="font-mono text-[11px] text-secondary tabular-nums">
              {listeners.toLocaleString()}
            </span>
          </span>
        )}
        {themeToggle}
        {share}
        {userMenu}
      </div>
    </section>
  );
}
