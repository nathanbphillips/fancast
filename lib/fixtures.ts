import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Pulls the season's Arsenal fixtures from API-Football and upserts them
 * into public.fixtures. On the first successful sync, purges placeholder
 * seed rows (id < 0). Server-only; called from /api/fixtures/sync.
 */

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

  // real data is in — drop the dev seeds
  await service.from("fixtures").delete().lt("id", 0);

  return { ok: true as const, count: rows.length };
}
