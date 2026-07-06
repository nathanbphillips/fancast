"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KickoffTime } from "@/components/KickoffTime";
import { InviteCohost } from "@/components/host/InviteCohost";
import type { RoomState } from "@/lib/db/types";

/**
 * My rooms dashboard (FR-20.4/20.5): upcoming hosted rooms grouped by month
 * with subscription provenance, collision warnings, per-row + bulk cancel, and
 * the active-subscriptions list with Unsubscribe.
 */

export type DashboardRoom = {
  id: string;
  slug: string | null;
  state: RoomState;
  scheduled_kickoff: string;
  blurb: string | null;
  postponed: boolean;
  subscription_id: string | null;
  home_team: string;
  away_team: string;
  competition: string | null;
  /** other accepted hosts (FR-25.4) */
  coHosts: string[];
  /** room has a free host seat and is invitable (scheduled/waiting) */
  canInvite: boolean;
};

export type DashboardSubscription = {
  id: string;
  team_name: string;
  competition: string;
};

const COLLISION_MS = 3 * 60 * 60 * 1000;

function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function HostRoomsDashboard({
  rooms,
  subscriptions,
}: {
  rooms: DashboardRoom[];
  subscriptions: DashboardSubscription[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // FR-20.5: two rooms whose kickoffs sit within 3h are both flagged (double
  // game days are the host's call, so this warns, never blocks)
  const collisionIds = useMemo(() => {
    const flagged = new Set<string>();
    const times = rooms.map((r) => ({
      id: r.id,
      t: new Date(r.scheduled_kickoff).getTime(),
    }));
    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        if (Math.abs(times[i].t - times[j].t) < COLLISION_MS) {
          flagged.add(times[i].id);
          flagged.add(times[j].id);
        }
      }
    }
    return flagged;
  }, [rooms]);

  const cancelable = useMemo(
    () => rooms.filter((r) => r.state === "scheduled").map((r) => r.id),
    [rooms],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, DashboardRoom[]>();
    for (const r of rooms) {
      const k = monthKey(r.scheduled_kickoff);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()];
  }, [rooms]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkCancel() {
    if (selected.size === 0) return;
    if (!window.confirm(`Cancel ${selected.size} selected room(s)?`)) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/rooms/bulk-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomIds: [...selected] }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setNotice(body?.error ?? "Couldn't cancel the selected rooms.");
      return;
    }
    const body = await res.json().catch(() => ({ canceled: 0 }));
    setNotice(`${body.canceled} room(s) canceled.`);
    setSelected(new Set());
    router.refresh();
  }

  async function cancelOne(id: string, label: string) {
    if (!window.confirm(`Cancel your room for ${label}?`)) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" }).catch(
      () => null,
    );
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setNotice(body?.error ?? "Couldn't cancel.");
      return;
    }
    router.refresh();
  }

  async function unsubscribe(id: string, teamName: string) {
    if (
      !window.confirm(
        `Stop hosting all ${teamName} games? Future rooms from this subscription are canceled; past and live rooms stay.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/host-subscriptions/${id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setNotice(body?.error ?? "Couldn't unsubscribe.");
      return;
    }
    const body = await res.json().catch(() => ({ roomsCanceled: 0 }));
    setNotice(
      `Unsubscribed from ${teamName}: ${body.roomsCanceled} future room(s) canceled.`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-gold/40 bg-inset px-3 py-2 text-sm text-primary"
        >
          {notice}
        </p>
      )}

      {/* active subscriptions (FR-20.4) */}
      {subscriptions.length > 0 && (
        <section aria-label="Season subscriptions">
          <h2 className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase">
            Season hosting
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {subscriptions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold tracking-[-0.01em]">
                    All {s.team_name} games
                  </span>
                  <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                    {s.competition} · this season
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void unsubscribe(s.id, s.team_name)}
                  disabled={busy}
                  className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-red/50 hover:text-red disabled:opacity-60"
                >
                  Unsubscribe
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* bulk action bar */}
      {cancelable.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setSelected((prev) =>
                prev.size === cancelable.length
                  ? new Set()
                  : new Set(cancelable),
              )
            }
            className="text-xs font-semibold text-secondary underline-offset-2 hover:text-primary hover:underline"
          >
            {selected.size === cancelable.length
              ? "Clear selection"
              : "Select all scheduled"}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => void bulkCancel()}
              disabled={busy}
              className="rounded-md border border-red/50 px-3 py-1.5 text-xs font-bold text-red transition-colors hover:bg-red/10 disabled:opacity-60"
            >
              Cancel {selected.size} selected
            </button>
          )}
        </div>
      )}

      {/* rooms grouped by month */}
      {grouped.map(([month, monthRooms]) => (
        <section key={month} aria-label={month}>
          <h2 className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase">
            {month}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {monthRooms.map((r) => {
              const label = `${r.home_team} vs ${r.away_team}`;
              const enterable =
                r.state !== "scheduled" && r.state !== "canceled";
              const isScheduled = r.state === "scheduled";
              const collides = collisionIds.has(r.id);
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 border-t border-line px-4 py-3.5 first:border-t-0"
                >
                  {isScheduled && (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${label}`}
                      className="h-4 w-4 shrink-0 accent-(--red)"
                    />
                  )}
                  <span className="w-24 shrink-0 font-mono text-[10px] leading-snug tracking-wide text-secondary uppercase">
                    <KickoffTime iso={r.scheduled_kickoff} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* both live and scheduled rows link to the room; a host
                        opens a scheduled room's waiting room from there */}
                    <Link
                      href={`/room/${r.slug ?? r.id}`}
                      className="block truncate text-sm font-bold tracking-[-0.01em] hover:underline"
                    >
                      {label}
                    </Link>
                    <span className="flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] text-secondary uppercase">
                      <span className="truncate">
                        {r.postponed
                          ? "Postponed"
                          : (r.competition ?? "")}
                        {r.blurb ? ` · ${r.blurb}` : ""}
                      </span>
                      {r.subscription_id && (
                        <span className="rounded-sm bg-gold/20 px-1 text-gold">
                          Season
                        </span>
                      )}
                      {collides && (
                        <span className="rounded-sm bg-red/20 px-1 text-red normal-case">
                          Overlaps another room
                        </span>
                      )}
                    </span>
                    {(r.coHosts.length > 0 || r.canInvite) && (
                      <InviteCohost
                        roomId={r.id}
                        coHosts={r.coHosts}
                        canInvite={r.canInvite}
                      />
                    )}
                  </span>
                  {enterable ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white"
                      />
                      Live
                    </span>
                  ) : isScheduled ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/room/${r.slug ?? r.id}`}
                        className="rounded-md border border-gold px-2.5 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-raised"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => void cancelOne(r.id, label)}
                        disabled={busy}
                        className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-red/50 hover:text-red disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
