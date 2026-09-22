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
          &larr; All matches
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
  kicker: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeScorers: string | null;
  awayScorers: string | null;
  clock?: string;
  clockSub?: string;
  discussion?: boolean;
  title?: string;
  stateLabel?: string;
};

export function Scoreboard({
  kicker,
  home,
  away,
  homeScore,
  awayScore,
  homeScorers,
  awayScorers,
  clock,
  clockSub,
  discussion,
  title,
  stateLabel,
}: ScoreboardProps) {
  return (
    <div className="py-5 border-b border-primary text-center">
      <p className="font-mono text-[13.5px] tracking-[0.18em] text-red">
        {kicker}
      </p>
      {discussion ? (
        <h1 className="display text-[clamp(26px,3.4vw,42px)] leading-none mt-3">
          {title}
        </h1>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[clamp(14px,3vw,40px)] mt-3.5">
          <div className="text-right">
            <h2 className="display text-[clamp(26px,3.4vw,42px)] leading-none">
              {home}
            </h2>
            {homeScorers ? (
              <p className="italic text-[13.5px] text-secondary mt-1.5 leading-snug">
                {homeScorers}
              </p>
            ) : null}
          </div>
          <div>
            <div className="display text-[clamp(44px,6vw,66px)] leading-[0.9] tabular-nums">
              {homeScore} - {awayScore}
            </div>
            <p className="font-mono text-[13.5px] tracking-[0.12em] text-red mt-1.5 tabular-nums min-h-[1.25em]">
              {clock
                ? `${clock}${clockSub ? ` · ${clockSub}` : ""}`
                : stateLabel ?? null}
            </p>
          </div>
          <div className="text-left">
            <h2 className="display text-[clamp(26px,3.4vw,42px)] leading-none">
              {away}
            </h2>
            {awayScorers ? (
              <p className="italic text-[13.5px] text-secondary mt-1.5 leading-snug">
                {awayScorers}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
