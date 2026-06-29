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
export type StatTab = "info" | "stats" | "events" | "lineups";
/** default = always-visible grouped bars; more = behind the "More stats" toggle */
export type StatTier = "default" | "more";

export type StatBar = {
  code: string;
  label: string;
  home: number;
  away: number;
  /** pct: bar width is the raw home value; count: width = home/(home+away) */
  unit: StatUnit;
  group: string;
  tier: StatTier;
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
  line: number | null; // pitch row from formation_field "line:position" (1 = keeper)
  slot: number | null; // left→right slot within the line (the ":position" half)
  positionId: number | null;
  starting: boolean;
  // live substitution annotations (set as `substitution` events arrive):
  cameOnFor?: { number: number | null; minute: string } | null; // on-pitch sub: who they replaced
  subbedOffAt?: string | null; // subs-list player who left the pitch (minute label, e.g. "70'")
};
export type SideLineup = {
  side: Side;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
};

/** Deeper stats shown in the desktop expanded panel / mobile "Advanced" box.
 *  Distilled SERVER-SIDE from heavy includes (player details, trends, periods)
 *  so the client payload stays small. */
export type NamedValue = { name: string; value: number };
export type XgPlayer = { side: Side; name: string; xg: number };
export type Goalkeeper = {
  name: string;
  saves: number | null;
  conceded: number | null;
  insideBoxSaves: number | null;
};
export type MomentumBucket = { minute: number; home: number; away: number };
export type HalfStat = {
  code: string;
  label: string;
  first: { home: number; away: number };
  second: { home: number; away: number };
};
export type GameState = { homeLed: number; level: number; awayLed: number };

/** Pre-game context for the Info tab (FR-12-adjacent): venue, referee, weather,
 *  and team news (sidelined players). Distilled server-side. */
export type MatchInfo = {
  venue: { name: string; city: string | null; capacity: number | null } | null;
  // full match-official team, ordered head referee → assistants → 4th → VAR
  referees: { role: string; name: string }[];
  weather: {
    description: string; // forecast-at-kickoff, or live once the match starts
    temp: number | null; // °C
    windMph: number | null; // converted from Sportmonks' m/s
    humidity: string | null;
    note: string | null; // in-match change hint, e.g. "Rain since kickoff"
  } | null;
  teamNews: {
    home: { name: string; reason: string }[];
    away: { name: string; reason: string }[];
  };
};

export type DeepStats = {
  xg: { home: number; away: number; top: XgPlayer[] };
  ratings: { home: NamedValue[]; away: NamedValue[] };
  goalkeepers: { home: Goalkeeper | null; away: Goalkeeper | null };
  momentum: MomentumBucket[];
  perHalf: HalfStat[];
  gameState: GameState | null;
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
  deep: DeepStats | null; // null pre-match / when detail unavailable
  info: MatchInfo | null; // venue/referee/weather/team-news (Info tab)
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
  related_player_id?: number | null;
  related_player_name?: string | null;
  result?: string | null;
  info?: string | null;
  sort_order?: number;
  type_id: number;
  type?: { id: number; code: string; name: string };
};
type SmDetail = { type?: { code?: string }; data?: { value?: number | string | null } };
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
  details?: SmDetail[];
};
type SmFormation = { participant_id: number; formation?: string | null; location: Side | string };
type SmTrend = { participant_id: number; minute: number; value?: number | null; type?: { code?: string } };
type SmPeriod = { statistics?: SmStat[] };
export type SmFixtureDetail = {
  id: number;
  statistics?: SmStat[];
  events?: SmEvent[];
  lineups?: SmLineup[];
  formations?: SmFormation[];
  participants?: SmParticipant[];
  scores?: SmScore[];
  state?: { state?: string; short_name?: string | null; name?: string | null };
  trends?: SmTrend[];
  periods?: SmPeriod[];
  venue?: { name?: string | null; city_name?: string | null; capacity?: number | null };
  referees?: {
    type_id?: number;
    referee?: { name?: string | null; display_name?: string | null };
    type?: { id?: number; name?: string | null; code?: string | null };
  }[];
  sidelined?: {
    participant_id?: number;
    player?: { display_name?: string | null; name?: string | null };
    type?: { name?: string | null };
  }[];
  // Sportmonks returns the weatherReport include under the lowercase key
  weatherreport?: {
    description?: string | null;
    temperature?: { day?: number | null };
    humidity?: string | null;
    wind?: { speed?: number | null };
    current?: {
      temp?: number | null;
      description?: string | null;
      humidity?: string | null;
      wind?: number | null;
    };
  };
};

