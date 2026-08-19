"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyFacts, groupFacts, type MatchFact, type MatchFactSet } from "@/lib/matchFacts";

/**
 * Match Facts tab (host only). Pre-written head-to-head, form, manager and
 * league-comparison lines from the Sportmonks add-on, for reading on air.
 *
 * Built for someone who is live: scannable, search filters as you type, and
 * tapping a fact copies it. It loads on first open rather than on mount, so a
 * host who never opens the tab never spends a metered call.
 */
export function MatchFactsPanel({
  fixtureId,
  active,
}: {
  /** our LOCAL fixtures PK; 0 or less means there is nothing to fetch */
  fixtureId: number;
  /**
   * The tab is showing. The panel stays MOUNTED when it is not, so this is what
   * defers the first fetch, and it is why switching tabs does not re-fetch.
   */
  active: boolean;
}) {
  const [data, setData] = useState<MatchFactSet | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return; // leaning on Refresh must not stack calls
    if (fixtureId <= 0) {
      setData(emptyFacts(fixtureId, "no_link"));
      return;
    }
    inFlight.current = true;
    setState("loading");
    try {
      const res = await fetch(`/api/match-facts/${fixtureId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as MatchFactSet);
      setState("idle");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [fixtureId]);

  // first open only: the panel is kept mounted across tab switches, so this
  // fires once and Refresh is how a host pulls a newer set
  useEffect(() => {
    if (active && data === null && state === "idle") void load();
  }, [active, data, state, load]);

  const groups = useMemo(() => {
    const facts = data?.facts ?? [];
    const q = query.trim().toLowerCase();
    return groupFacts(q ? facts.filter((f) => f.text.toLowerCase().includes(q)) : facts);
  }, [data, query]);

  async function copy(f: MatchFact) {
    try {
      await navigator.clipboard.writeText(f.text);
      setCopied(f.id);
      setCopyFailed(false);
      setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1200);
    } catch {
      // swallowing this leaves the host believing they copied something
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  }

  const total = data?.facts.length ?? 0;
  const shown = groups.reduce((n, g) => n + g.facts.length, 0);
  const loading = state === "loading";
  const unwritten = data ? Math.max(0, data.totalReturned - total) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the facts"
          aria-label="Search match facts"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-inset px-2.5 text-sm outline-none focus:border-red"
        />
        <span
          className="shrink-0 font-mono text-[11px] text-secondary tabular-nums"
          title={data ? `${total} readable of ${data.totalReturned} returned` : undefined}
        >
          {query ? `${shown}/${total}` : total}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-8 shrink-0 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-raised disabled:opacity-50"
        >
          {loading ? "Loading" : "Refresh"}
        </button>
      </div>

      {/* copy outcome is announced, not only shown */}
      <p aria-live="polite" className="sr-only">
        {copyFailed ? "Copy failed" : copied !== null ? "Fact copied" : ""}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && data === null && (
          <p className="text-sm text-secondary">Loading the facts…</p>
        )}

        {state === "error" && (
          <div className="rounded-lg border border-line bg-raised p-3">
            <p className="text-sm text-primary">Couldn&apos;t load the match facts.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 h-8 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface"
            >
              Try again
            </button>
          </div>
        )}

        {copyFailed && (
          <p className="mb-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-primary">
            Couldn&apos;t copy automatically. Select the text and copy it.
          </p>
        )}

        {data?.stale && (
          <p className="mb-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
            Showing the last set we loaded: the live fetch didn&apos;t come back.
          </p>
        )}

        {/* "not published yet" and "this fixture can never have facts" must not
            read the same. The first fixes itself as kickoff nears; the second
            needs someone to link the fixture, and telling that host to wait is
            the same silent lie the Betis stats trap told. */}
        {!loading && data !== null && total === 0 && state !== "error" && (
          <p className="text-sm text-secondary">
            {data.emptyReason === "no_link"
              ? "This room isn't linked to a fixture, so no match facts will ever load here. Link the fixture and they will appear."
              : data.emptyReason === "unknown_fixture"
                ? "This fixture isn't in our schedule, so there are no facts for it."
                : "No match facts for this fixture yet. They usually appear in the days before kickoff."}
          </p>
        )}

        {total > 0 && shown === 0 && (
          <p className="text-sm text-secondary">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {groups.map((g) => (
          <section key={g.category} className="mb-4">
            <h3 className="mb-1.5 font-mono text-[10px] font-bold tracking-[0.08em] text-secondary uppercase">
              {g.label} <span className="tabular-nums">({g.facts.length})</span>
            </h3>
            <ul className="space-y-1">
              {g.facts.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => void copy(f)}
                    title="Click to copy"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-[13px] leading-snug text-primary transition-colors hover:bg-raised"
                  >
                    {f.text}
                    {copied === f.id && (
                      <span
                        aria-hidden="true"
                        className="ml-1.5 font-mono text-[10px] font-bold text-green"
                      >
                        copied
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* the header count is what can be READ OUT, not what the add-on holds */}
        {total > 0 && unwritten > 0 && (
          <p className="mt-1 text-[11px] text-secondary">
            These are the {total} facts the add-on wrote as full sentences. It
            also returned {unwritten} raw data points with no wording, which we
            don&apos;t show.
          </p>
        )}
      </div>
    </div>
  );
}
