/**
 * Sportmonks "Match Facts" add-on (enabled on the account 2026-08-19).
 *
 * Pre-match talking points: head-to-head records, form streaks, coach records,
 * league-average comparisons and player leaders. Each row carries a
 * `natural_language` sentence already written for broadcast, which is the only
 * part we surface: the rows without it are raw `data` blobs whose meaning lives
 * in a `type_id` lexicon we do not have, so rendering them would mean inventing
 * labels.
 *
 * Verified against the live account 2026-08-19: Arsenal v Coventry (21 Aug)
 * carried 353 facts, 89 of them with prose, across statistics / streaks /
 * coaches / statistic_comparisons / players / referees.
 *
 * TIMING, load-bearing for the UI: facts are generated CLOSE TO KICKOFF. The
 * same probe found 0 facts for Arsenal fixtures on 31 Aug, 6 Sep and 12 Sep.
 * "No facts yet" is the normal state for anything more than a few days out and
 * must never read as an error.
 */

export type MatchFactCategory =
  | "statistics"
  | "streaks"
  | "coaches"
  | "statistic_comparisons"
  | "players"
  | "referees"
  | string;

export type MatchFact = {
  id: number;
  category: MatchFactCategory;
  /** "h2h" (this pairing), "team" (season form), "overall" */
  basis: string;
  /** "home" | "away" | "both" */
  participant: string;
  /** the ready-to-read sentence */
  text: string;
};

/**
 * Why a set is empty. These are NOT interchangeable: 'none_yet' resolves itself
 * as kickoff approaches, 'no_link' never will without someone linking the
 * fixture, and showing the reassuring message for the second case is how the
 * Betis stats trap went unnoticed for a whole match.
 */
export type EmptyReason = 'none_yet' | 'no_link' | 'unknown_fixture';

export type MatchFactSet = {
  /** the id this set was REQUESTED for; see sportmonksFixtureId for the upstream one */
  fixtureId: number;
  /** the Sportmonks id actually queried, null when nothing was queried */
  sportmonksFixtureId: number | null;
  fetchedAt: string;
  /** every fact the add-on returned, INCLUDING the ~75% with no prose we cannot show */
  totalReturned: number;
  /** the ones we can actually display */
  facts: MatchFact[];
  /** set when facts is empty; absent when there are facts */
  emptyReason?: EmptyReason;
  /** true when the upstream call failed and this is last-good */
  stale?: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  statistics: "Head to head",
  streaks: "Form and streaks",
  coaches: "Managers",
  statistic_comparisons: "Versus the league",
  players: "Players to watch",
  referees: "Referee",
};

/** Display name for a category, falling back to a tidied raw value. */
export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

/** Stable ordering: the categories a commentator reaches for first. */
const CATEGORY_ORDER = [
  "streaks",
  "statistics",
  "statistic_comparisons",
  "players",
  "coaches",
  "referees",
];

export function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}

/** Group a flat fact list into display order. */
export function groupFacts(facts: MatchFact[]): { category: string; label: string; facts: MatchFact[] }[] {
  const by = new Map<string, MatchFact[]>();
  for (const f of facts) by.set(f.category, [...(by.get(f.category) ?? []), f]);
  return sortCategories([...by.keys()]).map((c) => ({
    category: c,
    label: categoryLabel(c),
    facts: by.get(c)!,
  }));
}

// ---- fetch + cache (same shape as lib/stats.ts, protects the metered plan) ----

type SmFact = {
  id: number;
  fixture_id: number;
  category?: string | null;
  basis?: string | null;
  participant?: string | null;
  natural_language?: string | null;
};

// Facts are pre-match and barely change, so this is far longer than the 10s
// stats TTL. One host with the tab open must not re-hit a metered add-on.
const TTL_MS = 10 * 60_000;
// An EMPTY answer is cached far more briefly. Facts appear in the days before
// kickoff, so a host who refreshes at 19:00 must not be served a 10-minute-old
// "nothing yet" that predates them being published.
const EMPTY_TTL_MS = 60_000;
type Entry = { at: number; data: MatchFactSet };

