/**
 * Discovery: what does OUR Sportmonks plan actually return for a fixture?
 * Enumerates the full statistic-type catalog and probes each enhancement
 * include individually (so a plan-gated one doesn't fail the whole request).
 *   npx tsx --env-file=.env.local scripts/sportmonks-explore.ts
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
  // a completed fixture has the richest data (final stats/lineups/weather/refs)
  const list = await get(`/fixtures/between/${config.season - 1}-07-01/${config.season}-06-30/${config.arsenalTeamId}?include=state&per_page=25`);
  const ft = (list.body.data ?? []).find((f: { state?: { short_name?: string } }) => f.state?.short_name === "FT");
  if (!ft) { console.log("no FT fixture"); return; }
  const id = ft.id as number;
  console.log(`exploring fixture ${id} (${ft.name})\n`);

  // 1. full statistic-type catalog
  const stx = await get(`/fixtures/${id}?include=statistics.type`);
  const types = new Map<string, string>();
  for (const s of (stx.body.data?.statistics ?? []) as { type?: { code: string; name: string; stat_group?: string } }[]) {
    if (s.type) types.set(s.type.code, `${s.type.name}${s.type.stat_group ? ` [${s.type.stat_group}]` : ""}`);
  }
  console.log(`=== STATISTIC TYPES AVAILABLE (${types.size}) ===`);
  [...types.entries()].sort().forEach(([code, label]) => console.log(`  ${code} — ${label}`));

  // 2. probe each enhancement include individually
  const includes = [
    "weatherReport", "venue", "referees", "coaches", "formations",
    "sidelined", "sidelined.player", "lineups.details.type", "events.type",
    "metadata", "trends", "periods", "scores", "odds", "predictions",
    "statistics.type", "league", "round", "stage", "season", "participants",
  ];
  console.log(`\n=== ENHANCEMENT INCLUDES (per-include probe) ===`);
  for (const inc of includes) {
    const r = await get(`/fixtures/${id}?include=${inc}`);
    const key = inc.split(".")[0];
    const field = r.body?.data?.[key];
    const present = Array.isArray(field) ? `array[${field.length}]` : field && typeof field === "object" ? `object{${Object.keys(field).slice(0, 8).join(",")}}` : field == null ? "null/absent" : String(field);
    const note = r.status !== 200 ? `HTTP ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 120)}` : present;
    console.log(`  ${inc.padEnd(22)} -> ${note}`);
  }

  // 3. a couple of richer samples worth seeing in full
  const rich = await get(`/fixtures/${id}?include=weatherReport;venue;referees;formations`);
  const d = rich.body?.data ?? {};
  console.log(`\n=== SAMPLES ===`);
  console.log("weatherReport:", JSON.stringify(d.weatherReport ?? null).slice(0, 400));
  console.log("venue:", JSON.stringify(d.venue ?? null).slice(0, 300));
  console.log("referees:", JSON.stringify(d.referees ?? null).slice(0, 400));
  console.log("formations:", JSON.stringify(d.formations ?? null).slice(0, 200));

  // 4. team form / standings endpoints (separate)
  const form = await get(`/teams/${config.arsenalTeamId}?include=latest;league`);
  console.log(`\nteam latest (form) HTTP ${form.status}: latest=${Array.isArray(form.body?.data?.latest) ? `array[${form.body.data.latest.length}]` : "n/a"}`);
  const standings = await get(`/standings/seasons`);
  console.log(`standings/seasons HTTP ${standings.status}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
