import { config } from "@/lib/config";

/**
 * Pre-game historical context from Sportmonks (Phase 11 Slice 5): each team's
 * league-table standing + last-5 form for the relevant season. Slow-changing,
 * so it sits behind a long-TTL cache (mirrors lib/stats.ts) separate from the
 * live fixture-stats proxy. Season resolution handles the pre-season window: the
 * upcoming season's table is all-zeros until kickoff, so we fall back to the
 * last finished season until the new one has played games.
 *
 * Confirmed available on the account's plan (probed 2026-06-24); head-to-head is
 * gated and deferred.
 */

export type TeamStanding = {
  teamId: number;
  name: string | null;
  position: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** last 5 results, most recent first */
  form: ("W" | "D" | "L")[];
};

export type MatchHistory = {
  seasonName: string | null;
  home: TeamStanding | null;
  away: TeamStanding | null;
  stale?: boolean;
};

export const emptyHistory: MatchHistory = {
  seasonName: null,
  home: null,
  away: null,
};

// ---- Sportmonks shapes (only the fields we read) ----
type SmDetail = { type?: { code?: string }; value?: number | string };
type SmFormEntry = { form?: string; sort_order?: number };
type SmStandingRow = {
  participant_id?: number;
  position?: number;
  points?: number;
  participant?: { name?: string };
  details?: SmDetail[];
  form?: SmFormEntry[];
};
type SmSeason = { id: number; name?: string; finished?: boolean; starting_at?: string };

function smBase() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error("SPORTMONKS_API_TOKEN not configured");
  const base = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  return { token, base };
}

async function smGet(path: string): Promise<unknown> {
  const { token, base } = smBase();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sportmonks responded ${res.status}`);
  return res.json();
}

/** Resolve which season's table to show: the current one once it has started,
 *  otherwise the most recent finished season (so pre-season isn't all zeros). */
async function resolveSeason(): Promise<{ id: number; name: string | null } | null> {
  const payload = (await smGet(
    `/leagues/${config.premierLeagueId}?include=currentSeason;seasons`,
  )) as {
    data?: {
      currentseason?: SmSeason;
      currentSeason?: SmSeason;
      seasons?: SmSeason[];
    };
  };
  const data = payload.data;
  if (!data) return null;
  const current = data.currentseason ?? data.currentSeason ?? null;
  const seasons = data.seasons ?? [];
  const finished = seasons.filter((s) => s.finished);
  const lastFinished =
    finished.length > 0
      ? finished.reduce((a, b) => (b.id > a.id ? b : a))
      : null;

  const currentStarted =
    current?.starting_at != null &&
    new Date(current.starting_at).getTime() <= Date.now();
  const chosen = currentStarted ? current : (lastFinished ?? current);
  return chosen ? { id: chosen.id, name: chosen.name ?? null } : null;
}

const DETAIL = {
  played: "overall-matches-played",
  won: "overall-won",
  drawn: "overall-draw",
  lost: "overall-lost",
  goalsFor: "overall-goals-for",
  goalsAgainst: "overall-goals-against",
  goalDiff: "goal-difference",
  points: "overall-points",
} as const;

function detailValue(details: SmDetail[] | undefined, code: string): number {
  const d = (details ?? []).find((x) => x.type?.code === code);
  return d ? Number(d.value ?? 0) : 0;
}

function rowToStanding(teamId: number, row: SmStandingRow): TeamStanding {
  const form = (row.form ?? [])
    .slice()
    .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0))
    .slice(0, 5)
    .map((f) => f.form)
    .filter((f): f is "W" | "D" | "L" => f === "W" || f === "D" || f === "L");
  return {
    teamId,
    name: row.participant?.name ?? null,
    position: row.position ?? null,
    played: detailValue(row.details, DETAIL.played),
    won: detailValue(row.details, DETAIL.won),
    drawn: detailValue(row.details, DETAIL.drawn),
    lost: detailValue(row.details, DETAIL.lost),
    goalsFor: detailValue(row.details, DETAIL.goalsFor),
    goalsAgainst: detailValue(row.details, DETAIL.goalsAgainst),
    goalDiff: detailValue(row.details, DETAIL.goalDiff),
    points: detailValue(row.details, DETAIL.points),
    form,
  };
}

async function fetchHistoryRaw(
  homeTeamId: number,
  awayTeamId: number,
): Promise<MatchHistory> {
  const season = await resolveSeason();
  if (!season) return emptyHistory;

  const payload = (await smGet(
    `/standings/seasons/${season.id}?include=participant;details.type;form`,
  )) as { data?: SmStandingRow[] };
  const rows = payload.data ?? [];
  const homeRow = rows.find((r) => r.participant_id === homeTeamId);
  const awayRow = rows.find((r) => r.participant_id === awayTeamId);
  return {
    seasonName: season.name,
    home: homeRow ? rowToStanding(homeTeamId, homeRow) : null,
    away: awayRow ? rowToStanding(awayTeamId, awayRow) : null,
  };
}

// ---- long-TTL cache + in-flight coalescing + last-good fallback ----
const TTL_MS = 5 * 60_000;
type CacheEntry = { at: number; data: MatchHistory };

function cacheStore(): Map<number, CacheEntry> {
  const g = globalThis as unknown as { __fcHistoryCache?: Map<number, CacheEntry> };
  if (!g.__fcHistoryCache) g.__fcHistoryCache = new Map();
  return g.__fcHistoryCache;
}
function inflightStore(): Map<number, Promise<MatchHistory>> {
  const g = globalThis as unknown as {
    __fcHistoryInflight?: Map<number, Promise<MatchHistory>>;
  };
  if (!g.__fcHistoryInflight) g.__fcHistoryInflight = new Map();
  return g.__fcHistoryInflight;
}

/** Cached pre-game history keyed by fixture id. Serves last-good (stale) on
 *  upstream error; returns the empty contract when team ids are missing. */
export async function getMatchHistory(
  fixtureId: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): Promise<MatchHistory> {
  if (fixtureId <= 0 || homeTeamId == null || awayTeamId == null) {
    return emptyHistory;
  }
  const cache = cacheStore();
  const hit = cache.get(fixtureId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const inflight = inflightStore();
  const existing = inflight.get(fixtureId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await fetchHistoryRaw(homeTeamId, awayTeamId);
      cache.set(fixtureId, { at: Date.now(), data });
      return data;
    } catch (err) {
      const last = cache.get(fixtureId);
      if (last) return { ...last.data, stale: true };
      throw err;
    } finally {
      inflight.delete(fixtureId);
    }
  })();
  inflight.set(fixtureId, p);
  return p;
}
