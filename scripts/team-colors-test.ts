/**
 * Unit test for the line-up disc colours (npm run test:colors).
 * Founder rule 2026-09-06: Arsenal are ALWAYS the red circles; a red-family
 * opponent drops to their secondary colour.
 */
import { lineupDiscColors } from "@/lib/teamColors";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`);
  if (!ok) failures++;
};
const ARSENAL_RED = "#EF0107";

// Arsenal red at home and away
let c = lineupDiscColors("Arsenal", "Chelsea");
check("Arsenal home are red", c.home.bg === ARSENAL_RED, c.home.bg);
check("Chelsea keep their blue", c.away.bg === "#034694", c.away.bg);
c = lineupDiscColors("Aston Villa", "Arsenal");
check("Arsenal away are still red", c.away.bg === ARSENAL_RED, c.away.bg);
check("Villa keep their claret", c.home.bg === "#670E36", c.home.bg);

// red-family opponents drop to their secondary
c = lineupDiscColors("Liverpool", "Arsenal");
check("Arsenal red survives at Anfield", c.away.bg === ARSENAL_RED, c.away.bg);
check("Liverpool drop to their secondary", c.home.bg !== "#C8102E" && c.home.bg !== ARSENAL_RED, c.home.bg);
c = lineupDiscColors("Arsenal", "Manchester United");
check("United drop to their secondary", c.away.bg !== "#DA291C", c.away.bg);
c = lineupDiscColors("Arsenal", "Nottingham Forest");
check("Forest drop to their secondary", c.away.bg !== "#DD0000", c.away.bg);

// no Arsenal: a same-family matchup still separates (away switches)
c = lineupDiscColors("Chelsea", "Everton");
check("blue vs blue separates", c.home.bg !== c.away.bg, `${c.home.bg} vs ${c.away.bg}`);
c = lineupDiscColors("Liverpool", "Manchester United");
check("red vs red separates", c.home.bg !== c.away.bg, `${c.home.bg} vs ${c.away.bg}`);

// unknown teams (custom rooms) never crash and never match each other
c = lineupDiscColors("Springfield Isotopes", "Shelbyville FC");
check("unknown teams get distinct discs", c.home.bg !== c.away.bg, `${c.home.bg} vs ${c.away.bg}`);
c = lineupDiscColors(null, undefined);
check("null-safe", !!c.home.bg && !!c.away.bg);

// every resolved pair in this season's likely fixtures is distinct
const teams = [
  "Arsenal", "Aston Villa", "AFC Bournemouth", "Brentford", "Brighton & Hove Albion",
  "Burnley", "Chelsea", "Crystal Palace", "Everton", "Fulham", "Leeds United",
  "Liverpool", "Manchester City", "Manchester United", "Newcastle United",
  "Nottingham Forest", "Sunderland", "Tottenham Hotspur", "Coventry City", "Hull City",
];
let collisions = 0;
for (const h of teams) {
  for (const a of teams) {
    if (h === a) continue;
    const d = lineupDiscColors(h, a);
    if (d.home.bg === d.away.bg) {
      collisions++;
      console.log(`  collision: ${h} vs ${a} both ${d.home.bg}`);
    }
  }
}
check("no same-colour pairing across the league", collisions === 0, `${collisions} collisions`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
