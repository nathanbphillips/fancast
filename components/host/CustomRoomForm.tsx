"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KickoffTime } from "@/components/KickoffTime";

/**
 * Create a room that isn't in the listed fixtures. Two modes:
 *  - Match room (founder 2026-07-06): title is "Home vs Away"; typing searches
 *    our covered competitions and picking a suggestion links the real fixture
 *    so live stats flow. Unlinked rooms get the early-access note + league box.
 *  - Discussion room (founder 2026-07-14): a free-topic room. Free-text title;
 *    an OPTIONAL "link a game for stats" search that does NOT overwrite the
 *    title (the linked game drives stats only, not the room's identity).
 */

type Suggestion = {
  sportmonksFixtureId: number;
  home: string;
  away: string;
  kickoffUtc: string;
  competition: string;
};

type Mode = "match" | "discussion";

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
  const [mode, setMode] = useState<Mode>("match");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [blurb, setBlurb] = useState("");
  const [linked, setLinked] = useState<Suggestion | null>(null);
  /** discussion-mode "link a game" search box (match mode searches the title) */
  const [linkQuery, setLinkQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reqLeague, setReqLeague] = useState("");
  const [reqState, setReqState] = useState<"idle" | "busy" | "done">("idle");
  const [reqError, setReqError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // the query that drives the fixture suggest: the title (match) or the
  // separate "link a game" box (discussion)
  const searchQuery = mode === "match" ? title : linkQuery;

  useEffect(() => {
    if (linked || searchQuery.trim().length < 3) {
      abortRef.current?.abort();
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/fixtures/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { signal: ctrl.signal },
        );
        const body = await res.json().catch(() => ({ results: [] }));
        if (abortRef.current === ctrl) {
          setSuggestions(Array.isArray(body.results) ? body.results : []);
        }
      } catch {
        /* aborted or offline: no suggestions is fine */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchQuery, linked]);

  function openForm() {
    setOpen(true);
    if (!start) setStart(nowLocalInput());
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setLinked(null);
    setLinkQuery("");
    setSuggestions([]);
    setError(null);
  }

  function pick(s: Suggestion) {
    setLinked(s);
    setSuggestions([]);
    // match mode: the linked game IS the room, so its name becomes the title.
    // discussion mode: keep the host's title; the game is just for stats.
    if (mode === "match") setTitle(`${s.home} vs ${s.away}`);
    else setLinkQuery("");
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
    setLinkQuery("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // clamp a stale "now" default up to the near future (server rejects a start
    // older than a minute)
    const startMs = Math.max(new Date(start).getTime(), Date.now() + 30_000);
    const startIso = new Date(startMs).toISOString();
    const common = {
      title: title.trim(),
      startIso,
      blurb: blurb.trim() || undefined,
    };
    const payload =
      mode === "match"
        ? {
            action: "create_custom",
            ...common,
            sportmonksFixtureId: linked?.sportmonksFixtureId,
          }
        : {
            action: "create_discussion",
            ...common,
            linkedSportmonksFixtureId: linked?.sportmonksFixtureId,
          };
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error ?? "Couldn't create the room.");
      return;
    }
    const room = body?.room as { slug?: string; state?: string } | undefined;
    if (room?.state === "waiting" && room.slug) {
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
            Want your own room?
          </p>
          <p className="mt-0.5 text-[12.5px] text-secondary">
            Host a match we don&apos;t list, or open a discussion on anything,
            any time.
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

  const suggestList = !linked && suggestions.length > 0 && (
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
  );

  const linkedChip = linked && (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-green/40 bg-inset px-3 py-2">
      <p className="text-[12.5px] text-secondary">
        <span className="font-semibold text-green">
          {mode === "match" ? "Linked:" : "Stats for:"}
        </span>{" "}
        {linked.home} vs {linked.away} ({linked.competition}). Live stats will
        show in the room.
      </p>
      <button
        type="button"
        onClick={unlink}
        className="shrink-0 text-xs font-semibold text-secondary underline underline-offset-2 hover:text-primary"
      >
        {mode === "match" ? "Unlink" : "Remove"}
      </button>
    </div>
  );

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

      {/* mode toggle */}
      <div
        role="tablist"
        aria-label="Room type"
        className="grid grid-cols-2 gap-1 rounded-lg bg-inset p-1"
      >
        {(["match", "discussion"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={
              mode === m
                ? "rounded-md bg-surface px-3 py-2 text-[13px] font-bold text-primary shadow-card"
                : "rounded-md px-3 py-2 text-[13px] font-semibold text-secondary transition-colors hover:text-primary"
            }
          >
            {m === "match" ? "Match room" : "Discussion room"}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-inset px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      {/* title */}
      <div className="relative">
        <label
          htmlFor="custom-title"
          className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          {mode === "match" ? "Room title" : "What's the room about?"}
        </label>
        <input
          id="custom-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            // in match mode the title IS the search; changing it drops the link
            if (mode === "match" && linked) setLinked(null);
          }}
          required
          maxLength={90}
          placeholder={
            mode === "match" ? "Arsenal vs Chelsea" : "Transfer deadline phone-in"
          }
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary"
        />
        <p className="mt-1 text-xs text-secondary">
          {mode === "match"
            ? 'Use "Home vs Away". Start typing to search matches we cover and link live stats automatically.'
            : "Give your room a name — anything goes."}
        </p>
        {mode === "match" && suggestList}
      </div>

      {/* match mode: link status / early-access note + league request */}
      {mode === "match" &&
        (linked ? (
          linkedChip
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
        ))}

      {/* discussion mode: optional "link a game for stats" */}
      {mode === "discussion" &&
        (linked ? (
          linkedChip
        ) : (
          <div className="relative">
            <label
              htmlFor="custom-link"
              className="mb-1.5 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
            >
              Talking about a game?{" "}
              <span className="font-normal normal-case">
                (optional — pulls in live stats)
              </span>
            </label>
            <input
              id="custom-link"
              type="text"
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              maxLength={90}
              placeholder="Search a match, e.g. Man Utd vs Liverpool"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary"
            />
            <p className="mt-1 text-xs text-secondary">
              Link the match you&apos;re watching and its stats show on the side.
              Leave it blank for a chat-only room.
            </p>
            {suggestList}
          </div>
        ))}

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
          placeholder="A line on what to expect"
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
