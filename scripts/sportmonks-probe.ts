/**
 * One-off: dump the real Sportmonks v3 shape of statistics / events / lineups /
 * formations for a completed Arsenal fixture, so the Phase 7 mapper is built
 * against ground truth. npx tsx --env-file=.env.local scripts/sportmonks-probe.ts
 */
import { config } from "../lib/config";
import "dotenv/config";

const TOKEN = process.env.SPORTMONKS_API_TOKEN!;
const BASE = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: TOKEN } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  // find a finished Arsenal fixture from last season
  const list = await get(`/fixtures/between/${config.season - 1}-07-01/${config.season}-06-30/${config.arsenalTeamId}?include=state&per_page=20`);
  const fixtures = (list.body.data ?? []) as { id: number; name?: string; state?: { short_name?: string } }[];
  const finished = fixtures.find((f) => f.state?.short_name === "FT") ?? fixtures[0];
  if (!finished) { console.log("no fixtures found"); return; }
  console.log(`probing fixture ${finished.id} (${finished.name})`);

  const include = "statistics.type;events.type;lineups.player;lineups.type;formations;periods";
  const fx = await get(`/fixtures/${finished.id}?include=${include}`);
  console.log(`HTTP ${fx.status}`);
  if (fx.status !== 200) { console.log(JSON.stringify(fx.body).slice(0, 600)); return; }
  const f = fx.body.data;

  console.log("\nTOP-LEVEL KEYS:", Object.keys(f));
  console.log("\n=== statistics (first 6) — count:", (f.statistics ?? []).length);
  console.log(JSON.stringify((f.statistics ?? []).slice(0, 6), null, 2));
  console.log("\n=== events (first 4) — count:", (f.events ?? []).length);
  console.log(JSON.stringify((f.events ?? []).slice(0, 4), null, 2));
  console.log("\n=== lineups (first 3) — count:", (f.lineups ?? []).length);
  console.log(JSON.stringify((f.lineups ?? []).slice(0, 3), null, 2));
  console.log("\n=== formations — count:", (f.formations ?? []).length);
  console.log(JSON.stringify(f.formations ?? [], null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
