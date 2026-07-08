"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KickoffTime } from "@/components/KickoffTime";

/**
 * Create a room that isn't tied to the listed fixtures (founder 2026-07-06).
 * The host sets a title ("Home vs Away") and a start time (right now or in the
 * future). Typing the title searches our covered competitions; picking a
 * suggestion links the room to the real fixture so live stats flow. Unlinked
 * rooms get a friendly early-access note (stats may not be available; more
 * leagues coming) plus a free-text league-request box.
 */

type Suggestion = {
  sportmonksFixtureId: number;
  home: string;
  away: string;
  kickoffUtc: string;
  competition: string;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

/** now, rounded up to the next 5 minutes, as a datetime-local value */
function nowLocalInput(): string {
  const step = 5 * 60_000;
  return toLocalInputValue(
    new Date(Math.ceil(Date.now() / step) * step).toISOString(),
  );
}

export function CustomRoomForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [blurb, setBlurb] = useState("");
  const [linked, setLinked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reqLeague, setReqLeague] = useState("");
  const [reqState, setReqState] = useState<"idle" | "busy" | "done">("idle");
  const [reqError, setReqError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // debounced fixture suggest while the host types a title (unlinked only)
  useEffect(() => {
    if (linked || title.trim().length < 3) {
      abortRef.current?.abort(); // drop any in-flight request too
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/fixtures/search?q=${encodeURIComponent(title.trim())}`,
          { signal: ctrl.signal },
        );
        const body = await res.json().catch(() => ({ results: [] }));
        // ignore a response that resolved after we moved on (linked/cleared)
        if (abortRef.current === ctrl) {
          setSuggestions(Array.isArray(body.results) ? body.results : []);
        }
      } catch {
        /* aborted or offline: no suggestions is fine */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [title, linked]);

  function openForm() {
    setOpen(true);
    if (!start) setStart(nowLocalInput());
  }

  function pick(s: Suggestion) {
    setLinked(s);
    setTitle(`${s.home} vs ${s.away}`);
    setSuggestions([]);
    // default the show start to 15 min before kickoff, but never in the past
    const suggested = new Date(s.kickoffUtc).getTime() - 15 * 60_000;
    setStart(
      toLocalInputValue(
        new Date(Math.max(suggested, Date.now() + 60_000)).toISOString(),
      ),
    );
  }

  function unlink() {
    setLinked(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // the "now" default is stamped once when the form opens; if the host spent
    // a while filling it in, that value may have gone stale (server rejects a
    // start older than a minute), so clamp a past value up to now
    const startMs = Math.max(new Date(start).getTime(), Date.now() + 30_000);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_custom",
        title: title.trim(),
        startIso: new Date(startMs).toISOString(),
        blurb: blurb.trim() || undefined,
        sportmonksFixtureId: linked?.sportmonksFixtureId,
      }),
    }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error ?? "Couldn't create the room.");
      return;
    }
    const room = body?.room as { slug?: string; state?: string } | undefined;
    if (room?.state === "waiting" && room.slug) {
      // immediate room: straight into your waiting room
      router.push(`/room/${room.slug}`);
    } else {
      router.push("/host");
    }
    router.refresh();
  }

  async function requestLeague() {
    const league = reqLeague.trim();
    if (league.length < 2) {
      setReqError("Tell us the league or competition name.");
      return;
    }
    setReqState("busy");
    setReqError(null);
    const res = await fetch("/api/league-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ league }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setReqState("idle");
      setReqError(body?.error ?? "Couldn't send that. Try again.");
      return;
    }
    setReqState("done");
  }

  if (!open) {
    return (
      <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold tracking-[-0.01em]">
            Can&apos;t find your match in the list?
          </p>
          <p className="mt-0.5 text-[12.5px] text-secondary">
            Create a room for any game, starting right now or later.
          </p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-raised"
        >
          Create your own room
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 space-y-3 rounded-2xl border border-line bg-surface px-5 py-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold tracking-[-0.01em]">
          Create your own room
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-secondary hover:text-primary"
        >
          Close
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-inset px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      {/* title + suggest */}
      <div className="relative">
        <label
          htmlFor="custom-title"
          className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Room title
        </label>
        <input
          id="custom-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (linked) setLinked(null);
          }}
          required
          maxLength={90}
          placeholder="Arsenal vs Chelsea"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary"
        />
        <p className="mt-1 text-xs text-secondary">
          Use &quot;Home vs Away&quot;. Start typing to search matches we cover
          and link live stats automatically.
        </p>
        {!linked && suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Matching fixtures"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-raised"
          >
            {suggestions.map((s) => (
              <li key={s.sportmonksFixtureId}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-3 border-t border-line/60 px-3 py-2.5 text-left first:border-t-0 hover:bg-raised"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {s.home} vs {s.away}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                      {s.competition}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-secondary uppercase">
                    <KickoffTime iso={s.kickoffUtc} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {linked ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green/40 bg-inset px-3 py-2">
          <p className="text-[12.5px] text-secondary">
            <span className="font-semibold text-green">Linked:</span>{" "}
            {linked.home} vs {linked.away} ({linked.competition}). Live stats
            will flow automatically.
          </p>
          <button
            type="button"
            onClick={unlink}
            className="shrink-0 text-xs font-semibold text-secondary underline underline-offset-2 hover:text-primary"
          >
            Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-line bg-inset px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-secondary">
            <span className="font-semibold text-primary">
              Not linked to our data feed yet.
            </span>{" "}
            If this match is in a competition we cover, we&apos;ll keep trying
            to connect it automatically before kickoff. Otherwise live stats
            won&apos;t be available for this room; chat, audio, recordings, and
            everything else work as normal.
          </p>
          <p className="text-[12.5px] leading-relaxed text-secondary">
            We&apos;re a new product in our early days, so we started with a
            handful of leagues and we&apos;re adding more as fast as we can.
            Thanks for bearing with us.
          </p>
          {reqState === "done" ? (
            <p className="text-[12.5px] font-semibold text-green">
              Noted, thank you! We read every request.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={reqLeague}
                onChange={(e) => setReqLeague(e.target.value)}
                maxLength={80}
                placeholder="Which league or competition should we add next?"
                aria-label="League or competition to request"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[13px] placeholder:text-secondary"
              />
              <button
                type="button"
                onClick={() => void requestLeague()}
                disabled={reqState === "busy"}
                className="h-10 shrink-0 rounded-lg border border-line px-3.5 text-[13px] font-semibold transition-colors hover:bg-raised disabled:opacity-60"
              >
                {reqState === "busy" ? "Sending…" : "Send request"}
              </button>
            </div>
          )}
          {reqError && <p className="text-xs text-red">{reqError}</p>}
        </div>
      )}

      <div>
        <label
          htmlFor="custom-start"
          className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Show start
        </label>
        <input
          id="custom-start"
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
          className="h-11 rounded-lg border border-line bg-inset px-3 text-sm tabular-nums"
        />
        <p className="mt-1 text-xs text-secondary">
          {start && new Date(start).getTime() > Date.now() + 10 * 60_000
            ? "This schedules the room. Open it from My rooms or the room page when you are ready."
            : "This opens your waiting room right now and takes you straight in."}
        </p>
      </div>

      <div>
        <label
          htmlFor="custom-blurb"
          className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Blurb <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id="custom-blurb"
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
    </form>
  );
}
