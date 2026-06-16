/**
 * Diagnostic for the Sportmonks switch — run once SPORTMONKS_API_TOKEN is set
 * in .env.local. Confirms the token works, resolves Arsenal's team id + the
 * EPL league id, and prints a sample fixture both raw and mapped so the mapper
 * can be checked against the real response.
 *   npm run sportmonks:check
 */
import { config } from "../lib/config";
import { mapSportmonksFixture, type SmFixture } from "../lib/fixtures";
import "dotenv/config";

const TOKEN = process.env.SPORTMONKS_API_TOKEN;
const BASE = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";

async function get(path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Authorization: TOKEN! } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  if (!TOKEN) {
    console.error("SPORTMONKS_API_TOKEN is not set in .env.local — add it and re-run.");
    process.exit(1);
  }

  // 1. token works + which leagues the plan covers
  const leagues = await get("/leagues?per_page=50");
  console.log(`token check (GET /leagues): HTTP ${leagues.status}`);
  if (leagues.status !== 200) {
    console.error("Token rejected or plan issue:", JSON.stringify(leagues.body).slice(0, 400));
    process.exit(1);
  }
  const ls = (leagues.body.data ?? []) as { id: number; name: string }[];
  console.log(`plan covers ${ls.length} league(s) on this page:`);
  for (const l of ls) console.log(`  - ${l.id}: ${l.name}`);
  const epl = ls.find((l) => /premier league/i.test(l.name) && !/women|2|u2|national/i.test(l.name));
  console.log(epl ? `\nEPL looks like league id ${epl.id} ("${epl.name}") — config has ${config.premierLeagueId}` : `\n(Premier League not on the first page; check the list or your plan covers England)`);

  // 2. resolve Arsenal's team id
  const team = await get("/teams/search/Arsenal");
  console.log(`\nteam search "Arsenal": HTTP ${team.status}`);
  const teams = (team.body.data ?? []) as { id: number; name: string; country_id?: number }[];
  for (const t of teams.slice(0, 8)) console.log(`  - ${t.id}: ${t.name}`);
  console.log(`config.arsenalTeamId = ${config.arsenalTeamId}`);

  // 3. sample fixtures for Arsenal, raw + mapped
  const start = `${config.season}-07-01`;
  const end = `${config.season + 1}-06-30`;
  const include = "participants;scores;state;league;round";
  const fx = await get(`/fixtures/between/${start}/${end}/${config.arsenalTeamId}?include=${include}&per_page=3`);
  console.log(`\nsample fixtures (GET /fixtures/between/${start}/${end}/${config.arsenalTeamId}): HTTP ${fx.status}`);
  const data = (fx.body.data ?? []) as SmFixture[];
  console.log(`returned ${data.length} fixture(s); pagination.has_more=${fx.body.pagination?.has_more}`);
  if (data[0]) {
    console.log("\n--- raw[0] ---");
    console.log(JSON.stringify(data[0], null, 2).slice(0, 1500));
    console.log("\n--- mapped[0] ---");
    console.log(JSON.stringify(mapSportmonksFixture(data[0], config.season), null, 2));
  } else {
    console.log("(no fixtures in the season window yet — try once the 2026-27 schedule is published)");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
