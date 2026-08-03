"use client";

import { useState } from "react";

export type BugRow = {
  id: string;
  created_at: string;
  username: string | null;
  room_id: string | null;
  room_state: string | null;
  category: string | null;
  description: string;
  path: string | null;
  viewport: string | null;
  user_agent: string | null;
  status: string;
};

/** Admin triage list for the in-app bug reporter (migration 0040). Read-only
 *  detail + an open/closed toggle; optimistic with revert on failure. */
export function AdminBugs({ initial }: { initial: BugRow[] }) {
  const [bugs, setBugs] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "open" | "closed") {
    setBusyId(id);
    const prev = bugs;
    setBugs((b) => b.map((x) => (x.id === id ? { ...x, status } : x)));
    const res = await fetch("/api/admin/bugs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) setBugs(prev);
  }

  const openCount = bugs.filter((b) => b.status !== "closed").length;

  if (bugs.length === 0) {
    return <p className="mt-3 text-sm text-secondary">No bug reports yet.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-secondary">
        {openCount} open · {bugs.length} total (most recent first)
      </p>
      <ul className="space-y-3">
        {bugs.map((b) => (
          <li
            key={b.id}
            className={`rounded-xl border border-line p-3 ${
              b.status === "closed" ? "opacity-55" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                {b.category && (
                  <span className="rounded-full bg-raised px-2 py-0.5 font-semibold text-primary">
                    {b.category}
                  </span>
                )}
                <span>{b.username ? `@${b.username}` : "guest"}</span>
                <span>· {b.created_at.slice(0, 16).replace("T", " ")}</span>
                {b.room_state && <span>· {b.room_state}</span>}
              </div>
              <button
                type="button"
                onClick={() =>
                  setStatus(b.id, b.status === "closed" ? "open" : "closed")
                }
                disabled={busyId === b.id}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-raised disabled:opacity-60"
              >
                {b.status === "closed" ? "Reopen" : "Resolve"}
              </button>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{b.description}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-tertiary">
              {b.path && <span>{b.path}</span>}
              {b.viewport && <span>{b.viewport}</span>}
              {b.room_id && <span>room {b.room_id.slice(0, 8)}</span>}
              {b.user_agent && (
                <span className="max-w-[280px] truncate" title={b.user_agent}>
                  {b.user_agent}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
