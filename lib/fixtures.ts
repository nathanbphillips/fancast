import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Pulls the season's Arsenal fixtures from API-Football and upserts them
 * into public.fixtures. On the first successful sync, purges placeholder
 * seed rows (id < 0). Server-only; called from /api/fixtures/sync.
 */

export type FixtureRow = {
  id: number;
  competition: string;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_utc: string;
};

/**
 * Map a placeholder seed fixture (negative id) to its real API-Football
 * counterpart — but ONLY on an unambiguous single match by competition + both
 * team ids + the same UTC calendar day. Returns null otherwise: a missed
 * remap (seed kept) is the safe failure, whereas a wrong remap would point a
 * live room's broadcast at the wrong match, so we never guess. Pure +
 * exported for unit tests (M-9, audit).
 */
export function matchSeedToReal(
  seed: FixtureRow,
  real: FixtureRow[],
): number | null {
  const day = (s: string) => s.slice(0, 10); // UTC calendar day
  const hits = real.filter(
    (r) =>
      r.id > 0 &&
      r.competition === seed.competition &&
      r.home_team_id != null &&
      r.home_team_id === seed.home_team_id &&
      r.away_team_id != null &&
      r.away_team_id === seed.away_team_id &&
      day(r.kickoff_utc) === day(seed.kickoff_utc),
  );
  return hits.length === 1 ? hits[0].id : null;
}

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { id: number; season: number; name: string; round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

export async function syncFixtures(service: SupabaseClient) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    return { ok: false as const, reason: "APIFOOTBALL_KEY not configured" };
  }
  const base =
    process.env.APIFOOTBALL_BASE ?? "https://v3.football.api-sports.io";

  const res = await fetch(
    `${base}/fixtures?team=${config.arsenalTeamId}&season=${config.season}`,
    { headers: { "x-apisports-key": key }, cache: "no-store" },
  );
  if (!res.ok) {
    return {
      ok: false as const,
      reason: `API-Football responded ${res.status}`,
    };
  }

  const payload = (await res.json()) as { response?: ApiFixture[] };
  const fixtures = payload.response ?? [];
  if (fixtures.length === 0) {
    return { ok: false as const, reason: "API-Football returned no fixtures" };
  }

  const rows = fixtures.map((f) => ({
    id: f.fixture.id,
    league_id: f.league.id,
    season: f.league.season,
    competition: f.league.name,
    round: f.league.round,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    home_team_id: f.teams.home.id,
    away_team_id: f.teams.away.id,
    kickoff_utc: f.fixture.date,
    status: f.fixture.status.short,
    home_score: f.goals.home,
    away_score: f.goals.away,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await service.from("fixtures").upsert(rows);
  if (error) {
    return { ok: false as const, reason: error.message };
  }

  // real data is in — clean up the dev seeds (id < 0). A room may have been
  // opened against a seed before this first sync; the FK is ON DELETE NO ACTION
  // (migration 0014), so a blind delete would error and — when the result is
  // swallowed — leave seeds lingering forever (M-9, audit). Remap any
  // referencing room to its real fixture first, then delete only the seeds
  // nothing references, and surface a delete failure instead of faking success.
  const { data: seeds } = await service
    .from("fixtures")
    .select("id, competition, home_team_id, away_team_id, kickoff_utc")
    .lt("id", 0);
  const { data: referenced } = await service
    .from("rooms")
    .select("fixture_id")
    .lt("fixture_id", 0);
  const refIds = new Set((referenced ?? []).map((r) => r.fixture_id as number));
  const unremapped: number[] = [];
  for (const seed of (seeds ?? []) as FixtureRow[]) {
    if (!refIds.has(seed.id)) continue;
    const realId = matchSeedToReal(seed, rows as unknown as FixtureRow[]);
    if (realId == null) {
      unremapped.push(seed.id); // ambiguous/no match — keep the seed + its room
      continue;
    }
    const { error: remapErr } = await service
      .from("rooms")
      .update({ fixture_id: realId })
      .eq("fixture_id", seed.id);
    if (remapErr) unremapped.push(seed.id);
  }

  let del = service.from("fixtures").delete().lt("id", 0);
  if (unremapped.length) {
    del = del.not("id", "in", `(${unremapped.join(",")})`);
  }
  const { error: delErr } = await del;
  if (delErr) {
    return { ok: false as const, reason: `seed purge failed: ${delErr.message}` };
  }

  return { ok: true as const, count: rows.length, unremapped };
}