/** Full stat catalogue (Phase 7). tier "default" = the 13 always-visible
 *  grouped bars; tier "more" = behind the "More stats" expander. Array order
 *  is render order; a code absent from the payload is dropped. Exported for
 *  the placeholder + unit tests. */
export const STAT_DEFS: {
  code: string;
  label: string;
  unit: StatUnit;
  group: string;
  tier: StatTier;
}[] = [
  // --- default (always visible), 13 ---
  { code: "shots-total", label: "Shots", unit: "count", group: "Attacking", tier: "default" },
  { code: "shots-on-target", label: "On target", unit: "count", group: "Attacking", tier: "default" },
  { code: "big-chances-created", label: "Big chances", unit: "count", group: "Attacking", tier: "default" },
  { code: "corners", label: "Corners", unit: "count", group: "Attacking", tier: "default" },
  { code: "offsides", label: "Offsides", unit: "count", group: "Attacking", tier: "default" },
  { code: "ball-possession", label: "Possession", unit: "pct", group: "Possession & passing", tier: "default" },
  { code: "passes", label: "Total passes", unit: "count", group: "Possession & passing", tier: "default" },
  { code: "successful-passes", label: "Passes completed", unit: "count", group: "Possession & passing", tier: "default" },
  { code: "successful-passes-percentage", label: "Pass completion %", unit: "pct", group: "Possession & passing", tier: "default" },
  { code: "tackles", label: "Tackles", unit: "count", group: "Defending & discipline", tier: "default" },
  { code: "fouls", label: "Fouls", unit: "count", group: "Defending & discipline", tier: "default" },
  { code: "yellowcards", label: "Yellow cards", unit: "count", group: "Defending & discipline", tier: "default" },
  { code: "saves", label: "Saves", unit: "count", group: "Defending & discipline", tier: "default" },
  // --- more (behind the expander), 24 ---
  { code: "shots-insidebox", label: "Shots in box", unit: "count", group: "Shooting", tier: "more" },
  { code: "shots-outsidebox", label: "Shots outside box", unit: "count", group: "Shooting", tier: "more" },
  { code: "shots-off-target", label: "Off target", unit: "count", group: "Shooting", tier: "more" },
  { code: "shots-blocked", label: "Blocked shots", unit: "count", group: "Shooting", tier: "more" },
  { code: "goal-attempts", label: "Goal attempts", unit: "count", group: "Shooting", tier: "more" },
  { code: "hit-woodwork", label: "Woodwork", unit: "count", group: "Shooting", tier: "more" },
  { code: "key-passes", label: "Key passes", unit: "count", group: "Passing & crossing", tier: "more" },
  { code: "total-crosses", label: "Crosses", unit: "count", group: "Passing & crossing", tier: "more" },
  { code: "accurate-crosses", label: "Accurate crosses", unit: "count", group: "Passing & crossing", tier: "more" },
  { code: "long-passes", label: "Long passes", unit: "count", group: "Passing & crossing", tier: "more" },
  { code: "successful-long-passes", label: "Long passes completed", unit: "count", group: "Passing & crossing", tier: "more" },
  { code: "successful-long-passes-percentage", label: "Long pass %", unit: "pct", group: "Passing & crossing", tier: "more" },
  { code: "dribble-attempts", label: "Dribbles attempted", unit: "count", group: "Dribbles & duels", tier: "more" },
  { code: "successful-dribbles", label: "Dribbles completed", unit: "count", group: "Dribbles & duels", tier: "more" },
  { code: "successful-dribbles-percentage", label: "Dribble success %", unit: "pct", group: "Dribbles & duels", tier: "more" },
  { code: "duels-won", label: "Duels won", unit: "count", group: "Dribbles & duels", tier: "more" },
  { code: "successful-headers", label: "Headers won", unit: "count", group: "Dribbles & duels", tier: "more" },
  { code: "interceptions", label: "Interceptions", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "free-kicks", label: "Free kicks", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "attacks", label: "Attacks", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "dangerous-attacks", label: "Dangerous attacks", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "ball-safe", label: "Ball safe", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "throwins", label: "Throw-ins", unit: "count", group: "Defending & tempo", tier: "more" },
  { code: "goals-kicks", label: "Goal kicks", unit: "count", group: "Defending & tempo", tier: "more" },
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

const GK_POSITION_ID = 24; // Sportmonks goalkeeper position
const PERHALF_CODES: { code: string; label: string }[] = [
  { code: "ball-possession", label: "Possession" },
  { code: "shots-total", label: "Shots" },
  { code: "shots-on-target", label: "On target" },
];
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
type SideTeam = { id: number | null; name: string };

/** dangerous-attacks per ~15' bucket (delta of the cumulative trend), per side. */
function buildMomentum(trends: SmTrend[], home: SideTeam, away: SideTeam): MomentumBucket[] {
  // without resolved participant ids trends can't be attributed to a side —
  // return empty rather than silently mis-bucket (audit polish)
  if (home.id == null || away.id == null) return [];
  const da = trends.filter((t) => t.type?.code === "dangerous-attacks");
  if (da.length === 0) return [];
  const BUCKET = 15;
  const N = 6; // 0-15 … 75-90
  const sideOf = (id: number): Side | null => (id === home.id ? "home" : id === away.id ? "away" : null);
  const cum = (s: Side, endMin: number) =>
    da.filter((t) => sideOf(t.participant_id) === s && t.minute <= endMin)
      .reduce((m, t) => Math.max(m, Number(t.value ?? 0)), 0);
  const out: MomentumBucket[] = [];
  let prevH = 0, prevA = 0;
  for (let b = 1; b <= N; b++) {
    const h = cum("home", b * BUCKET);
    const a = cum("away", b * BUCKET);
    out.push({ minute: b * BUCKET, home: Math.max(0, h - prevH), away: Math.max(0, a - prevA) });
    prevH = h; prevA = a;
  }
  return out;
}

/** minutes spent home-leading / level / away-leading, from goal `result` values. */
function buildGameState(events: SmEvent[], _home: SideTeam, _away: SideTeam): GameState | null {
  if (events.length === 0) return null;
  const goalCodes = new Set(["goal", "penalty", "penalty-goal", "owngoal", "own-goal"]);
  const goals = events
    .filter((e) => e.type?.code && goalCodes.has(e.type.code) && e.result)
    // sort by the SAME effective minute used to accumulate below, so a 45+2'
    // goal never sorts ahead of a plain 46' and yields a dropped negative span
    .sort(
      (a, b) =>
        a.minute + (a.extra_minute ?? 0) - (b.minute + (b.extra_minute ?? 0)) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  const maxMin = Math.max(90, ...events.map((e) => e.minute + (e.extra_minute ?? 0)));
  let h = 0, a = 0, prev = 0, homeLed = 0, level = 0, awayLed = 0;
  const add = (mins: number) => {
    if (mins <= 0) return;
    if (h > a) homeLed += mins;
    else if (h < a) awayLed += mins;
    else level += mins;
  };
  for (const g of goals) {
    // include stoppage time so a 90+3 goal shifts the lead boundary correctly
    // and matches maxMin's extra_minute basis (audit polish)
    const gm = g.minute + (g.extra_minute ?? 0);
    add(gm - prev);
    prev = gm;
    const m = (g.result ?? "").match(/(\d+)\D+(\d+)/);
    if (m) { h = Number(m[1]); a = Number(m[2]); }
  }
  add(maxMin - prev);
  return { homeLed, level, awayLed };
}

/** Distill the heavy includes (player details, trends, periods) + events into
 *  the compact DeepStats. Server-side only; returns null pre-match. */
function normalizeDeep(raw: SmFixtureDetail, home: SideTeam, away: SideTeam): DeepStats | null {
  const lineups = raw.lineups ?? [];
  const sideOf = (teamId: number): Side | null => (teamId === home.id ? "home" : teamId === away.id ? "away" : null);
  const detail = (l: SmLineup, code: string): number | null => {
    const d = (l.details ?? []).find((x) => x.type?.code === code);
    return d ? num(d.data?.value) : null;
  };
  const nameOf = (l: SmLineup) => l.player?.display_name ?? l.player_name ?? "—";

  let xgHome = 0, xgAway = 0;
  const xgTop: XgPlayer[] = [];
  const ratingsHome: NamedValue[] = [];
  const ratingsAway: NamedValue[] = [];
  let gkHome: Goalkeeper | null = null;
  let gkAway: Goalkeeper | null = null;

  for (const l of lineups) {
    const side = sideOf(l.team_id);
    if (!side) continue;
    const xg = detail(l, "expected-goals");
    if (xg != null) {
      if (side === "home") xgHome += xg; else xgAway += xg;
      if (xg > 0) xgTop.push({ side, name: nameOf(l), xg: Math.round(xg * 100) / 100 });
    }
    const rating = detail(l, "rating");
    if (rating != null) (side === "home" ? ratingsHome : ratingsAway).push({ name: nameOf(l), value: rating });
    const posGk = (l.position_id ?? l.player?.position_id) === GK_POSITION_ID;
    const hasGkStats = detail(l, "saves") != null && detail(l, "goalkeeper-goals-conceded") != null;
    if (posGk || hasGkStats) {
      const gk: Goalkeeper = {
        name: nameOf(l),
        saves: detail(l, "saves"),
        conceded: detail(l, "goalkeeper-goals-conceded") ?? detail(l, "goals-conceded"),
        insideBoxSaves: detail(l, "saves-insidebox"),
      };
      if (side === "home" && !gkHome) gkHome = gk;
      if (side === "away" && !gkAway) gkAway = gk;
    }
  }
  xgTop.sort((x, y) => y.xg - x.xg);
  ratingsHome.sort((x, y) => y.value - x.value);
  ratingsAway.sort((x, y) => y.value - x.value);

  const momentum = buildMomentum(raw.trends ?? [], home, away);

  const periods = raw.periods ?? [];
  const perHalf: HalfStat[] = [];
  if (periods.length >= 1) {
    const pVal = (p: SmPeriod | undefined, code: string, loc: Side) => {
      const pid = loc === "home" ? home.id : away.id;
      const st = (p?.statistics ?? []).find(
        (s) => s.type?.code === code && (s.location === loc || s.participant_id === pid),
      );
      return num(st?.data?.value) ?? 0;
    };
    for (const def of PERHALF_CODES) {
      if (!periods.some((p) => (p.statistics ?? []).some((s) => s.type?.code === def.code))) continue;
      perHalf.push({
        code: def.code,
        label: def.label,
        first: { home: pVal(periods[0], def.code, "home"), away: pVal(periods[0], def.code, "away") },
        second: { home: pVal(periods[1], def.code, "home"), away: pVal(periods[1], def.code, "away") },
      });
    }
  }

  const gameState = buildGameState(raw.events ?? [], home, away);

  const empty =
    xgHome === 0 && xgAway === 0 && xgTop.length === 0 &&
    ratingsHome.length === 0 && ratingsAway.length === 0 &&
    !gkHome && !gkAway && momentum.length === 0 && perHalf.length === 0 && !gameState;
  if (empty) return null;

  return {
    xg: { home: Math.round(xgHome * 100) / 100, away: Math.round(xgAway * 100) / 100, top: xgTop.slice(0, 6) },
    ratings: { home: ratingsHome.slice(0, 5), away: ratingsAway.slice(0, 5) },
    goalkeepers: { home: gkHome, away: gkAway },
    momentum,
    perHalf,
    gameState,
  };
}

/** Pure: map a raw Sportmonks fixture detail to FixtureStats. Tolerates any
 *  missing include (defaults to empty), skips unknown event kinds, and drops
 *  rows whose location/team can't be resolved. */
/** Pre-game context for the Info tab. Distilled from venue/referees/weather/
 *  sidelined includes; returns null when nothing is available. */
/** Weather for the Info tab. Pre-match shows the match-day forecast; once the
 *  match has kicked off we surface the live `current` reading and flag a rain
 *  transition vs the kickoff forecast. Sportmonks wind is metric (m/s) → mph. */
function normalizeWeather(
  w: SmFixtureDetail["weatherreport"],
  started: boolean,
): MatchInfo["weather"] {
  if (!w) return null;
  const fcDesc = w.description ?? null;
  const liveDesc = w.current?.description ?? null;
  const useLive = started && (w.current?.temp != null || liveDesc != null);
  const description = (useLive ? liveDesc : fcDesc) ?? liveDesc ?? fcDesc;
  if (!description) return null;
  const tempC = useLive
    ? num(w.current?.temp ?? w.temperature?.day)
    : num(w.temperature?.day ?? w.current?.temp);
  const windMs = useLive
    ? num(w.current?.wind ?? w.wind?.speed)
    : num(w.wind?.speed ?? w.current?.wind);
  const humidity =
    (useLive ? w.current?.humidity : w.humidity) ?? w.humidity ?? w.current?.humidity ?? null;
  let note: string | null = null;
  if (started && fcDesc && liveDesc) {
    const wet = (d: string) => /rain|drizzle|shower|snow|sleet|thunder|storm/i.test(d);
    if (wet(liveDesc) && !wet(fcDesc)) note = "Rain since kickoff";
    else if (!wet(liveDesc) && wet(fcDesc)) note = "Cleared since kickoff";
  }
  return {
    description,
    temp: tempC,
    windMph: windMs != null ? Math.round(windMs * 2.23694) : null,
    humidity,
    note,
  };
}

function normalizeInfo(
  raw: SmFixtureDetail,
  home: SideTeam,
  away: SideTeam,
  started: boolean,
): MatchInfo | null {
  const v = raw.venue;
  const venue = v?.name
    ? { name: v.name, city: v.city_name ?? null, capacity: v.capacity ?? null }
    : null;

  // full officiating team, ordered by Sportmonks type_id (6 referee, 7/8
  // assistants, 9 fourth official, then VAR/AVAR when present). Designation
  // ("Referee", "1st Assistant", …) comes straight from the type include.
  const referees = (raw.referees ?? [])
    .map((r) => ({
      typeId: r.type_id ?? 99,
      role: r.type?.name ?? "Official",
      name: r.referee?.name ?? r.referee?.display_name ?? null,
    }))
    .filter((r): r is { typeId: number; role: string; name: string } => !!r.name)
    .sort((a, b) => a.typeId - b.typeId)
    .map((r) => ({ role: r.role, name: r.name }));

  const weather = normalizeWeather(raw.weatherreport, started);

  const teamNews: MatchInfo["teamNews"] = { home: [], away: [] };
  for (const s of raw.sidelined ?? []) {
    const side: Side | null =
      s.participant_id === home.id ? "home" : s.participant_id === away.id ? "away" : null;
    if (!side) continue;
    const name = s.player?.display_name ?? s.player?.name;
    if (!name) continue;
    teamNews[side].push({ name, reason: s.type?.name ?? "Out" });
  }

  if (
    !venue &&
    referees.length === 0 &&
    !weather &&
    teamNews.home.length === 0 &&
    teamNews.away.length === 0
  ) {
    return null;
  }
  return { venue, referees, weather, teamNews };
}

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
  for (const def of STAT_DEFS) {
    const rows = allStats.filter((s) => s.type?.code === def.code);
    if (rows.length === 0) continue;
    const val = (loc: Side) =>
      Number(rows.find((r) => r.location === loc)?.data?.value ?? 0) || 0;
    stats.push({
      code: def.code,
      label: def.label,
      home: val("home"),
      away: val("away"),
      unit: def.unit,
      group: def.group,
      tier: def.tier,
    });
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

  // "started" gates live-only behaviour (live weather, applying subs to the XI).
  const shortState = (raw.state?.short_name ?? raw.state?.state ?? "").toUpperCase();
  const started =
    score.home > 0 ||
    score.away > 0 ||
    (raw.events?.length ?? 0) > 0 ||
    /(1ST|2ND|HALF|HT|ET|PEN|LIVE|INPLAY|FT|AET|BREAK)/.test(shortState);

  // substitution events, chronological. player_id = incoming, related_player_id
  // = outgoing (confirmed against Sportmonks). Used to mutate the lineup live.
  const minLabel = (m: number, extra?: number | null) => `${m}${extra ? "+" + extra : ""}'`;
  const subs = (raw.events ?? [])
    .filter((e) => e.type?.code === "substitution" && e.player_id != null)
    .map((e) => ({
      participantId: e.participant_id,
      minute: minLabel(e.minute, e.extra_minute),
      sortKey: e.minute * 100 + (e.extra_minute ?? 0),
      onId: e.player_id as number,
      onName: e.player_name ?? "",
      offId: e.related_player_id ?? null,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const buildSide = (side: Side, team: { id: number | null; name: string }): SideLineup | null => {
    if (team.id == null) return null;
    const rows = (raw.lineups ?? []).filter((l) => l.team_id === team.id);
    if (rows.length === 0) return null;
    const toPlayer = (l: SmLineup, starting: boolean): LineupPlayer => ({
      playerId: l.player_id,
      name: l.player?.display_name ?? l.player_name ?? "—",
      jersey: l.jersey_number ?? null,
      line: l.formation_field ? Number(l.formation_field.split(":")[0]) || null : null,
      slot: l.formation_field ? Number(l.formation_field.split(":")[1]) || null : null,
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

    // Apply this team's subs to the XI: the incoming player inherits the
    // outgoing player's pitch slot (with a "came on for #N" badge), and the
    // outgoing player drops into the subs list stamped with the minute.
    const byId = new Map<number, LineupPlayer>();
    for (const p of [...starters, ...bench]) byId.set(p.playerId, p);
    const onPitch = new Map<number, LineupPlayer>();
    for (const p of starters) onPitch.set(p.playerId, p);
    const cameOnIds = new Set<number>();
    const offEntries: LineupPlayer[] = [];
    for (const s of subs) {
      if (s.participantId !== team.id || s.offId == null) continue;
      const off = onPitch.get(s.offId);
      if (!off) continue; // can't resolve who left — leave the XI untouched
      onPitch.delete(off.playerId);
      const onBase = byId.get(s.onId);
      const incoming: LineupPlayer = {
        playerId: s.onId,
        name: onBase?.name ?? s.onName ?? "—",
        jersey: onBase?.jersey ?? null,
        line: off.line,
        slot: off.slot,
        positionId: onBase?.positionId ?? off.positionId,
        starting: false,
        cameOnFor: { number: off.jersey, minute: s.minute },
      };
      onPitch.set(incoming.playerId, incoming);
      cameOnIds.add(s.onId);
      offEntries.push({ ...off, subbedOffAt: s.minute });
    }
    const pitchXI = [...onPitch.values()].sort(
      (a, b) => (a.line ?? 99) - (b.line ?? 99) || (a.slot ?? 99) - (b.slot ?? 99),
    );
    // subs list: players who left the pitch (with minute) first, then unused bench
    const benchList = [...offEntries, ...bench.filter((p) => !cameOnIds.has(p.playerId))];

    return { side, teamName: team.name, formation, starters: pitchXI, bench: benchList };
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
    deep: normalizeDeep(raw, home, away),
    info: normalizeInfo(raw, home, away, started),
  };
}

/** The 13 default bars as zeros (possession 50/50) — pre-match placeholder. */
export function placeholderStats(): StatBar[] {
  return STAT_DEFS.filter((d) => d.tier === "default").map((d) => ({
    code: d.code,
    label: d.label,
    unit: d.unit,
    group: d.group,
    tier: d.tier,
    home: d.code === "ball-possession" ? 50 : 0,
    away: d.code === "ball-possession" ? 50 : 0,
  }));
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
    deep: null,
    info: null,
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
  const include =
    "statistics.type;events.type;lineups.player;lineups.type;lineups.details.type;formations;participants;scores;state;trends.type;periods.statistics.type;venue;referees.referee;referees.type;sidelined.player;sidelined.type;weatherReport";
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
