import { config } from "@/lib/config";

/**
 * Pre-game historical context from Sportmonks (Phase 11 Slice 5): each team's
 * league-table standing + last-5 form for the relevant season. Slow-changing,
 * so it sits behind a long-TTL cache (mirrors lib/stats.ts) separate from the
 * live fixture-stats proxy. Season resolution handles the pre-season window: the
 * upcoming season's table is all-zeros until kickoff, so we fall back to the
 * last finished season until the new one has played games.
 *
 * Programme room rebuild (founder 2026-09-22): the SAME standings call now also
 * yields a mini-table slice (top 4 + both teams) for the stats rail, and the
 * payload gains head-to-head - re-probed 2026-09-22 and NO LONGER GATED on the
 * plan (it was when first probed 2026-06-24). H2H failures degrade to null so
 * the table/form half never dies with them.
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

/** One mini-table row (stats rail): top 4 + both teams, position order. */
export type TableRow = {
  teamId: number;
  name: string;
  position: number;
  played: number;
  goalDiff: number;
  points: number;
};

/** Head-to-head between the two sides, finished meetings only. */
export type HeadToHeadSummary = {
  /** wins for the fixture's HOME side across the returned meetings */
  homeWins: number;
  draws: number;
  awayWins: number;
  total: number;
  /** newest first, capped for display */
  meetings: { whenLabel: string; result: string }[];
};

export type MatchHistory = {
  seasonName: string | null;
  home: TeamStanding | null;
  away: TeamStanding | null;
  /** mini-table slice: top 4 + both teams (position order, gaps implied) */
  table: TableRow[];
  h2h: HeadToHeadSummary | null;
  stale?: boolean;
};

export const emptyHistory: MatchHistory = {
  seasonName: null,
  home: null,
  away: null,
  table: [],
  h2h: null,
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

/** Mini-table slice from the full standings: top 4 plus both sides, position
 *  order. The UI draws a "···" gap wherever positions jump. */
function tableSlice(
  rows: SmStandingRow[],
  homeTeamId: number,
  awayTeamId: number,
): TableRow[] {
  const toRow = (r: SmStandingRow): TableRow | null => {
    if (r.participant_id == null || r.position == null) return null;
    return {
      teamId: r.participant_id,
      name: r.participant?.name ?? "",
      position: r.position,
      played: detailValue(r.details, DETAIL.played),
      goalDiff: detailValue(r.details, DETAIL.goalDiff),
      points: detailValue(r.details, DETAIL.points),
    };
  };
  const all = rows
    .map(toRow)
    .filter((r): r is TableRow => r !== null && r.name !== "")
    .sort((a, b) => a.position - b.position);
  const keep = new Set<number>();
  for (const r of all) {
    if (r.position <= 4 || r.teamId === homeTeamId || r.teamId === awayTeamId)
      keep.add(r.teamId);
  }
  return all.filter((r) => keep.has(r.teamId));
}

// ---- head-to-head (re-probed available 2026-09-22) ----
type SmH2hFixture = {
  id: number;
  starting_at?: string | null;
  state?: { short_name?: string | null; state?: string | null };
  participants?: { id: number; name?: string; meta?: { location?: string } }[];
  scores?: {
    description?: string;
    score?: { participant?: string; goals?: number };
  }[];
};

/** Finished-match state codes (Sportmonks short names vary; match the known
 *  full-time family). Tonight's IN-PLAY meeting must never count as a result
 *  - it would list the half-played game as history and flip mid-show. */
const FINISHED_STATES = new Set(["FT", "AET", "FT_PEN", "PEN", "AFTER_PENALTIES"]);

/** Finished meetings between the two sides, tallied for the fixture's home
 *  team. A fetch/parse failure returns null - the caller degrades gracefully. */
async function fetchHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
): Promise<HeadToHeadSummary | null> {
  try {
    // per_page raised so enough FINISHED meetings survive the filters to fill
    // five display rows (founder 2026-09-23); the plan's history depth is the
    // hard ceiling on how far back this can reach
    const payload = (await smGet(
      `/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?include=participants;scores;state&per_page=50`,
    )) as { data?: SmH2hFixture[] };
    const now = Date.now();
    const meetings: {
      at: number;
      whenLabel: string;
      result: string;
      winner: number | null; // team id, null = draw
    }[] = [];
    for (const f of payload.data ?? []) {
      const at = f.starting_at ? new Date(`${f.starting_at.replace(" ", "T")}Z`).getTime() : NaN;
      if (Number.isNaN(at) || at > now) continue; // future or undated
      // only FINISHED meetings count; when the state include is missing,
      // require the kickoff to be safely in the past (a live game is not)
      const short = f.state?.short_name ?? f.state?.state ?? null;
      const finished = short
        ? FINISHED_STATES.has(short.toUpperCase())
        : at < now - 6 * 3600_000;
      if (!finished) continue;
      const home = f.participants?.find((p) => p.meta?.location === "home");
      const away = f.participants?.find((p) => p.meta?.location === "away");
      if (!home || !away) continue;
      const current = (f.scores ?? []).filter((s) => s.description === "CURRENT");
      const goals = (loc: "home" | "away") =>
        current.find((s) => s.score?.participant === loc)?.score?.goals;
      const hg = goals("home");
      const ag = goals("away");
      if (hg == null || ag == null) continue; // never finished / no score
      meetings.push({
        at,
        whenLabel: new Date(at).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
          timeZone: "Europe/London",
        }),
        result: `${home.name ?? "Home"} ${hg}-${ag} ${away.name ?? "Away"}`,
        winner: hg === ag ? null : hg > ag ? home.id : away.id,
      });
    }
    if (meetings.length === 0) return null;
    meetings.sort((a, b) => b.at - a.at);
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    for (const m of meetings) {
      if (m.winner === homeTeamId) homeWins += 1;
      else if (m.winner === awayTeamId) awayWins += 1;
      else draws += 1;
    }
    return {
      homeWins,
      draws,
      awayWins,
      total: meetings.length,
      // last 5 for the rail (founder 2026-09-22)
      meetings: meetings
        .slice(0, 5)
        .map(({ whenLabel, result }) => ({ whenLabel, result })),
    };
  } catch {
    return null;
  }
}

async function fetchHistoryRaw(
  homeTeamId: number,
  awayTeamId: number,
): Promise<MatchHistory> {
  const season = await resolveSeason();
  if (!season) return emptyHistory;

  const [payload, h2h] = await Promise.all([
    smGet(
      `/standings/seasons/${season.id}?include=participant;details.type;form`,
    ) as Promise<{ data?: SmStandingRow[] }>,
    fetchHeadToHead(homeTeamId, awayTeamId),
  ]);
  const rows = payload.data ?? [];
  const homeRow = rows.find((r) => r.participant_id === homeTeamId);
  const awayRow = rows.find((r) => r.participant_id === awayTeamId);
  return {
    seasonName: season.name,
    home: homeRow ? rowToStanding(homeTeamId, homeRow) : null,
    away: awayRow ? rowToStanding(awayTeamId, awayRow) : null,
    table: tableSlice(rows, homeTeamId, awayTeamId),
    h2h,
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
