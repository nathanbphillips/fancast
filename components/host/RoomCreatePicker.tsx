"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KickoffTime } from "@/components/KickoffTime";
import { CustomRoomForm } from "@/components/host/CustomRoomForm";

/**
 * Fixture picker + create form (FR-19.1/19.2). Chronological upcoming
 * fixtures; tapping one expands the ONLY two inputs a room needs: broadcast
 * start (default kickoff minus 15 minutes) and an optional 140-char blurb.
 * Everything else comes from the API. Above the list, CustomRoomForm covers
 * games that aren't listed (founder 2026-07-06): custom title + start time,
 * with a Sportmonks suggest to link covered matches.
 */
export type PickerFixture = {
  id: number;
  home_team: string;
  away_team: string;
  competition: string | null;
  kickoff_utc: string;
  // season-hosting scope (FR-20); null when the competition isn't API-listed
  home_team_id: number | null;
  away_team_id: number | null;
  league_id: number | null;
  season: number | null;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function RoomCreatePicker({ fixtures }: { fixtures: PickerFixture[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState<number | null>(null);
  const [subDone, setSubDone] = useState<string | null>(null);

  function toggle(f: PickerFixture) {
    setError(null);
    setBlurb("");
    setSubDone(null);
    if (openId === f.id) {
      setOpenId(null);
      return;
    }
    setOpenId(f.id);
    setStart(
      toLocalInputValue(
        new Date(
          new Date(f.kickoff_utc).getTime() - 15 * 60 * 1000,
        ).toISOString(),
      ),
    );
  }

  async function create(e: React.FormEvent, fixtureId: number) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        fixtureId,
        broadcastStart: start ? new Date(start).toISOString() : undefined,
        blurb: blurb.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't create the room.");
      return;
    }
    router.push("/host");
    router.refresh();
  }

  async function subscribe(f: PickerFixture, teamId: number, teamName: string) {
    setSubBusy(teamId);
    setError(null);
    setSubDone(null);
    const res = await fetch("/api/host-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: f.id, teamId }),
    }).catch(() => null);
    setSubBusy(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't set up season hosting.");
      return;
    }
    const body = await res.json().catch(() => ({ roomsCreated: 0 }));
    setSubDone(
      `Hosting all ${teamName} games this season: ${body.roomsCreated} room${body.roomsCreated === 1 ? "" : "s"} scheduled.`,
    );
    router.refresh();
  }

  if (fixtures.length === 0) {
    return (
      <div>
        <CustomRoomForm />
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
          No upcoming fixtures you don&apos;t already host. New games appear
          here as the schedule fills in, or create your own room above.
        </p>
      </div>
    );
  }

  return (
    <div>
    <CustomRoomForm />
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {fixtures.map((f) => (
        <div key={f.id} className="border-t border-line first:border-t-0">
          <button
            type="button"
            onClick={() => toggle(f)}
            aria-expanded={openId === f.id}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-raised"
          >
            <span className="w-24 shrink-0 font-mono text-[10px] leading-snug tracking-wide text-secondary uppercase">
              <KickoffTime iso={f.kickoff_utc} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold tracking-[-0.01em]">
                {f.home_team} vs {f.away_team}
              </span>
              {f.competition && (
                <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                  {f.competition}
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={`shrink-0 text-secondary transition-transform ${openId === f.id ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>

          {openId === f.id && (
            <form
              onSubmit={(e) => create(e, f.id)}
              className="space-y-3 border-t border-line/60 bg-raised/50 px-4 py-4"
            >
              {error && (
                <p role="alert" className="rounded-lg border border-red/40 bg-inset px-3 py-2 text-sm text-red">
                  {error}
                </p>
              )}
              <div>
                <label
                  htmlFor={`start-${f.id}`}
                  className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
                >
                  Broadcast start
                </label>
                <input
                  id={`start-${f.id}`}
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                  className="h-11 rounded-lg border border-line bg-inset px-3 text-sm tabular-nums"
                />
                <p className="mt-1 text-xs text-secondary">
                  Defaults to 15 minutes before kickoff, in your local time.
                </p>
              </div>
              <div>
                <label
                  htmlFor={`blurb-${f.id}`}
                  className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
                >
                  Blurb <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  id={`blurb-${f.id}`}
                  type="text"
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  maxLength={140}
                  placeholder="Your angle on the game, one line"
                  className="h-11 w-full rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-hover disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create room"}
              </button>

              {/* season hosting (FR-20.1): one click, a room for every game
                  this team plays in this competition this season */}
              {f.league_id != null &&
                f.season != null &&
                (f.home_team_id != null || f.away_team_id != null) && (
                  <div className="mt-1 border-t border-line/60 pt-3">
                    <p className="mb-2 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
                      Or host the whole season
                    </p>
                    {subDone ? (
                      <p className="rounded-lg border border-gold/40 bg-inset px-3 py-2 text-sm text-primary">
                        {subDone}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {f.home_team_id != null && (
                          <button
                            type="button"
                            disabled={subBusy != null}
                            onClick={() =>
                              subscribe(f, f.home_team_id!, f.home_team)
                            }
                            className="rounded-lg border border-gold px-3.5 py-2 text-sm font-semibold text-gold transition-colors hover:bg-raised disabled:opacity-60"
                          >
                            {subBusy === f.home_team_id
                              ? "Scheduling…"
                              : `Host all ${f.home_team} games`}
                          </button>
                        )}
                        {f.away_team_id != null && (
                          <button
                            type="button"
                            disabled={subBusy != null}
                            onClick={() =>
                              subscribe(f, f.away_team_id!, f.away_team)
                            }
                            className="rounded-lg border border-gold px-3.5 py-2 text-sm font-semibold text-gold transition-colors hover:bg-raised disabled:opacity-60"
                          >
                            {subBusy === f.away_team_id
                              ? "Scheduling…"
                              : `Host all ${f.away_team} games`}
                          </button>
                        )}
                      </div>
                    )}
                    {f.competition && !subDone && (
                      <p className="mt-1.5 text-xs text-secondary">
                        Every {f.competition} game this season, now and as new
                        fixtures appear.
                      </p>
                    )}
                  </div>
                )}
            </form>
          )}
        </div>
      ))}
    </div>
    </div>
  );
}
