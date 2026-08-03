"use client";

import { useMemo, useState } from "react";
import type { UserInsight } from "@/lib/db/adminInsights";
import { formatDuration } from "@/lib/formatDuration";

type SortKey =
  | "joinedAt"
  | "lastSignInAt"
  | "listeningSeconds"
  | "matchesAttended"
  | "hostedRooms"
  | "fanScore"
  | "username";

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "username", label: "User" },
  { key: "joinedAt", label: "Joined" },
  { key: "lastSignInAt", label: "Last login" },
  { key: "listeningSeconds", label: "Listening", numeric: true },
  { key: "matchesAttended", label: "Matches", numeric: true },
  { key: "hostedRooms", label: "Hosted", numeric: true },
  { key: "fanScore", label: "Fan score", numeric: true },
];

function day(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}
function ago(iso: string | null): string {
  if (!iso) return "never";
  const d = Date.now() - Date.parse(iso);
  const days = Math.floor(d / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function InsightsUsersTable({ users }: { users: UserInsight[] }) {
  const [sort, setSort] = useState<SortKey>("joinedAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term
      ? users.filter(
          (u) =>
            u.username.toLowerCase().includes(term) ||
            (u.email ?? "").toLowerCase().includes(term),
        )
      : users;
    const sorted = [...filtered].sort((a, b) => {
      let cmp: number;
      if (sort === "username") cmp = a.username.localeCompare(b.username);
      else if (sort === "joinedAt" || sort === "lastSignInAt") {
        const av = a[sort] ? Date.parse(a[sort] as string) : 0;
        const bv = b[sort] ? Date.parse(b[sort] as string) : 0;
        cmp = av - bv;
      } else cmp = (a[sort] as number) - (b[sort] as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [users, sort, dir, q]);

  function toggle(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "username" ? "asc" : "desc");
    }
  }

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by username or email…"
        className="mb-3 h-9 w-full max-w-xs rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
      />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-raised/50 font-mono text-[11px] tracking-[0.04em] text-secondary uppercase">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  className={`cursor-pointer px-3 py-2 whitespace-nowrap select-none hover:text-primary ${
                    c.numeric ? "text-right" : ""
                  }`}
                >
                  {c.label}
                  {sort === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} className="border-b border-line/60 last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">
                      {u.username}
                    </span>
                    {u.role !== "listener" && (
                      <span className="rounded-full bg-raised px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-secondary uppercase">
                        {u.role}
                      </span>
                    )}
                    {u.standing === "restricted" && (
                      <span className="rounded-full bg-red/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-red uppercase">
                        restricted
                      </span>
                    )}
                  </div>
                  {u.email && (
                    <div className="truncate font-mono text-[10px] text-tertiary">
                      {u.email}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-secondary tabular-nums">
                  {day(u.joinedAt)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-secondary tabular-nums">
                  {ago(u.lastSignInAt)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {formatDuration(u.listeningSeconds)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {u.matchesAttended}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {u.hostedRooms > 0 ? (
                    <span className="font-semibold text-primary">
                      {u.hostedRooms}
                    </span>
                  ) : (
                    <span className="text-tertiary">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u.fanScore}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-6 text-center text-secondary">
                  No users match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
