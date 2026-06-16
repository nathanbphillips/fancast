/** Unit test for the Sportmonks v3 fixture mapper. npm run test:sportmonks */
import { mapSportmonksFixture, type SmFixture } from "../lib/fixtures";

let failures = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}

// a finished match with half-time + current scores
const finished: SmFixture = {
  id: 19135001,
  league_id: 8,
  round_id: 339,
  starting_at: "2026-08-15 14:00:00",
  participants: [
    { id: 19, name: "Arsenal", meta: { location: "home" } },
    { id: 18, name: "Chelsea", meta: { location: "away" } },
  ],
  scores: [
    { description: "1ST_HALF", score: { goals: 1, participant: "home" } },
    { description: "1ST_HALF", score: { goals: 0, participant: "away" } },
    { description: "CURRENT", score: { goals: 2, participant: "home" } },
    { description: "CURRENT", score: { goals: 1, participant: "away" } },
  ],
  state: { state: "FT", short_name: "FT", name: "finished" },
  league: { name: "Premier League" },
  round: { name: "Regular Season - 1" },
};

const m = mapSportmonksFixture(finished, 2026);
eq("id", m.id, 19135001);
eq("league_id", m.league_id, 8);
eq("season is the configured year", m.season, 2026);
eq("competition from league include", m.competition, "Premier League");
eq("round from round include", m.round, "Regular Season - 1");
eq("home team", m.home_team, "Arsenal");
eq("away team", m.away_team, "Chelsea");
eq("home team id", m.home_team_id, 19);
eq("away team id", m.away_team_id, 18);
eq("kickoff normalized to ISO UTC", m.kickoff_utc, "2026-08-15T14:00:00.000Z");
eq("status from state short_name", m.status, "FT");
eq("home score reads CURRENT (not 1ST_HALF)", m.home_score, 2);
eq("away score reads CURRENT", m.away_score, 1);

// a not-started fixture: no scores yet, TBD opponents tolerated
const upcoming: SmFixture = {
  id: 19135002,
  league_id: 8,
  starting_at: "2026-08-22 16:30:00",
  participants: [{ id: 19, name: "Arsenal", meta: { location: "away" } }],
  scores: [],
  state: { state: "NS", short_name: "NS", name: "not-started" },
  league: { name: "Premier League" },
};
const u = mapSportmonksFixture(upcoming, 2026);
eq("no scores -> null home", u.home_score, null);
eq("no scores -> null away", u.away_score, null);
eq("missing home participant -> TBD", u.home_team, "TBD");
eq("away participant resolved", u.away_team, "Arsenal");
eq("upcoming status NS", u.status, "NS");

console.log(failures === 0 ? "\nALL SPORTMONKS MAP TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
