"use client";

import { useState } from "react";
import type { LineupPlayer, SideLineup } from "@/lib/stats";

/** Home XI / Away XI with formation, starting XI (GK first, by formation line),
 *  and the bench. */
export function LineupTabs({
  home,
  away,
  size = "compact",
}: {
  home: SideLineup | null;
  away: SideLineup | null;
  size?: "compact" | "radio";
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const big = size === "radio";

  if (!home && !away) {
    return (
      <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
        Line-ups are posted about an hour before kickoff.
      </p>
    );
  }
  const active = (side === "home" ? home : away) ?? home ?? away!;

  const Row = ({ p }: { p: LineupPlayer }) => (
    <li className={`flex items-center gap-2 ${big ? "text-base" : "text-sm"}`}>
      <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-secondary">
        {p.jersey ?? "–"}
      </span>
      <span className="truncate">{p.name}</span>
    </li>
  );

  return (
    <div>
      <div className="mb-3 flex gap-1" role="group" aria-label="Choose team">
        {([["home", home], ["away", away]] as const).map(([key, l]) => {
          if (!l) return null;
          const isActive =
            side === key || (side === "home" && !home) || (side === "away" && !away);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSide(key)}
              className={`flex-1 truncate border-b-2 pb-1.5 font-semibold ${big ? "text-base" : "text-sm"} ${
                isActive
                  ? "border-gold text-primary"
                  : "border-transparent text-secondary hover:text-primary"
              }`}
            >
              {l.teamName}
            </button>
          );
        })}
      </div>

      <p className={`mb-2 text-secondary ${big ? "text-sm" : "text-xs"}`}>
        {active.teamName}
        {active.formation ? ` · ${active.formation}` : ""}
      </p>

      {active.starters.length > 0 && (
        <ul className={big ? "space-y-2" : "space-y-1"}>
          {active.starters.map((p) => (
            <Row key={p.playerId} p={p} />
          ))}
        </ul>
      )}

      {active.bench.length > 0 && (
        <>
          <p className={`mb-1 mt-3 font-semibold text-secondary ${big ? "text-sm" : "text-xs"}`}>
            Bench
          </p>
          <ul className={big ? "space-y-2" : "space-y-1"}>
            {active.bench.map((p) => (
              <Row key={p.playerId} p={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
