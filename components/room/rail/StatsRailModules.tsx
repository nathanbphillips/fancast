"use client";

/**
 * The Programme room's left stats rail modules (founder 2026-09-22,
 * ESPN-format room). Presentational only: every number and string arrives
 * via props from RealtimeRoom; no fetching, no hooks, no context. Matchday
 * Programme design language throughout (Anton display heads over a double
 * rule, Newsreader small-caps labels, tabular figures, square corners,
 * no shadows).
 */

import { Fragment } from "react";
import type { StatBar } from "@/lib/stats";
import { barFillStyle } from "@/lib/teamColors";

type StatRow = { key: string; label: string; home: string; away: string };

function findStat(stats: StatBar[], code: string): StatBar | undefined {
  return stats.find((s) => s.code === code);
}

function buildRows(
  stats: StatBar[],
  specs: { code: string; label: string; pct?: boolean }[]
): StatRow[] {
  const rows: StatRow[] = [];
  for (const spec of specs) {
    const s = findStat(stats, spec.code);
    if (!s) continue;
    const suffix = spec.pct ? "%" : "";
    rows.push({
      key: spec.code,
      label: spec.label,
      home: `${s.home}${suffix}`,
      away: `${s.away}${suffix}`,
    });
  }
  return rows;
}

function StatSubBlock({ title, rows }: { title: string; rows: StatRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[14.5px] tracking-[0.12em] text-red font-semibold border-b border-line pb-1 mt-4">
        {title}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-[6px] text-[16.5px] tabular-nums mt-2">
        {rows.map((r) => (
          <Fragment key={r.key}>
            <div className="text-right font-semibold">{r.home}</div>
            <div className="font-mono text-[14px] text-tertiary text-center whitespace-nowrap self-center">
              {r.label}
            </div>
            <div className="text-left">{r.away}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Grouped match stats: Attacking / Possession & passing / Defending &
 *  discipline. Team names head the two value columns (founder 2026-09-22:
 *  "impossible to know who is who" without them). */
export function MatchStatsBlocks({
  stats,
  xg,
  homeName,
  awayName,
}: {
  stats: StatBar[];
  xg: { home: number; away: number } | null;
  homeName: string;
  awayName: string;
}) {
  const attacking: StatRow[] = [
    ...buildRows(stats, [
      { code: "shots-total", label: "shots" },
      { code: "shots-on-target", label: "on target" },
      { code: "big-chances-created", label: "big chances" },
    ]),
    ...(xg
      ? [
          {
            key: "xg",
            label: "xg",
            home: xg.home.toFixed(2),
            away: xg.away.toFixed(2),
          },
        ]
      : []),
    ...buildRows(stats, [
      { code: "corners", label: "corners" },
      { code: "offsides", label: "offsides" },
    ]),
  ];
  const possession = buildRows(stats, [
    { code: "ball-possession", label: "possession", pct: true },
    { code: "passes", label: "total passes" },
    { code: "successful-passes", label: "passes completed" },
    { code: "successful-passes-percentage", label: "completion", pct: true },
  ]);
  const defending = buildRows(stats, [
    { code: "tackles", label: "tackles" },
    { code: "fouls", label: "fouls" },
    { code: "yellowcards", label: "yellow cards" },
    { code: "saves", label: "saves" },
  ]);

  const empty =
    attacking.length === 0 && possession.length === 0 && defending.length === 0;

  return (
    <div>
      <div className="display text-[18px] border-b-[3px] border-double border-primary pb-2">
        Match stats
      </div>
      {empty ? (
        <div className="text-[14.5px] text-tertiary italic mt-3">
          Numbers arrive at kick-off.
        </div>
      ) : (
        <>
          {/* who is who: home reads the LEFT column, away the RIGHT */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 mt-3">
            <div className="min-w-0 truncate text-right font-mono text-[14.5px] font-semibold">
              {homeName}
            </div>
            <div className="font-mono text-[13px] text-tertiary self-center">v</div>
            <div className="min-w-0 truncate text-left font-mono text-[14.5px] font-semibold">
              {awayName}
            </div>
          </div>
          <StatSubBlock title="Attacking" rows={attacking} />
          <StatSubBlock title="Possession &amp; passing" rows={possession} />
          <StatSubBlock title="Defending &amp; discipline" rows={defending} />
        </>
      )}
    </div>
  );
}

/** A single two-tone pressure bar summing the last ~15 minutes of momentum. */
export function MomentumStrip({
  momentum,
  colors,
}: {
  momentum: { minute: number; home: number; away: number }[] | null | undefined;
  colors: { home: { bg: string; fg: string }; away: { bg: string; fg: string } };
}) {
  if (!momentum || momentum.length === 0) return null;

  let home = 0;
  let away = 0;
  for (const bucket of momentum.slice(-3)) {
    home += bucket.home;
    away += bucket.away;
  }
  const bothZero = home === 0 && away === 0;
  const homeShare = bothZero ? 1 : home;
  const awayShare = bothZero ? 1 : away;

  return (
    <div>
      <div className="font-mono text-[14px] text-tertiary mt-4">
        Momentum, last 15&#39;
      </div>
      <div className="flex gap-[3px] h-[10px] mt-1.5">
        <span style={{ ...barFillStyle(colors.home), flex: homeShare }} />
        <span style={{ ...barFillStyle(colors.away), flex: awayShare }} />
      </div>
    </div>
  );
}

/** Commentator bulletin, printed in negative (ink card, gold lead). Body is user text, rendered verbatim. */
export function BulletinCard({
  bulletin,
  minuteLabel,
}: {
  bulletin: { id: string; body: string; createdAt: string } | null;
  minuteLabel: string | null;
}) {
  if (!bulletin) return null;
  return (
    <div className="bg-inverted text-inverted-fg px-3 py-2.5 mt-4 text-[15.5px] leading-[1.5]">
      <span className="font-mono text-[14px] tracking-[0.08em] text-gold">
        Bulletin
        {minuteLabel ? `, ${minuteLabel}` : ""}
      </span>
      {" - "}
      {bulletin.body}
    </div>
  );
}

function formatGoalDiff(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

/** Pre-sliced league mini-table with gap markers and both sides highlighted. */
export function MiniTable({
  table,
  homeTeamId,
  awayTeamId,
  competition,
  roundLabel,
}: {
  table: {
    teamId: number;
    name: string;
    position: number;
    played: number;
    goalDiff: number;
    points: number;
  }[];
  homeTeamId: number | null;
  awayTeamId: number | null;
  competition: string;
  roundLabel: string | null;
}) {
  if (table.length < 2) return null;

  const rows: React.ReactNode[] = [];
  let prevPosition: number | null = null;
  for (const row of table) {
    if (prevPosition !== null && row.position - prevPosition > 1) {
      rows.push(
        <div
          key={`gap-${row.teamId}`}
          className="text-center text-[13px] text-tertiary py-0.5"
        >
          ···
        </div>
      );
    }
    const highlighted =
      row.teamId === homeTeamId || row.teamId === awayTeamId;
    rows.push(
      <div
        key={row.teamId}
        className={`grid grid-cols-[26px_1fr_30px_36px_36px] gap-x-2 text-[15px] tabular-nums py-1.5 border-b border-line${
          highlighted ? " bg-raised" : ""
        }`}
      >
        <div className={highlighted ? "text-red font-semibold" : undefined}>
          {row.position}
        </div>
        <div className={`font-mono text-[15px]${highlighted ? " font-semibold" : ""}`}>
          {row.name}
        </div>
        <div className="text-right">{row.played}</div>
        <div className="text-right">{formatGoalDiff(row.goalDiff)}</div>
        <div className="text-right font-semibold">{row.points}</div>
      </div>
    );
    prevPosition = row.position;
  }

  return (
    <div>
      <div className="display text-[18px] border-b-[3px] border-double border-primary pb-2 mt-7">
        The table
      </div>
      <div className="grid grid-cols-[26px_1fr_30px_36px_36px] gap-x-2 font-mono text-[13px] tracking-[0.06em] text-tertiary mt-3 pb-1 border-b border-line">
        <div>Pos</div>
        <div>Club</div>
        <div className="text-right">P</div>
        <div className="text-right">GD</div>
        <div className="text-right">Pts</div>
      </div>
      {rows}
      <div className="text-[14px] text-tertiary italic mt-2.5">
        {competition}
        {roundLabel ? ` · ${roundLabel}` : ""}.
      </div>
    </div>
  );
}

/** Last-five form chips per side, oldest to newest. BOTH teams always show
 *  when either has data (founder 2026-09-22: clearly designated) - a side
 *  with no recent form says so honestly instead of vanishing. */
export function FormLastFive({
  rows,
}: {
  rows: { team: string; form: ("W" | "D" | "L")[] }[];
}) {
  if (rows.length === 0 || rows.every((r) => r.form.length === 0)) return null;

  const chipClass = (result: "W" | "D" | "L"): string => {
    if (result === "W") return "bg-inverted text-inverted-fg";
    if (result === "L") return "bg-red-fill text-on-red";
    return "border-[1.5px] border-primary text-primary";
  };

  return (
    <div>
      <div className="display text-[18px] border-b-[3px] border-double border-primary pb-2 mt-7">
        Form - last 5
      </div>
      {rows.map((row) => (
        <div key={row.team} className="flex justify-between items-center gap-3 mt-3">
          <div className="min-w-0 truncate font-mono text-[15px] font-semibold">
            {row.team}
          </div>
          {row.form.length > 0 ? (
            <div className="flex shrink-0 gap-1">
              {[...row.form].reverse().map((result, i) => (
                <span
                  key={i}
                  className={`inline-flex h-[22px] w-[22px] items-center justify-center font-mono text-[13.5px] font-semibold ${chipClass(result)}`}
                >
                  {result}
                </span>
              ))}
            </div>
          ) : (
            <div className="shrink-0 text-[13.5px] text-tertiary italic">
              no league form yet
            </div>
          )}
        </div>
      ))}
      <div className="text-[14px] text-tertiary italic mt-2">
        Oldest to newest, league games.
      </div>
    </div>
  );
}

/** Head-to-head record line plus the last few meetings. */
export function HeadToHead({
  h2h,
  homeName,
  awayName,
}: {
  h2h: {
    homeWins: number;
    draws: number;
    awayWins: number;
    total: number;
    meetings: { whenLabel: string; result: string }[];
  } | null;
  homeName: string;
  awayName: string;
}) {
  if (!h2h || h2h.total === 0) return null;

  return (
    <div>
      <div className="display text-[18px] border-b-[3px] border-double border-primary pb-2 mt-7">
        Head-to-head
      </div>
      <div className="font-mono text-[15px] mt-2.5">
        Last {h2h.total}:{" "}
        <span className="text-red font-semibold">
          {homeName} {h2h.homeWins}
        </span>
        {" · "}
        Draws {h2h.draws}
        {" · "}
        {awayName} {h2h.awayWins}
      </div>
      {/* last 5 meetings (founder 2026-09-22, was 3) */}
      {h2h.meetings.slice(0, 5).map((meeting, i) => (
        <div
          key={i}
          className="flex justify-between gap-2.5 py-2 border-b border-line text-[15px]"
        >
          <span className="font-mono text-tertiary whitespace-nowrap">
            {meeting.whenLabel}
          </span>
          <span className="tabular-nums">{meeting.result}</span>
        </div>
      ))}
    </div>
  );
}
