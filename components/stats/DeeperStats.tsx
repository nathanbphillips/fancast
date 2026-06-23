"use client";

import { useState } from "react";
import { StatBars } from "./StatBars";
import type { DeepStats, MomentumBucket, StatBar } from "@/lib/stats";

/**
 * Deeper stats (Phase 7 expand): xG, momentum, ratings, goalkeepers, per-half,
 * game state, and the extended team stats — each a collapsible section. Shown
 * in the desktop expanded panel and the mobile "Advanced" box. Pure
 * presentational; data is distilled server-side in lib/stats.
 */

type Size = "compact" | "radio";

function Caret({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`ml-auto inline-block text-secondary transition-transform ${open ? "" : "-rotate-90"}`}
    >
      ⌄
    </span>
  );
}

function Section({
  title,
  badge,
  defaultOpen = false,
  big,
  children,
}: {
  title: string;
  badge?: number | string;
  defaultOpen?: boolean;
  big: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border-[0.75px] border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left font-semibold ${big ? "text-sm" : "text-[13px]"}`}
      >
        <span>{title}</span>
        {badge != null && (
          <span className="rounded-full bg-raised px-1.5 text-[10px] font-semibold text-secondary tabular-nums">
            {badge}
          </span>
        )}
        <Caret open={open} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function Bar({
  label,
  home,
  away,
  fmt = (n) => `${n}`,
  big,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
  big: boolean;
}) {
  const total = home + away;
  const hp = total === 0 ? 50 : (home / total) * 100;
  return (
    <div className="mb-2">
      <div className={`flex justify-between ${big ? "text-sm" : "text-xs"}`}>
        <span className="font-semibold tabular-nums">{fmt(home)}</span>
        <span className="text-secondary">{label}</span>
        <span className="font-semibold tabular-nums">{fmt(away)}</span>
      </div>
      <div className={`mt-1 flex overflow-hidden rounded-full bg-raised ${big ? "h-2.5" : "h-1.5"}`}>
        <span className="bg-red" style={{ width: `${hp}%` }} />
        <span className="bg-navy" style={{ width: `${100 - hp}%` }} />
      </div>
    </div>
  );
}

function Momentum({ buckets, big }: { buckets: MomentumBucket[]; big: boolean }) {
  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.home - b.away)));
  return (
    <>
      <p className="mb-1.5 text-[11px] text-secondary">
        Dangerous attacks by 15′ — who&apos;s on top
      </p>
      <div className="flex items-stretch gap-1" style={{ height: big ? "60px" : "46px" }}>
        {buckets.map((b) => {
          const net = b.home - b.away;
          const h = Math.round((Math.abs(net) / max) * 100);
          return (
            <div
              key={b.minute}
              className="flex flex-1 flex-col"
              title={`${b.minute}′: ${b.home}–${b.away}`}
            >
              <div className="flex flex-1 items-end">
                <span className="w-full rounded-sm bg-red" style={{ height: net > 0 ? `${h}%` : "0" }} />
              </div>
              <div className="flex flex-1 items-start">
                <span className="w-full rounded-sm bg-navy" style={{ height: net < 0 ? `${h}%` : "0" }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function RatingList({ title, rows, big }: { title: string; rows: { name: string; value: number }[]; big: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className={`mb-1 text-secondary ${big ? "text-xs" : "text-[11px]"}`}>{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li key={`${r.name}-${i}`} className={`flex justify-between ${big ? "text-sm" : "text-[13px]"}`}>
            <span className="truncate">{r.name}</span>
            <span className="ml-2 shrink-0 font-semibold tabular-nums">{r.value.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeeperStats({
  deep,
  extended,
  homeName,
  awayName,
  size = "compact",
}: {
  deep: DeepStats | null;
  extended: StatBar[];
  homeName: string;
  awayName: string;
  size?: Size;
}) {
  const big = size === "radio";
  if (!deep) {
    return (
      <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
        Deeper stats — xG, momentum, ratings — appear once the match is underway.
      </p>
    );
  }

  // group the extended team stats by their group for the last section
  const exGroups: { name: string; items: StatBar[] }[] = [];
  for (const b of extended) {
    let g = exGroups.find((x) => x.name === b.group);
    if (!g) { g = { name: b.group, items: [] }; exGroups.push(g); }
    g.items.push(b);
  }

  const gs = deep.gameState;
  const gsTotal = gs ? Math.max(1, gs.homeLed + gs.level + gs.awayLed) : 1;
  const gk = deep.goalkeepers;

  return (
    <div className="space-y-2">
      <Section title="Expected goals (xG)" defaultOpen big>
        <Bar label="Team xG" home={deep.xg.home} away={deep.xg.away} fmt={(n) => n.toFixed(2)} big />
        {deep.xg.top.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {deep.xg.top.slice(0, 5).map((p, i) => (
              <li key={`${p.side}-${p.name}-${i}`} className={`flex items-center justify-between ${big ? "text-sm" : "text-[13px]"}`}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.side === "home" ? "bg-red" : "bg-navy"}`} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="ml-2 shrink-0 font-semibold tabular-nums">{p.xg.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {deep.momentum.length > 0 && (
        <Section title="Momentum" defaultOpen big>
          <Momentum buckets={deep.momentum} big={big} />
        </Section>
      )}

      {(deep.ratings.home.length > 0 || deep.ratings.away.length > 0) && (
        <Section title="Player ratings" defaultOpen big>
          <div className="space-y-3">
            <RatingList title={homeName} rows={deep.ratings.home} big={big} />
            <RatingList title={awayName} rows={deep.ratings.away} big={big} />
          </div>
        </Section>
      )}

      {(gk.home || gk.away) && (
        <Section title="Goalkeepers" big>
          {([["home", gk.home, homeName], ["away", gk.away, awayName]] as const).map(([side, g, name]) =>
            g ? (
              <div key={side} className={`flex items-center justify-between ${big ? "text-sm" : "text-[13px]"} py-0.5`}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${side === "home" ? "bg-red" : "bg-navy"}`} />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="ml-2 shrink-0 text-secondary tabular-nums">
                  {g.saves ?? 0} saves · {g.conceded ?? 0} conceded
                </span>
              </div>
            ) : null,
          )}
        </Section>
      )}

      {deep.perHalf.length > 0 && (
        <Section title="Per-half split" big>
          {deep.perHalf.map((h) => (
            <div key={h.code} className="mb-2 last:mb-0">
              <p className={`mb-0.5 text-secondary ${big ? "text-xs" : "text-[11px]"}`}>{h.label}</p>
              <Bar label="1st half" home={h.first.home} away={h.first.away} big={big} />
              <Bar label="2nd half" home={h.second.home} away={h.second.away} big={big} />
            </div>
          ))}
        </Section>
      )}

      {gs && (
        <Section title="Game state" big>
          <div className="flex h-2 overflow-hidden rounded-full bg-raised">
            <span className="bg-red" style={{ width: `${(gs.homeLed / gsTotal) * 100}%` }} />
            <span className="bg-line" style={{ width: `${(gs.level / gsTotal) * 100}%` }} />
            <span className="bg-navy" style={{ width: `${(gs.awayLed / gsTotal) * 100}%` }} />
          </div>
          <div className={`mt-2 space-y-0.5 ${big ? "text-sm" : "text-[13px]"}`}>
            <div className="flex justify-between"><span className="text-secondary">{homeName} led</span><span className="font-semibold tabular-nums">{gs.homeLed}′</span></div>
            <div className="flex justify-between"><span className="text-secondary">Level</span><span className="font-semibold tabular-nums">{gs.level}′</span></div>
            <div className="flex justify-between"><span className="text-secondary">{awayName} led</span><span className="font-semibold tabular-nums">{gs.awayLed}′</span></div>
          </div>
        </Section>
      )}

      {extended.length > 0 && (
        <Section title="Extended team stats" badge={extended.length} big>
          {exGroups.map((g, i) => (
            <div key={g.name} className={i === 0 ? "" : "mt-3"}>
              <p className={`mb-2 font-semibold text-secondary ${big ? "text-xs" : "text-[11px]"}`}>{g.name}</p>
              <StatBars stats={g.items} size={size} />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
