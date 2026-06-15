/** Unit test for the seed->real fixture matcher (audit M-9). npm run test:fixtures */
import { matchSeedToReal, type FixtureRow } from "../lib/fixtures";

let failures = 0;
function eq(name: string, got: number | null, want: number | null) {
  const ok = got === want;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
}

const seed: FixtureRow = { id: -1, competition: "Premier League", home_team_id: 42, away_team_id: 50, kickoff_utc: "2026-08-15T14:00:00+00:00" };
const real: FixtureRow[] = [
  { id: 1001, competition: "Premier League", home_team_id: 42, away_team_id: 50, kickoff_utc: "2026-08-15T16:30:00+00:00" }, // same day, later KO
  { id: 1002, competition: "Premier League", home_team_id: 50, away_team_id: 42, kickoff_utc: "2026-08-15T16:30:00+00:00" }, // reverse fixture
  { id: 1003, competition: "FA Cup", home_team_id: 42, away_team_id: 50, kickoff_utc: "2026-08-15T16:30:00+00:00" }, // diff competition
];

eq("exact single match (same day, both team ids, competition)", matchSeedToReal(seed, real), 1001);
eq("different calendar day -> null", matchSeedToReal({ ...seed, kickoff_utc: "2026-08-16T14:00:00+00:00" }, real), null);
eq("home/away reversed -> null", matchSeedToReal({ ...seed, home_team_id: 50, away_team_id: 42 }, [real[1]]), 1002); // reversed seed matches reversed real
eq("teams swapped vs a same-order real -> null", matchSeedToReal({ ...seed, home_team_id: 50, away_team_id: 42 }, [real[0]]), null);
eq("different competition -> null", matchSeedToReal({ ...seed, competition: "Carabao Cup" }, real), null);
eq("null team ids -> null", matchSeedToReal({ ...seed, home_team_id: null }, real), null);
eq("no real counterpart -> null", matchSeedToReal(seed, []), null);

// ambiguity: two real rows matching the same key -> null (never guess)
const dup: FixtureRow[] = [real[0], { ...real[0], id: 9999 }];
eq("ambiguous double match -> null", matchSeedToReal(seed, dup), null);

console.log(failures === 0 ? "\nALL FIXTURE TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
