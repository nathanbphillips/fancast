"use client";

import { useEffect, useRef, useState } from "react";
import { StatBars } from "@/components/stats/StatBars";
import { EventsTimeline } from "@/components/stats/EventsTimeline";
import { LineupTabs } from "@/components/stats/LineupTabs";
import { DeeperStats } from "@/components/stats/DeeperStats";
import { MatchInfoPanel } from "@/components/stats/MatchInfoPanel";
import { MatchHistoryPanel } from "@/components/stats/MatchHistoryPanel";
import { PitchLineup } from "@/components/stats/PitchLineup";
import { StatsEditor } from "@/components/stats/StatsEditor";
import { placeholderStats } from "@/lib/stats";
import type { FixtureStats, StatBar, StatTab } from "@/lib/stats";
import type { MatchHistory } from "@/lib/history";
import type { StatOverrides } from "@/lib/statOverrides";

/**
 * Stats panel (Phase 7): Stats / Events / Line-ups, driven by live Sportmonks
 * data polled in RealtimeRoom. The commentator can push a tab to all listeners
 * (control channel); a listener's local tap overrides until the next push. In
 * radio mode the whole panel enlarges for background listening. Pre-match /
 * loading / seed fixtures fall back to the calm zeros placeholder.
 */

const TABS: { id: StatTab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "stats", label: "Stats" },
  { id: "events", label: "Timeline" },
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
  return (
    <>
      {groups.map((g, i) => (
        <div key={g.name} className={i === 0 ? "" : "mt-5"}>
          <p className="mb-2.5 font-mono text-[13px] font-bold tracking-[0.08em] text-secondary uppercase">
            {g.name}
          </p>
          <StatBars stats={g.items} size={size} />
        </div>
      ))}
    </>
  );
}

/** Mobile-only collapsible group ("Match stats" / "Advanced"). A plain header
 *  with a caret — not a bordered card — so it sits cleanly above grouped bars
 *  or the deeper-stats cards without nesting boxes inside boxes. */
