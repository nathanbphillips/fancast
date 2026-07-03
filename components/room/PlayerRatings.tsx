"use client";

import { useState } from "react";
import type { MyRatings, RatingPlayer, RatingsAggregate } from "@/lib/db/types";
import { useToast } from "@/components/Toast";

/**
 * Player ratings (FR-12.3). Postgame, signed-in listeners rate the XI + subs
 * 1-10; the live per-player average renders for everyone via the control
 * channel. Read-only otherwise. The player list comes from the lineup in the
 * stats payload.
 */
export function PlayerRatings({
  roomId,
  players,
  agg,
  myRatings,
  open,
  hint,
  homeName,
  awayName,
}: {
  roomId: string;
  players: RatingPlayer[];
  agg: RatingsAggregate;
  myRatings: MyRatings;
  /** ratings accepted (half-time / postgame windows, and this viewer may rate) */
  open: boolean;
  /** phase note under the heading, e.g. "Rating the first half" */
  hint?: string;
  homeName: string;
  awayName: string;
}) {
  const [mine, setMine] = useState<MyRatings>(myRatings);
  const [busy, setBusy] = useState<number | null>(null);
  const toast = useToast();
  const avgOf = (pid: number) => agg.find((a) => a.playerId === pid);

  async function rate(playerId: number, rating: number) {
    const prev = mine;
    setBusy(playerId);
    setMine((m) => ({ ...m, [playerId]: rating })); // optimistic
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, playerId, rating }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setMine(prev); // roll back just this rating, not every change this session
      toast("Couldn't save your rating.");
    }
  }

  const Row = ({ p }: { p: RatingPlayer }) => {
    const a = avgOf(p.playerId);
    return (
      <li className="flex items-center gap-2 py-1 text-xs">
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        {a ? (
          <span className="shrink-0 font-semibold tabular-nums">
            {a.avg.toFixed(1)}
            <span className="ml-0.5 text-[10px] text-secondary">({a.count})</span>
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-secondary">—</span>
        )}
        {open && (
          <select
            value={mine[p.playerId] ?? ""}
            disabled={busy === p.playerId}
            onChange={(e) => rate(p.playerId, Number(e.target.value))}
            aria-label={`Rate ${p.name}`}
            className="h-7 shrink-0 rounded-md border border-line bg-surface text-xs tabular-nums disabled:opacity-60"
          >
            <option value="" disabled>
              rate
            </option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </li>
    );
  };

  const sideBlock = (side: "home" | "away", name: string) => {
    const list = players.filter((p) => p.side === side);
    if (list.length === 0) return null;
    const starters = list.filter((p) => p.starter);
    const subs = list.filter((p) => !p.starter);
    return (
      <div>
        <p className="mb-1 text-[11px] font-semibold text-secondary">{name}</p>
        <ul>
          {starters.map((p) => (
            <Row key={p.playerId} p={p} />
          ))}
        </ul>
        {subs.length > 0 && (
          <>
            <p className="mb-1 mt-2 text-[10px] font-semibold text-secondary">Subs</p>
            <ul>
              {subs.map((p) => (
                <Row key={p.playerId} p={p} />
              ))}
            </ul>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mt-3 rounded-xl border-[0.75px] border-line bg-surface p-3">
      <p className="text-sm font-semibold">Player ratings</p>
      {hint && <p className="mt-0.5 text-[11px] text-secondary">{hint}</p>}
      <div className="mt-2 space-y-3">
        {sideBlock("home", homeName)}
        {sideBlock("away", awayName)}
      </div>
    </div>
  );
}
