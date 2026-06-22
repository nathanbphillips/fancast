/** Unit test for the Phase 7 stats normalizer. npm run test:stats
 *  Payload mirrors the real Sportmonks probe (Man Utd vs Arsenal). */
import { normalize, emptyStats, type SmFixtureDetail } from "../lib/stats";

let failures = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}
function ok(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const stat = (code: string, name: string, home: number, away: number) => [
  { participant_id: 14, location: "home", data: { value: home }, type: { id: 1, code, name } },
  { participant_id: 19, location: "away", data: { value: away }, type: { id: 1, code, name } },
];

const raw: SmFixtureDetail = {
  id: 19427463,
  participants: [
    { id: 14, name: "Manchester United", meta: { location: "home" } },
    { id: 19, name: "Arsenal", meta: { location: "away" } },
  ],
  scores: [
    { description: "1ST_HALF", score: { goals: 0, participant: "away" } },
    { description: "CURRENT", score: { goals: 0, participant: "home" } },
    { description: "CURRENT", score: { goals: 1, participant: "away" } },
  ],
  state: { state: "FT", short_name: "FT", name: "Finished" },
  statistics: [
    ...stat("ball-possession", "Ball Possession %", 61, 39),
    ...stat("shots-total", "Shots Total", 22, 9),
    ...stat("corners", "Corners", 3, 4),
    ...stat("passes", "Passes", 520, 410),
    ...stat("shots-insidebox", "Shots Insidebox", 14, 5),
    ...stat("some-unlisted-stat", "Ignored", 5, 5), // not in catalogue -> dropped
  ],
  events: [
    { minute: 55, extra_minute: null, participant_id: 14, player_id: 1, player_name: "Amad Diallo", related_player_name: "Diogo Dalot", result: null, info: null, sort_order: 1, type_id: 18, type: { id: 18, code: "substitution", name: "Substitution" } },
    { minute: 13, extra_minute: null, participant_id: 19, player_id: 2, player_name: "Riccardo Calafiori", related_player_name: null, result: "0-1", info: "Header", sort_order: 1, type_id: 14, type: { id: 14, code: "goal", name: "Goal" } },
    { minute: 70, extra_minute: 2, participant_id: 14, player_id: 3, player_name: "Bruno", related_player_name: null, result: null, info: null, sort_order: 1, type_id: 999, type: { id: 999, code: "mystery-event", name: "Mystery" } }, // unknown -> dropped
  ],
  lineups: [
    { team_id: 14, player_id: 100, formation_field: "1:1", type_id: 11, position_id: 24, player_name: "GK", jersey_number: 1, player: { display_name: "Goalkeeper" }, type: { code: "lineup" }, details: [{ type: { code: "saves" }, data: { value: 3 } }, { type: { code: "goalkeeper-goals-conceded" }, data: { value: 1 } }] },
    { team_id: 14, player_id: 101, formation_field: "2:2", type_id: 11, player_name: "Def", jersey_number: 4, player: { display_name: "Defender" }, type: { code: "lineup" }, details: [{ type: { code: "expected-goals" }, data: { value: 0.5 } }, { type: { code: "rating" }, data: { value: 7.5 } }] },
    { team_id: 14, player_id: 102, type_id: 12, player_name: "Sub", jersey_number: 30, player: { display_name: "Sub Guy" }, type: { code: "bench" } },
    { team_id: 19, player_id: 200, formation_field: "1:1", type_id: 11, player_name: "ArsGK", jersey_number: 1, player: { display_name: "Arsenal GK" }, type: { code: "lineup" } },
  ],
  formations: [
    { participant_id: 19, formation: "4-3-3", location: "away" },
    { participant_id: 14, formation: "4-2-3-1", location: "home" },
  ],
};

const m = normalize(raw);

eq("home team", [m.home.id, m.home.name], [14, "Manchester United"]);
eq("away team", [m.away.id, m.away.name], [19, "Arsenal"]);
eq("score from CURRENT", m.score, { home: 0, away: 1 });
eq("status label", m.status.short, "FT");

eq("stat bars in catalogue order, unlisted dropped", m.stats.map((s) => s.code), ["shots-total", "corners", "ball-possession", "passes", "shots-insidebox"]);
const poss = m.stats.find((s) => s.code === "ball-possession")!;
eq("possession is a pct bar 61/39", [poss.home, poss.away, poss.unit], [61, 39, "pct"]);
const shots = m.stats.find((s) => s.code === "shots-total")!;
eq("shots is a count bar 22/9", [shots.home, shots.away, shots.unit], [22, 9, "count"]);
const pass = m.stats.find((s) => s.code === "passes")!;
eq("total passes -> default tier, Possession & passing", [pass.tier, pass.group], ["default", "Possession & passing"]);
const sib = m.stats.find((s) => s.code === "shots-insidebox")!;
eq("shots in box -> more tier, Shooting", [sib.tier, sib.group], ["more", "Shooting"]);

ok("unknown event dropped, 2 kept", m.events.length === 2, `${m.events.length}`);
eq("events sorted ascending by minute (goal@13 first)", m.events.map((e) => e.minute), [13, 55]);
const goal = m.events.find((e) => e.kind === "goal")!;
eq("goal: away side, scorer, running score", [goal.side, goal.player, goal.result], ["away", "Riccardo Calafiori", "0-1"]);
const sub = m.events.find((e) => e.kind === "substitution")!;
eq("sub: home side, in + out players", [sub.side, sub.player, sub.relatedPlayer], ["home", "Amad Diallo", "Diogo Dalot"]);

ok("home lineup present", !!m.lineups.home);
eq("home formation", m.lineups.home!.formation, "4-2-3-1");
eq("home starters (by line, GK first) names", m.lineups.home!.starters.map((p) => p.name), ["Goalkeeper", "Defender"]);
eq("home bench separated", m.lineups.home!.bench.map((p) => p.name), ["Sub Guy"]);
eq("away formation", m.lineups.away!.formation, "4-3-3");

// deep stats (distilled from player details + the goal event)
ok("deep present (has detail + events)", !!m.deep);
eq("team xG summed from player expected-goals", m.deep!.xg.home, 0.5);
eq("top xG contributor", m.deep!.xg.top[0]?.name, "Defender");
eq("player rating captured", m.deep!.ratings.home[0], { name: "Defender", value: 7.5 });
eq("goalkeeper detected with saves/conceded", [m.deep!.goalkeepers.home?.name, m.deep!.goalkeepers.home?.saves, m.deep!.goalkeepers.home?.conceded], ["Goalkeeper", 3, 1]);
ok("game state: away led after the 13' goal", (m.deep!.gameState?.awayLed ?? 0) > 0 && m.deep!.gameState?.homeLed === 0);

// empty / seed-fixture contract
const e = emptyStats(-1);
eq("emptyStats: no bars/events", [e.stats.length, e.events.length], [0, 0]);
eq("emptyStats: null lineups + NS status", [e.lineups.home, e.lineups.away, e.status.short], [null, null, "NS"]);

console.log(failures === 0 ? "\nALL STATS MAP TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
