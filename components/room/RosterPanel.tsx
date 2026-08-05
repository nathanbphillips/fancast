"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

type RosterMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};
type Roster = { members: RosterMember[]; anonCount: number; total: number };

/**
 * Host-only "Who's here" roster (founder 2026-08-05). Opens a small popover
 * listing the signed-in listeners currently present plus an anonymous count.
 * Identity is resolved server-side by the host-gated /roster route (never on
 * the wire), so this component only ever fetches — it holds no presence state.
 * Poll-on-open (15s); nothing runs while closed.
 */
export function RosterPanel({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/roster`);
      if (res.ok) setRoster((await res.json()) as Roster);
    } catch {
      // best-effort; keep the last-known list
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // fetch on open + refresh every 15s while open; stop when closed
  useEffect(() => {
    if (!open) return;
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [open, load]);

  // close on Escape or an outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-secondary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        Who&apos;s here
        {roster && <span className="tabular-nums">({roster.total})</span>}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-raised)]">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="font-mono text-[10px] tracking-[0.08em] text-secondary uppercase">
              In the room
            </p>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Refresh"
              className="font-mono text-[11px] text-secondary hover:text-primary"
            >
              ↻
            </button>
          </div>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain">
            {roster?.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <Avatar src={m.avatarUrl} name={m.username} size={26} />
                <span className="truncate text-sm font-semibold">
                  {m.username}
                </span>
              </li>
            ))}
            {roster &&
              roster.members.length === 0 &&
              roster.anonCount === 0 && (
                <li className="px-2 py-3 text-center text-xs text-secondary">
                  {loading ? "Loading…" : "No one here yet."}
                </li>
              )}
          </ul>
          {roster && roster.anonCount > 0 && (
            <p className="border-t border-line px-2 pt-2 pb-1 text-xs text-secondary tabular-nums">
              +{roster.anonCount} listening anonymously
            </p>
          )}
        </div>
      )}
    </div>
  );
}
