"use client";

import { useEffect, useRef, useState } from "react";
import { StatBars } from "@/components/stats/StatBars";
import { EventsTimeline } from "@/components/stats/EventsTimeline";
import { LineupTabs } from "@/components/stats/LineupTabs";
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

// pre-match defaults: zeros, possession 50/50 (founder decision)
const PLACEHOLDER: StatBar[] = [
  { code: "ball-possession", label: "Possession", home: 50, away: 50, unit: "pct" },
  { code: "shots-total", label: "Shots", home: 0, away: 0, unit: "count" },
  { code: "shots-on-target", label: "On target", home: 0, away: 0, unit: "count" },
  { code: "corners", label: "Corners", home: 0, away: 0, unit: "count" },
  { code: "fouls", label: "Fouls", home: 0, away: 0, unit: "count" },
];

export function StatsPanel({
  data,
  radio = false,
  isRoomCommentator = false,
  roomId,
  pushedTab = null,
  pushNonce = 0,
  onPushTab,
}: {
  data: FixtureStats | null;
  radio?: boolean;
  isRoomCommentator?: boolean;
  roomId?: string;
  pushedTab?: StatTab | null;
  pushNonce?: number;
  onPushTab?: (tab: StatTab) => void;
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
            (hasStats ? (
              <StatBars stats={data!.stats} size={size} />
            ) : (
              <>
                <StatBars stats={PLACEHOLDER} size={size} />
                <p className={`mt-3 text-secondary ${big ? "text-sm" : "text-xs"}`}>
                  Live match data arrives at kickoff.
                </p>
              </>
            ))}

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
