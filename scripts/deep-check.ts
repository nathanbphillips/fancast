/** Verify the distilled deep stats against the real Arsenal-Chelsea fixture.
 *  npx tsx --env-file=.env.local scripts/deep-check.ts */
import { getFixtureStats } from "../lib/stats";
import "dotenv/config";
async function main() {
  const s = await getFixtureStats(19427155);
  const d = s.deep;
  if (!d) { console.log("deep is null"); return; }
  console.log(`${s.home.name} ${s.score.home}-${s.score.away} ${s.away.name}\n`);
  console.log(`xG: ${d.xg.home} - ${d.xg.away}  (top: ${d.xg.top.slice(0, 4).map((p) => `${p.name} ${p.xg}`).join(", ")})`);
  console.log(`ratings home: ${d.ratings.home.slice(0, 3).map((r) => `${r.name} ${r.value}`).join(", ")}`);
  console.log(`ratings away: ${d.ratings.away.slice(0, 3).map((r) => `${r.name} ${r.value}`).join(", ")}`);
  console.log(`GK home: ${d.goalkeepers.home ? `${d.goalkeepers.home.name} saves ${d.goalkeepers.home.saves} conceded ${d.goalkeepers.home.conceded}` : "—"}`);
  console.log(`GK away: ${d.goalkeepers.away ? `${d.goalkeepers.away.name} saves ${d.goalkeepers.away.saves} conceded ${d.goalkeepers.away.conceded}` : "—"}`);
  console.log(`momentum (${d.momentum.length} buckets): ${d.momentum.map((m) => `${m.minute}'[${m.home}-${m.away}]`).join(" ")}`);
  console.log(`perHalf: ${d.perHalf.map((h) => `${h.label} 1H ${h.first.home}-${h.first.away} / 2H ${h.second.home}-${h.second.away}`).join(" | ")}`);
  console.log(`gameState: led ${d.gameState?.homeLed}' · level ${d.gameState?.level}' · trailed ${d.gameState?.awayLed}'`);
}
main().catch((e) => { console.error(e); process.exit(1); });
