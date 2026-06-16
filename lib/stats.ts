import type { SmParticipant, SmScore } from "@/lib/fixtures";

/**
 * Phase 7 match-detail data layer. Server-side fetch of a Sportmonks fixture's
 * statistics / events / lineups / formations, normalized to one client-facing
 * shape (FixtureStats). The pure `normalize()` is exported for unit tests; the
 * token is read only here, never in client code. NOTE: status is a LABEL only
 * — never a clock (golden rule 6: the event-sourced header is the only clock).
 */

export type Side = "home" | "away";
export type StatUnit = "count" | "pct";
export type StatTab = "stats" | "events" | "lineups";

export type StatBar = {
  code: string;
  label: string;
  home: number;
  away: number;
  /** pct: bar width is the raw home value; count: width = home/(home+away) */
  unit: StatUnit;
};

export type EventKind =
  | "goal"
  | "owngoal"
  | "penalty"
  | "yellowcard"
  | "redcard"
  | "substitution"
  | "var";

export type TimelineEvent = {
  id: string;
  minute: number;
  extraMinute: number | null;
  side: Side;
  kind: EventKind;
  player: string;
  relatedPlayer: string | null; // substitution: player = on, relatedPlayer = off
  result: string | null; // goals: running score e.g. "2-1"
  info: string | null; // e.g. "Penalty", "Header"
  sortOrder: number;
};

export type LineupPlayer = {
  playerId: number;
  name: string;
  jersey: number | null;
  line: number | null; // pitch row from formation_field "line:position"
  positionId: number | null;
  starting: boolean;
};
export type SideLineup = {
  side: Side;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
};

export type FixtureStats = {
  fixtureId: number;
  fetchedAt: string; // ISO
  stale?: boolean; // last-good served after an upstream error
  status: { short: string; name: string }; // label only, NOT a clock
  home: { id: number | null; name: string };
  away: { id: number | null; name: string };
  score: { home: number; away: number };
  stats: StatBar[]; // [] before kickoff
  events: TimelineEvent[]; // ascending (minute, sortOrder); UI reverses
  lineups: { home: SideLineup | null; away: SideLineup | null };
};

// ---- raw Sportmonks shapes (probed live; parsed defensively) ----
type SmStat = {
  participant_id: number;
  location: Side | string;
  data?: { value?: number | null };
  type?: { id: number; code: string; name: string };
};
type SmEvent = {
  minute: number;
  extra_minute?: number | null;
  participant_id: number;
  player_id?: number | null;
  player_name?: string | null;
  related_player_name?: string | null;
  result?: string | null;
  info?: string | null;
  sort_order?: number;
  type_id: number;
  type?: { id: number; code: string; name: string };
};
type SmLineup = {
  team_id: number;
  player_id: number;
  position_id?: number | null;
  formation_field?: string | null;
  formation_position?: number | null;
  type_id: number;
  player_name?: string | null;
  jersey_number?: number | null;
  player?: { display_name?: string | null; position_id?: number | null };
  type?: { code?: string };
};
type SmFormation = { participant_id: number; formation?: string | null; location: Side | string };
export type SmFixtureDetail = {
  id: number;
  statistics?: SmStat[];
  events?: SmEvent[];
  lineups?: SmLineup[];
  formations?: SmFormation[];
  participants?: SmParticipant[];
  scores?: SmScore[];
  state?: { state?: string; short_name?: string | null; name?: string | null };
};

/** Curated, ordered stat bars. First five mirror the old placeholder so the
 *  live panel is a drop-in upgrade. A code absent from the payload is dropped. */
const STAT_ALLOW: { code: string; label: string; unit: StatUnit }[] = [
  { code: "ball-possession", label: "Possession", unit: "pct" },
  { code: "shots-total", label: "Shots", unit: "count" },
  { code: "shots-on-target", label: "On target", unit: "count" },
  { code: "corners", label: "Corners", unit: "count" },
  { code: "fouls", label: "Fouls", unit: "count" },
  { code: "yellowcards", label: "Yellow cards", unit: "count" },
  { code: "offsides", label: "Offsides", unit: "count" },
  { code: "saves", label: "Saves", unit: "count" },
  { code: "successful-passes-percentage", label: "Pass accuracy", unit: "pct" },
];

const EVENT_KIND: Record<string, EventKind> = {
  goal: "goal",
  owngoal: "owngoal",
  "own-goal": "owngoal",
  penalty: "penalty",
  "penalty-goal": "penalty",
  yellowcard: "yellowcard",
  redcard: "redcard",
  yellowredcard: "redcard",
  "yellow-red-card": "redcard",
  substitution: "substitution",
  var: "var",
  "var-card": "var",
};

/** Pure: map a raw Sportmonks fixture detail to FixtureStats. Tolerates any
 *  missing include (defaults to empty), skips unknown event kinds, and drops
 *  rows whose location/team can't be resolved. */