function cacheStore(): Map<number, Entry> {
  const g = globalThis as unknown as { __arMatchFacts?: Map<number, Entry> };
  if (!g.__arMatchFacts) g.__arMatchFacts = new Map();
  return g.__arMatchFacts;
}
function inflightStore(): Map<number, Promise<MatchFactSet>> {
  const g = globalThis as unknown as { __arMatchFactsInflight?: Map<number, Promise<MatchFactSet>> };
  if (!g.__arMatchFactsInflight) g.__arMatchFactsInflight = new Map();
  return g.__arMatchFactsInflight;
}

export function emptyFacts(fixtureId: number, emptyReason: EmptyReason = 'none_yet'): MatchFactSet {
  return {
    fixtureId,
    sportmonksFixtureId: null,
    fetchedAt: new Date().toISOString(),
    totalReturned: 0,
    facts: [],
    emptyReason,
  };
}

async function fetchRaw(sportmonksFixtureId: number): Promise<SmFact[]> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error("SPORTMONKS_API_TOKEN not configured");
  const base = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  // The include on the fixture returns the WHOLE set in one call (353 for a
  // real fixture), unlike /match-facts which pages at 25. Include set is
  // hardcoded server-side: never take one from a client (SSRF guard, same rule
  // as lib/stats.ts).
  const res = await fetch(`${base}/fixtures/${sportmonksFixtureId}?include=matchFacts`, {
    headers: { Authorization: token }, // raw token, no "Bearer "
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sportmonks responded ${res.status}`);
  const payload = (await res.json()) as { data?: { matchfacts?: SmFact[]; matchFacts?: SmFact[] } };
  const d = payload.data;
  if (!d) throw new Error("Sportmonks returned no fixture");
  return d.matchfacts ?? d.matchFacts ?? [];
}

function normalize(fixtureId: number, raw: SmFact[]): MatchFactSet {
  const facts: MatchFact[] = [];
  for (const r of raw) {
    const text = (r.natural_language ?? "").trim();
    if (!text) continue;
    facts.push({
      id: r.id,
      category: r.category ?? "other",
      basis: r.basis ?? "",
      participant: r.participant ?? "",
      text,
    });
  }
  // de-dupe identical sentences (h2h and overall can restate the same thing)
  const seen = new Set<string>();
  const unique = facts.filter((f) => (seen.has(f.text) ? false : (seen.add(f.text), true)));
  return {
    fixtureId,
    sportmonksFixtureId: fixtureId,
    fetchedAt: new Date().toISOString(),
    totalReturned: raw.length,
    facts: unique,
    ...(unique.length === 0 ? { emptyReason: 'none_yet' as const } : {}),
  };
}

/**
 * Cached, coalesced match facts for a SPORTMONKS fixture id. Serves last-good
 * on upstream failure, flagged `stale`. An id of 0 or less short-circuits to
 * the empty set with NO upstream call (dev/seed fixtures, and discussion rooms
 * with no linked fixture).
 */
export async function getMatchFacts(sportmonksFixtureId: number): Promise<MatchFactSet> {
  if (!Number.isInteger(sportmonksFixtureId) || sportmonksFixtureId <= 0) {
    return emptyFacts(sportmonksFixtureId);
  }
  const cache = cacheStore();
  const hit = cache.get(sportmonksFixtureId);
  const ttl = hit && hit.data.facts.length === 0 ? EMPTY_TTL_MS : TTL_MS;
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  const inflight = inflightStore();
  const existing = inflight.get(sportmonksFixtureId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = normalize(sportmonksFixtureId, await fetchRaw(sportmonksFixtureId));
      cache.set(sportmonksFixtureId, { at: Date.now(), data });
      return data;
    } catch (err) {
      const last = cache.get(sportmonksFixtureId);
      if (last) return { ...last.data, stale: true };
      throw err;
    } finally {
      inflight.delete(sportmonksFixtureId);
    }
  })();
  inflight.set(sportmonksFixtureId, p);
  return p;
}
