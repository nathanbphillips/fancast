"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { StatsPanel } from "./StatsPanel";
import { LinksPanel } from "./LinksPanel";

/**
 * Room layout shell (docs/DESIGN.md):
 * - Mobile (built first): stacked — chat dominates, stats/links via tabs.
 * - Desktop (lg+): three columns, stats 25% | chat 50% | links 25%.
 * Client component only for the mobile tab switcher.
 */

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "stats", label: "Stats" },
  { id: "links", label: "Links" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RoomShell() {
  const [tab, setTab] = useState<TabId>("chat");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile tab bar */}
      <nav
        aria-label="Room sections"
        className="flex border-b border-line bg-surface lg:hidden"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`h-11 flex-1 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-gold text-primary"
                : "text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Mobile: one panel at a time, chat default */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {tab === "chat" && <ChatPanel />}
        {tab === "stats" && (
          <div className="overflow-y-auto">
            <StatsPanel />
          </div>
        )}
        {tab === "links" && (
          <div className="overflow-y-auto">
            <LinksPanel />
          </div>
        )}
      </div>

      {/* Desktop: stats 25 / chat 50 / links 25 */}
      <div className="mx-auto hidden min-h-0 w-full max-w-7xl flex-1 lg:grid lg:grid-cols-[1fr_2fr_1fr]">
        <aside aria-label="Stats" className="overflow-y-auto border-r border-line">
          <StatsPanel />
        </aside>
        <section aria-label="Chat" className="flex min-h-0 flex-col">
          <ChatPanel />
        </section>
        <aside aria-label="Links" className="overflow-y-auto border-l border-line">
          <LinksPanel />
        </aside>
      </div>
    </div>
  );
}