export function normalize(raw: SmFixtureDetail): FixtureStats {
  const parts = raw.participants ?? [];
  const homeP = parts.find((p) => p.meta?.location === "home");
  const awayP = parts.find((p) => p.meta?.location === "away");
  const home = { id: homeP?.id ?? null, name: homeP?.name ?? "Home" };
  const away = { id: awayP?.id ?? null, name: awayP?.name ?? "Away" };

  const current = (raw.scores ?? []).filter((s) => s.description === "CURRENT");
  const goalsFor = (loc: Side) =>
    current.find((s) => s.score?.participant === loc)?.score?.goals ?? 0;
  const score = { home: goalsFor("home"), away: goalsFor("away") };

  const status = {
    short: raw.state?.short_name ?? raw.state?.state ?? "NS",
    name: raw.state?.name ?? "Not started",
  };

  const allStats = raw.statistics ?? [];
  const stats: StatBar[] = [];
  for (const def of STAT_ALLOW) {
    const rows = allStats.filter((s) => s.type?.code === def.code);
    if (rows.length === 0) continue;
    const val = (loc: Side) =>
      Number(rows.find((r) => r.location === loc)?.data?.value ?? 0) || 0;
    stats.push({ code: def.code, label: def.label, home: val("home"), away: val("away"), unit: def.unit });
  }

  const events: TimelineEvent[] = [];
  for (const e of raw.events ?? []) {
    const kind = e.type?.code ? EVENT_KIND[e.type.code] : undefined;
    if (!kind) continue;
    const side: Side =
      e.participant_id === home.id ? "home" : e.participant_id === away.id ? "away" : "home";
    events.push({
      id: `${e.type_id}-${e.minute}-${e.extra_minute ?? 0}-${e.player_id ?? 0}-${e.sort_order ?? 0}`,
      minute: e.minute,
      extraMinute: e.extra_minute ?? null,
      side,
      kind,
      player: e.player_name ?? "",
      relatedPlayer: e.related_player_name ?? null,
      result: e.result ?? null,
      info: e.info ?? null,
      sortOrder: e.sort_order ?? 0,
    });
  }
  events.sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.extraMinute ?? 0) - (b.extraMinute ?? 0) ||
      a.sortOrder - b.sortOrder,
  );

  const buildSide = (side: Side, team: { id: number | null; name: string }): SideLineup | null => {
    if (team.id == null) return null;
    const rows = (raw.lineups ?? []).filter((l) => l.team_id === team.id);
    if (rows.length === 0) return null;
    const toPlayer = (l: SmLineup, starting: boolean): LineupPlayer => ({
      playerId: l.player_id,
      name: l.player?.display_name ?? l.player_name ?? "—",
      jersey: l.jersey_number ?? null,
      line: l.formation_field ? Number(l.formation_field.split(":")[0]) || null : null,
      positionId: l.position_id ?? null,
      starting,
    });
    const isStarter = (l: SmLineup) =>
      l.type?.code ? l.type.code === "lineup" : l.type_id === 11;
    const starters = rows
      .filter(isStarter)
      .map((l) => toPlayer(l, true))
      .sort((a, b) => (a.line ?? 99) - (b.line ?? 99) || (a.jersey ?? 99) - (b.jersey ?? 99));
    const bench = rows
      .filter((l) => !isStarter(l))
      .map((l) => toPlayer(l, false))
      .sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
    const formation =
      (raw.formations ?? []).find((f) => f.location === side || f.participant_id === team.id)
        ?.formation ?? null;
    return { side, teamName: team.name, formation, starters, bench };
  };

  return {
    fixtureId: raw.id,
    fetchedAt: new Date().toISOString(),
    status,
    home,
    away,
    score,
    stats,
    events,
    lineups: { home: buildSide("home", home), away: buildSide("away", away) },
  };
}

/** Pre-match / unknown / seed-fixture (id <= 0) zeros — no upstream call. */
export function emptyStats(id: number): FixtureStats {
  return {
    fixtureId: id,
    fetchedAt: new Date().toISOString(),
    status: { short: "NS", name: "Not started" },
    home: { id: null, name: "Home" },
    away: { id: null, name: "Away" },
    score: { home: 0, away: 0 },
    stats: [],
    events: [],
    lineups: { home: null, away: null },
  };
}

// ---- server fetch + short TTL cache (protects Sportmonks rate limits) ----
const TTL_MS = 10_000;
type CacheEntry = { at: number; data: FixtureStats };

function cacheStore(): Map<number, CacheEntry> {
  const g = globalThis as unknown as { __fcStatsCache?: Map<number, CacheEntry> };
  if (!g.__fcStatsCache) g.__fcStatsCache = new Map();
  return g.__fcStatsCache;
}
function inflightStore(): Map<number, Promise<FixtureStats>> {
  const g = globalThis as unknown as { __fcStatsInflight?: Map<number, Promise<FixtureStats>> };
  if (!g.__fcStatsInflight) g.__fcStatsInflight = new Map();
  return g.__fcStatsInflight;
}

async function fetchFixtureRaw(id: number): Promise<SmFixtureDetail> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error("SPORTMONKS_API_TOKEN not configured");
  const base = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  // include set is HARDCODED — never accept an include/URL from the client
  const include = "statistics.type;events.type;lineups.player;lineups.type;formations;participants;scores;state";
  const res = await fetch(`${base}/fixtures/${id}?include=${include}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sportmonks responded ${res.status}`);
  const payload = (await res.json()) as { data?: SmFixtureDetail };
  if (!payload.data) throw new Error("Sportmonks returned no fixture");
  return payload.data;
}

/** Cached, coalesced fixture stats. Many listeners polling at 15s collapse to
 *  ~1 upstream call per TTL window. Serves last-good (stale) on upstream error. */
export async function getFixtureStats(id: number): Promise<FixtureStats> {
  const cache = cacheStore();
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const inflight = inflightStore();
  const existing = inflight.get(id);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = normalize(await fetchFixtureRaw(id));
      cache.set(id, { at: Date.now(), data });
      return data;
    } catch (err) {
      const last = cache.get(id);
      if (last) return { ...last.data, stale: true };
      throw err;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}
