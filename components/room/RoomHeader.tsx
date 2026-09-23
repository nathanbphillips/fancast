"use client";

/**
 * Programme room header (founder 2026-09-22 ESPN-format rebuild): masthead
 * strip + scoreboard, presentational only. The clock is derived client-side
 * upstream (golden rule 6 - never tick the clock over the wire); the listener
 * count is host-only upstream (founder 2026-09-12). Props in, markup out - no
 * data fetching, no timers.
 */

import Link from "next/link";
import { brand } from "@/lib/brand";

type RoomMastheadProps = {
  leaveHref: string;
  onAir: boolean;
  listeners?: number;
  themeToggle?: React.ReactNode;
  userMenu?: React.ReactNode;
  share?: React.ReactNode;
  help?: React.ReactNode;
};

export function RoomMasthead({
  leaveHref,
  onAir,
  listeners,
  themeToggle,
  userMenu,
  share,
  help,
}: RoomMastheadProps) {
  return (
    <div className="border-t-[3px] border-b border-primary">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-1.5 font-mono text-[13px] tracking-[0.06em]">
        <Link
          href={leaveHref}
          className="text-primary hover:text-red whitespace-nowrap"
        >
          &larr; Fixtures
        </Link>
        <span className="hidden sm:block text-secondary">
          {brand.name} &middot; the live edition
        </span>
        <span className="flex items-center gap-3 whitespace-nowrap">
          {onAir ? (
            <span className="flex items-center gap-1.5 text-red">
              <span className="h-2 w-2 rounded-full bg-red-fill animate-fcpulse" />
              On air
            </span>
          ) : null}
          {typeof listeners === "number" ? (
            <span className="text-secondary tabular-nums">
              &middot; {listeners} listening
            </span>
          ) : null}
          {share}
          {help}
          {themeToggle}
          {userMenu}
        </span>
      </div>
    </div>
  );
}

type ScoreboardProps = {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  discussion?: boolean;
  title?: string;
};

/** Minimal scoreboard (founder 2026-09-22 feedback): team names and the
 *  score, nothing else, in the least vertical space that still lands - the
 *  kicker, scorers and clock line were removed on request. The clock lives
 *  with the transport; scorers live in the stream and the stats. */
export function Scoreboard({
  home,
  away,
  homeScore,
  awayScore,
  discussion,
  title,
}: ScoreboardProps) {
  return (
    <div className="border-b border-primary py-2.5 text-center">
      {discussion ? (
        <h1 className="display text-[clamp(24px,3vw,36px)] leading-none">
          {title}
        </h1>
      ) : (
        <div className="flex items-baseline justify-center gap-[clamp(14px,2.5vw,32px)]">
          <h2 className="display min-w-0 truncate text-[clamp(24px,3vw,38px)] leading-none">
            {home}
          </h2>
          <div className="display shrink-0 text-[clamp(30px,3.8vw,48px)] leading-none tabular-nums">
            {homeScore} - {awayScore}
          </div>
          <h2 className="display min-w-0 truncate text-[clamp(24px,3vw,38px)] leading-none">
            {away}
          </h2>
        </div>
      )}
    </div>
  );
}