function MobileGroup({
  title,
  defaultOpen = false,
  big,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  big: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 py-1.5 font-semibold ${big ? "text-base" : "text-sm"}`}
      >
        <span>{title}</span>
        <span
          aria-hidden
          className={`ml-auto inline-block text-secondary transition-transform ${open ? "" : "-rotate-90"}`}
        >
          ⌄
        </span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
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
  outage = false,
  history = null,
  historyLoading = false,
  comingSoon = false,
  defaultTab = "stats",
  fotmob = {},
  overrides = null,
  onSaveOverrides,
  rawLineups,
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
  /** live stats polling is currently failing — show a "delayed" cue instead of
   *  the calm pre-kickoff placeholder (which would be misleading mid-match). */
  outage?: boolean;
  /** pre-game history (league table + form), shown beside Info (Phase 11). */
  history?: MatchHistory | null;
  historyLoading?: boolean;
  /** admin game with no Sportmonks data (uncovered comp / not matched yet) —
   *  show a single calm "Information coming soon" instead of the tab content. */
  comingSoon?: boolean;
  /** the tab shown when nobody has overridden/pushed — "info" pre-game,
   *  "stats" once the match is underway (the kickoff auto-switch). */
  defaultTab?: StatTab;
  /** playerId → Fotmob profile URL, resolved in the background (Phase 11). */
  fotmob?: Record<number, string>;
  /** commentator's saved Info/Line-up corrections (Phase 11). */
  overrides?: StatOverrides | null;
  /** persist + broadcast a correction (commentator only). */
  onSaveOverrides?: (next: StatOverrides) => void;
  /** raw (pre-override) lineups — lets the editor re-surface "out" players. */
  rawLineups?: FixtureStats["lineups"];
}) {
  const [override, setOverride] = useState<StatTab | null>(null);
  const [editing, setEditing] = useState<"info" | "lineups" | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pushed, setPushed] = useState(false);
  const pushedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // a fresh push (even of the same tab) clears the listener's local override once
  useEffect(() => {
    setOverride(null);
  }, [pushedTab, pushNonce]);
  // kickoff auto-switch: when the default flips (e.g. info → stats at kickoff),
  // clear the local override so everyone lands on the new default (they can tap back)
  useEffect(() => {
    setOverride(null);
  }, [defaultTab]);
  useEffect(() => () => clearTimeout(pushedTimer.current), []);

  const effectiveTab: StatTab = override ?? pushedTab ?? defaultTab;
  const size = radio ? "radio" : "compact";
  const big = radio;

  // commentator-only Info / Line-up corrections (Phase 11)
  const editable = isRoomCommentator && !!onSaveOverrides && !!data && !comingSoon;
  function handleSaveOverrides(next: StatOverrides) {
    onSaveOverrides?.(next);
    setSavingEdit(true);
    setTimeout(() => {
      setSavingEdit(false);
      setEditing(null);
    }, 300);
  }
  // a small "Edit" affordance shown above an editable section
  const EditButton = ({ section }: { section: "info" | "lineups" }) =>
    editable ? (
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-semibold text-red hover:underline"
          onClick={() => setEditing(section)}
        >
          Edit {section === "info" ? "info" : "line-ups"}
        </button>
      </div>
    ) : null;

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
      <div className="overflow-hidden rounded-xl border-[0.75px] border-line bg-surface shadow-card">
        <div
          className="flex flex-wrap items-center gap-1 border-b border-line px-2.5 py-2 font-mono text-[10px] tracking-[0.04em]"
          role="tablist"
          aria-label="Match info"
        >
          {TABS.map((t) => {
            const active = effectiveTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`stats-tab-${t.id}`}
                aria-selected={active}
                aria-controls="stats-tabpanel"
                onClick={() => setOverride(t.id)}
                className={`rounded-md px-2.5 py-1.5 uppercase transition-colors ${
                  active
                    ? "bg-inverted font-bold text-inverted-fg"
                    : "text-secondary hover:text-primary"
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
              className="rounded-full bg-red px-2.5 py-0.5 text-xs font-semibold text-white"
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

        <div
          className="p-4"
          role="tabpanel"
          id="stats-tabpanel"
          aria-labelledby={`stats-tab-${effectiveTab}`}
        >
          {comingSoon ? (
            <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
              Information coming soon — venue, weather, referee, and live stats
              fill in automatically once they&apos;re available for this game.
            </p>
          ) : (
          <>
          {effectiveTab === "info" && (
            // pre-game: a single column, ordered History → team news →
            // venue/referee/weather (founder 2026-06-28). MatchInfoPanel renders
            // team news before venue/weather; History sits on top.
            <div className="space-y-4">
              {editing === "info" && data ? (
                <StatsEditor
                  section="info"
                  data={data}
                  overrides={overrides}
                  onSave={handleSaveOverrides}
                  onClose={() => setEditing(null)}
                  saving={savingEdit}
                />
              ) : (
                <EditButton section="info" />
              )}
              <MatchHistoryPanel
                history={history}
                loading={historyLoading}
                homeName={data?.home.name ?? "Home"}
                awayName={data?.away.name ?? "Away"}
                size={size}
              />
              <MatchInfoPanel
                info={data?.info ?? null}
                homeName={data?.home.name ?? "Home"}
                awayName={data?.away.name ?? "Away"}
              />
            </div>
          )}

          {effectiveTab === "stats" &&
            (() => {
              if (!hasStats) {
                return (
                  <>
                    <StatGroups bars={placeholderStats()} size={size} />
                    <p className={`mt-3 text-secondary ${big ? "text-sm" : "text-xs"}`}>
                      {outage
                        ? "Live stats are temporarily unavailable."
                        : "Live match data arrives at kickoff."}
                    </p>
                  </>
                );
              }
              const def = data!.stats.filter((b) => b.tier === "default");
              const more = data!.stats.filter((b) => b.tier === "more");
              const thirteen = <StatGroups bars={def} size={size} />;
              const deeper = (
                <DeeperStats
                  deep={data!.deep}
                  extended={more}
                  homeName={data!.home.name}
                  awayName={data!.away.name}
                  size={size}
                />
              );
              // KEY EVENTS digest (Cloud Design, founder 2026-07-02): the latest
              // few events surface right on the stats tab; the full list stays
              // under Timeline.
              const recentEvents = (data?.events ?? []).slice(-4);
              const keyEvents = recentEvents.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2.5 font-mono text-[13px] font-bold tracking-[0.08em] text-secondary uppercase">
                    Key events
                  </p>
                  <EventsTimeline events={recentEvents} size={size} />
                </div>
              );
              return (
                <>
                  {/* desktop: plain 13; deeper inline only when expanded to 50% */}
                  <div className="hidden lg:block">
                    {thirteen}
                    {expanded && <div className="mt-3">{deeper}</div>}
                    {keyEvents}
                  </div>
                  {/* mobile: collapsible "Match stats" + "Advanced" (deeper always below) */}
                  <div className="space-y-3 lg:hidden">
                    <MobileGroup title="Match stats" defaultOpen big={big}>
                      {thirteen}
                    </MobileGroup>
                    <MobileGroup title="Advanced" defaultOpen big={big}>
                      {deeper}
                    </MobileGroup>
                    {keyEvents}
                  </div>
                </>
              );
            })()}

          {effectiveTab === "events" && (
            <EventsTimeline events={data?.events ?? []} size={size} />
          )}

          {effectiveTab === "lineups" && (
            <div className="space-y-3">
              {editing === "lineups" && data ? (
                <StatsEditor
                  section="lineups"
                  data={data}
                  rawLineups={rawLineups}
                  overrides={overrides}
                  onSave={handleSaveOverrides}
                  onClose={() => setEditing(null)}
                  saving={savingEdit}
                />
              ) : (
                <EditButton section="lineups" />
              )}
              {(() => {
                const lu = data?.lineups;
                // pitch view when we have formation positions; else the text list
                const pitchable =
                  !!lu &&
                  ((lu.home?.starters.some((p) => p.line != null) ?? false) ||
                    (lu.away?.starters.some((p) => p.line != null) ?? false));
                return pitchable ? (
                  <PitchLineup home={lu!.home} away={lu!.away} fotmob={fotmob} />
                ) : (
                  <LineupTabs
                    home={lu?.home ?? null}
                    away={lu?.away ?? null}
                    size={size}
                    fotmob={fotmob}
                  />
                );
              })()}
            </div>
          )}

          {(data?.stale || (outage && hasStats)) && (
            <p className="mt-3 text-xs text-secondary">Showing the last update.</p>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
