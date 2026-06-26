import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Daily auto-matching for admin-created fixtures (World Cup / friendlies / any
 * game). Resolves the entered team names to Sportmonks ids and finds the
 * fixture, then backfills the Sportmonks id + team ids + competition so the
 * stats/info/history panels light up. Only finds games in the plan's covered
 * leagues (EPL / FA Cup / Carabao / 2.Bundesliga); national teams and
 * uncovered competitions resolve to nothing and the room stays "coming soon".
 */

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

/** Resolve a free-text team name to a Sportmonks team id (covered teams only;
 *  national/uncovered teams return null). Prefers an exact case-insensitive name. */
async function searchTeamId(name: string): Promise<number | null> {
  const q = name.trim();
  if (!q) return null;
  const json = (await smGet(`/teams/search/${encodeURIComponent(q)}`)) as {
    data?: { id: number; name: string }[];
  };
  const teams = json.data ?? [];
  if (teams.length === 0) return null;
  const exact = teams.find((t) => t.name.toLowerCase() === q.toLowerCase());
  return (exact ?? teams[0]).id;
}

type PendingFixture = {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
};

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function matchPendingFixtures(
  service: SupabaseClient,
): Promise<{ checked: number; matched: number }> {
  // skip games more than 2 days past — they'll never get fresh data
  const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data: pending } = await service
    .from("fixtures")
    .select("id, home_team, away_team, kickoff_utc")
    .eq("source", "admin")
    .is("sportmonks_fixture_id", null)
    .gte("kickoff_utc", cutoff)
    .returns<PendingFixture[]>();

  let matched = 0;
  for (const fx of pending ?? []) {
    try {
      const homeId = await searchTeamId(fx.home_team);
      const awayId = await searchTeamId(fx.away_team);
      if (homeId == null || awayId == null) continue;

      const k = new Date(fx.kickoff_utc).getTime();
      const json = (await smGet(
        `/fixtures/between/${ymd(k - 3 * 86_400_000)}/${ymd(k + 3 * 86_400_000)}/${homeId}?include=participants;league`,
      )) as {
        data?: {
          id: number;
          league?: { name?: string };
          participants?: { id: number; meta?: { location?: string } }[];
        }[];
      };
      const found = (json.data ?? []).find((f) => {
        const h = f.participants?.find((p) => p.meta?.location === "home");
        const a = f.participants?.find((p) => p.meta?.location === "away");
        return h?.id === homeId && a?.id === awayId;
      });
      if (!found) continue;

      await service
        .from("fixtures")
        .update({
          sportmonks_fixture_id: found.id,
          home_team_id: homeId,
          away_team_id: awayId,
          competition: found.league?.name ?? "Match",
        })
        .eq("id", fx.id);
      matched++;
    } catch {
      // non-critical — try the rest
    }
  }
  return { checked: (pending ?? []).length, matched };
}
