"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin tools (admin-only page). A deliberately tight create-room form — just
 * home team, away team, and kickoff — plus a manual "run the Sportmonks match
 * check" trigger (the same endpoint a daily cron hits).
 */
export function AdminTools() {
  const router = useRouter();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [matchMsg, setMatchMsg] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!home.trim() || !away.trim() || !kickoff || busy) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeam: home.trim(),
        awayTeam: away.trim(),
        // datetime-local is wall-clock; convert to a UTC ISO string
        kickoffUtc: new Date(kickoff).toISOString(),
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.roomId) router.push(`/room/${body.roomId}`);
    } else {
      const body = res ? await res.json().catch(() => ({})) : {};
      setErr(body.error ?? "Couldn't create the room.");
    }
  }

  async function runMatch() {
    setMatching(true);
    setMatchMsg("Checking Sportmonks…");
    const res = await fetch("/api/admin/match-fixtures", { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setMatching(false);
    setMatchMsg(
      res?.ok
        ? `Checked ${body.checked ?? 0}, matched ${body.matched ?? 0}.`
        : (body.error ?? "Match check failed."),
    );
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary";

  return (
    <div className="mt-6 space-y-6">
      <form
        onSubmit={createRoom}
        className="space-y-3 rounded-xl border-[0.75px] border-line bg-surface p-4"
      >
        <h2 className="text-sm font-bold">New room</h2>
        <div>
          <label htmlFor="home" className="mb-1 block text-xs font-semibold text-secondary">
            Home team
          </label>
          <input
            id="home"
            type="text"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            maxLength={40}
            placeholder="e.g. Brazil"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="away" className="mb-1 block text-xs font-semibold text-secondary">
            Away team
          </label>
          <input
            id="away"
            type="text"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            maxLength={40}
            placeholder="e.g. Argentina"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="kickoff" className="mb-1 block text-xs font-semibold text-secondary">
            Kickoff (your local time)
          </label>
          <input
            id="kickoff"
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className={inputClass}
          />
        </div>
        {err && (
          <p role="alert" className="text-xs text-red">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !home.trim() || !away.trim() || !kickoff}
          className="h-11 w-full rounded-lg bg-red text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create room"}
        </button>
        <p className="text-[11px] text-secondary">
          Title shows only the teams. Venue, weather, referee, and live stats
          fill in automatically once Sportmonks has the game (covered
          competitions only) — otherwise the room shows “Information coming soon”.
        </p>
      </form>

      <div className="rounded-xl border-[0.75px] border-line bg-surface p-4">
        <h2 className="text-sm font-bold">Sportmonks match check</h2>
        <p className="mt-1 text-xs text-secondary">
          Runs automatically each day; trigger it now to backfill match data for
          any rooms you just created.
        </p>
        <button
          type="button"
          onClick={runMatch}
          disabled={matching}
          className="mt-3 h-10 rounded-lg border border-line px-4 text-sm font-semibold hover:bg-raised disabled:opacity-60"
        >
          {matching ? "Checking…" : "Run match check"}
        </button>
        {matchMsg && <p className="mt-2 text-xs text-secondary">{matchMsg}</p>}
      </div>
    </div>
  );
}
