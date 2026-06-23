"use client";

import { useEffect, useRef, useState } from "react";
import { StatBars } from "@/components/stats/StatBars";
import { EventsTimeline } from "@/components/stats/EventsTimeline";
import { LineupTabs } from "@/components/stats/LineupTabs";
import { DeeperStats } from "@/components/stats/DeeperStats";
import { placeholderStats } from "@/lib/stats";
import type { FixtureStats, StatBar, StatTab } from "@/lib/stats";

/**
 * Stats panel (Phase 7): Stats / Events / Line-ups, driven by live Sportmonks
 * data polled in RealtimeRoom. The commentator can push a tab to all listeners
 * (control channel); a listener's local tap overrides until the next push. In
 * radio mode the whole panel enlarges for background listening. Pre-match /
 * loading / seed fixtures fall back to the calm zeros placeholder.
 */

const TABS: { id: StatTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "events", label: "Events" },
  { id: "lineups", label: "Line-ups" },
];

/** Render stat bars grouped by their `group`, with a subheader per group. */
function StatGroups({ bars, size }: { bars: StatBar[]; size: "compact" | "radio" }) {
  const groups: { name: string; items: StatBar[] }[] = [];
  for (const b of bars) {
    let g = groups.find((x) => x.name === b.group);
    if (!g) {
      g = { name: b.group, items: [] };
      groups.push(g);
    }
    g.items.push(b);
  }
  const big = size === "radio";
  return (
    <>
      {groups.map((g, i) => (
        <div key={g.name} className={i === 0 ? "" : "mt-4"}>
          <p className={`mb-2 font-semibold text-secondary ${big ? "text-xs" : "text-[11px]"}`}>
            {g.name}
          </p>
          <StatBars stats={g.items} size={size} />
        </div>
      ))}
    </>
  );
}

export function StatsPanel({
  data,
  radio = false,
  isRoomCommentator = false,
  roomId,
  pushedTab = null,
  pushNonce = 0,
  onPushTab,
  expanded = false,
}: {
  data: FixtureStats | null;
  radio?: boolean;
  isRoomCommentator?: boolean;
  roomId?: string;
  pushedTab?: StatTab | null;
  pushNonce?: number;
  onPushTab?: (tab: StatTab) => void;
  /** desktop only: render the deeper-stats sections inline below the 13.
   *  On mobile the deeper sections always show (this only gates the ≥lg view). */
  expanded?: boolean;
}) {
  const [override, setOverride] = useState<StatTab | null>(null);
  const [pushed, setPushed] = useState(false);
  const pushedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // a fresh push (even of the same tab) clears the listener's local override once
  useEffect(() => {
    setOverride(null);
  }, [pushedTab, pushNonce]);
  useEffect(() => () => clearTimeout(pushedTimer.current), []);

  const effectiveTab: StatTab = override ?? pushedTab ?? "stats";
  const size = radio ? "radio" : "compact";
  const big = radio;

  function pushCurrent() {
    onPushTab?.(effectiveTab);
    setPushed(true);
    clearTimeout(pushedTimer.current);
    pushedTimer.current = setTimeout(() => setPushed(false), 2500);
  }

  const followingPush = pushedTab !== null && pushedTab === effectiveTab && override === null;
  const activeLabel = TABS.find((t) => t.id === effectiveTab)?.label ?? "Stats";
  const hasStats = (data?.stats?.length ?? 0) > 0;

  return (
    <div className="p-3">
      <div className="overflow-hidden rounded-xl border-[0.75px] border-line bg-surface">
        <div className="flex border-b border-line" role="tablist" aria-label="Match info">
          {TABS.map((t) => {
            const active = effectiveTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setOverride(t.id)}
                className={`flex-1 border-b-2 font-semibold ${big ? "h-12 text-base" : "h-10 text-sm"} ${
                  active
                    ? "border-gold text-primary"
                    : "border-transparent text-secondary hover:text-primary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* commentator push affordance / listener "following" hint */}
        {isRoomCommentator && roomId ? (
          <div className="flex items-center justify-between border-b border-line px-4 py-1.5">
            <span className="text-xs text-secondary">
              {pushed ? "Pushed ✓" : `Show ${activeLabel} to everyone`}
            </span>
            <button
              type="button"
              onClick={pushCurrent}
              className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-canvas"
            >
              Push
            </button>
          </div>
        ) : (
          followingPush && (
            <p className="border-b border-line px-4 py-1.5 text-xs text-secondary">
              Commentator is showing {activeLabel}
            </p>
          )
        )}

        <div className="p-4">
          {effectiveTab === "stats" &&
            (() => {
              if (!hasStats) {
                return (
                  <>
                    <StatGroups bars={placeholderStats()} size={size} />
                    <p className={`mt-3 text-secondary ${big ? "text-sm" : "text-xs"}`}>
                      Live match data arrives at kickoff.
                    </p>
                  </>
                );
              }
              const def = data!.stats.filter((b) => b.tier === "default");
              const more = data!.stats.filter((b) => b.tier === "more");
              return (
                <>
                  <StatGroups bars={def} size={size} />
                  {/* deeper stats: always on mobile, desktop only when expanded */}
                  <div className={`mt-3 ${expanded ? "" : "lg:hidden"}`}>
                    <DeeperStats
                      deep={data!.deep}
                      extended={more}
                      homeName={data!.home.name}
                      awayName={data!.away.name}
                      size={size}
                    />
                  </div>
                </>
              );
            })()}

          {effectiveTab === "events" && (
            <EventsTimeline events={data?.events ?? []} size={size} />
          )}

          {effectiveTab === "lineups" && (
            <LineupTabs
              home={data?.lineups.home ?? null}
              away={data?.lineups.away ?? null}
              size={size}
            />
          )}

          {data?.stale && (
            <p className="mt-3 text-xs text-secondary">Showing the last update.</p>
          )}
        </div>
      </div>
    </div>
  );
}
