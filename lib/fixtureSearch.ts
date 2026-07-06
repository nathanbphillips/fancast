import { config } from "@/lib/config";
import { mapSportmonksFixture, type SmFixture } from "@/lib/fixtures";

/**
 * Sportmonks fixture search + single-fixture fetch for the custom-room create
 * flow (founder 2026-07-06). The suggest box on /host/new searches upcoming
 * games across the plan's covered competitions by team name; picking one links
 * the room to the real fixture so stats/info/history light up. Uncovered
 * competitions simply return nothing here, and the host creates an unlinked
 * room instead ("Information coming soon").
 *
 * Server-only. Results are mapped through the same pure mapper the daily sync
 * uses (lib/fixtures.ts mapSportmonksFixture) so a linked fixture row is
 * byte-identical in shape to a synced one.
 */

function sm() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error("SPORTMONKS_API_TOKEN not configured");
  const base =
    process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  return { token, base };
}

async function smGet(path: string): Promise<unknown> {
  const { token, base } = sm();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sportmonks responded ${res.status}`);
  return res.json();
}

/** What the create-page suggest dropdown renders. */
export type FixtureSuggestion = {
  sportmonksFixtureId: number;
  home: string;
  away: string;
  kickoffUtc: string;
  competition: string;
};

// Small per-instance TTL cache: the suggest box fires on every few keystrokes
// and Sportmonks calls are plan-metered.
const SEARCH_TTL_MS = 60_000;
const searchCache = new Map<
  string,
  { at: number; results: FixtureSuggestion[] }
>();

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Search upcoming (and just-started) fixtures by team name. Covered
 * competitions only, by construction: the plan scopes what the API returns.
 *
 * Note: Sportmonks' /fixtures/search paginates from the OLDEST fixture and
 * accepts no date filter/sort (verified 2026-07-06), so we use the same
 * endpoints the daily auto-matcher relies on instead: resolve the typed name
 * to team candidates, then pull each team's fixtures in a forward window.
 * "Arsenal vs Chelsea" style queries search by the first team and narrow by
 * the second.
 */
export async function searchUpcomingFixtures(
  query: string,
): Promise<FixtureSuggestion[]> {
  const key = query.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;

  const [teamPart, opponentPart] = query
    .trim()
    .split(/\s+vs?\.?\s+/i)
    .map((s) => s.trim());
  if (!teamPart) return [];

  const teamsJson = (await smGet(
    `/teams/search/${encodeURIComponent(teamPart)}`,
  )) as { data?: { id: number; name?: string }[] };
  // cap the per-request upstream fan-out: 1 team-search + up to 2 fixture
  // pulls = 3 metered Sportmonks calls per cache miss (review 2026-07-06)
  const teams = (teamsJson.data ?? []).slice(0, 2);

  const now = Date.now();
  const from = ymd(now - 86_400_000);
  const to = ymd(now + 120 * 86_400_000);
  const byId = new Map<number, ReturnType<typeof mapSportmonksFixture>>();
  for (const t of teams) {
    try {
      const json = (await smGet(
        `/fixtures/between/${from}/${to}/${t.id}?include=participants;league`,
      )) as { data?: SmFixture[] };
      for (const f of json.data ?? []) {
        const r = mapSportmonksFixture(f, config.season);
        byId.set(r.id, r);
      }
    } catch {
      // one team failing shouldn't kill the whole suggest
    }
  }

  let rows = [...byId.values()].filter((r) => {
    const k = new Date(r.kickoff_utc).getTime();
    // keep in-progress games (a room "can be immediate") too
    return (
      k > now - 3 * 3_600_000 &&
      r.home_team !== "TBD" &&
      r.away_team !== "TBD"
    );
  });
  if (opponentPart) {
    const needle = opponentPart.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.home_team.toLowerCase().includes(needle) ||
        r.away_team.toLowerCase().includes(needle),
    );
  }

  const results: FixtureSuggestion[] = rows
    .sort(
      (a, b) =>
        new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
    )
    .slice(0, 8)
    .map((r) => ({
      sportmonksFixtureId: r.id,
      home: r.home_team,
      away: r.away_team,
      kickoffUtc: r.kickoff_utc,
      competition: r.competition,
    }));

  if (searchCache.size > 300) searchCache.clear(); // bounded, coarse
  searchCache.set(key, { at: Date.now(), results });
  return results;
}

/** Fetch ONE fixture by Sportmonks id, mapped to our fixtures-table row shape.
 *  Used server-side when a host links a suggested game, so we never trust
 *  client-supplied team names/kickoffs. Returns null when not found. */
export async function fetchSportmonksFixtureRow(
  sportmonksFixtureId: number,
): Promise<ReturnType<typeof mapSportmonksFixture> | null> {
  const json = (await smGet(
    `/fixtures/${sportmonksFixtureId}?include=participants;scores;state;league;round`,
  )) as { data?: SmFixture };
  const f = json.data;
  if (!f?.id) return null;
  return mapSportmonksFixture(f, config.season);
}
