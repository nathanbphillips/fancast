"use client";

import { useEffect, useRef, useState } from "react";
import type { FixtureStats } from "@/lib/stats";

/**
 * Resolve lineup players to Fotmob profile links (Phase 11). Fires once the
 * lineup appears (and again if the player set changes, e.g. a sub comes on),
 * POSTing the players to /api/fotmob/resolve, which serves cache + resolves the
 * rest in the background. Returns a playerId → profile-URL map; players with no
 * confident match are simply absent (the UI falls back to a search link).
 */
export function useFotmobLinks(
  fixtureId: number,
  lineups: FixtureStats["lineups"] | undefined,
  homeName: string,
  awayName: string,
): Record<number, string> {
  const [links, setLinks] = useState<Record<number, string>>({});
  const requestedKey = useRef<string>("");

  useEffect(() => {
    const home = lineups?.home;
    const away = lineups?.away;
    if (!home && !away) return;

    const players = new Map<number, { playerId: number; name: string; team: string }>();
    const add = (list: { playerId: number; name: string }[] | undefined, team: string) => {
      for (const p of list ?? []) {
        if (p.playerId != null && p.name && !players.has(p.playerId)) {
          players.set(p.playerId, { playerId: p.playerId, name: p.name, team });
        }
      }
    };
    add(home?.starters, home?.teamName ?? homeName);
    add(home?.bench, home?.teamName ?? homeName);
    add(away?.starters, away?.teamName ?? awayName);
    add(away?.bench, away?.teamName ?? awayName);
    if (players.size === 0) return;

    // resolve only when the player set actually changes (the stats poll hands us
    // a fresh lineups object every ~10s even when nothing changed).
    const key = `${fixtureId}:${[...players.keys()].sort((a, b) => a - b).join(",")}`;
    if (requestedKey.current === key) return;
    requestedKey.current = key;

    let cancelled = false;
    void fetch("/api/fotmob/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: [...players.values()] }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { links?: Record<string, string | null> } | null) => {
        if (cancelled || !data?.links) return;
        const map: Record<number, string> = {};
        for (const [id, url] of Object.entries(data.links)) if (url) map[Number(id)] = url;
        if (Object.keys(map).length) setLinks((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [fixtureId, lineups, homeName, awayName]);

  return links;
}
