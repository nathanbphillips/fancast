/**
 * Phase 7 end-to-end against a COMPLETED past Arsenal fixture (no live match
 * exists). Verifies the /api/stats proxy returns real normalized stats/events/
 * lineups, the seed-fixture (id<=0) zeros contract, the cache hit, and the
 * commentator-gated /api/stats-tab push. Needs the dev server + .env.local.
 *   npm run smoke7 / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";
import { config } from "../lib/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SM_TOKEN = process.env.SPORTMONKS_API_TOKEN!;
const SM_BASE = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "phase7-Pass-1!";
const FIXTURE_ID = -1;
const USERS = [
  { email: "fancast.p7.c@example.com", username: "p7_c", role: "commentator" },
  { email: "fancast.p7.l@example.com", username: "p7_l" },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function cookieFor(s: Session) {
  return `sb-${PROJECT_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
}
async function post(path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const t of USERS) {
    const u = data?.users.find((x) => x.email === t.email);
    if (u) { await service.from("rooms").delete().eq("commentator_id", u.id); await service.auth.admin.deleteUser(u.id); }
  }
  console.log("clean done");
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  // resolve a real completed (FT) Arsenal fixture id from last season
  const list = await fetch(
    `${SM_BASE}/fixtures/between/${config.season - 1}-07-01/${config.season}-06-30/${config.arsenalTeamId}?include=state&per_page=25`,
    { headers: { Authorization: SM_TOKEN } },
  ).then((r) => r.json());
  const ft = (list.data ?? []).find((f: { state?: { short_name?: string } }) => f.state?.short_name === "FT");
  check("found a completed (FT) fixture to test against", !!ft, ft ? `id ${ft.id}` : "none");
  if (!ft) { console.log("\nCANNOT TEST without an FT fixture"); process.exit(1); }
  const fixtureId = ft.id as number;

  // --- proxy returns real normalized data ---
  const t0 = Date.now();
  const r1 = await fetch(`${APP}/api/stats/${fixtureId}`);
  const s = await r1.json();
  check("GET /api/stats/{id} -> 200", r1.status === 200, `${r1.status}`);
  check("real stat bars returned", Array.isArray(s.stats) && s.stats.length > 0, `${s.stats?.length} bars`);
  check("possession bar is a pct", s.stats?.[0]?.unit === "pct" || s.stats?.some((b: { unit: string }) => b.unit === "pct"));
  check("lineups populated (XI present)", !!s.lineups?.home?.starters?.length || !!s.lineups?.away?.starters?.length);
  check("home/away names resolved (not placeholder)", s.home?.name !== "Home" && s.away?.name !== "Away", `${s.home?.name} v ${s.away?.name}`);
  check("status is a label not a clock", typeof s.status?.short === "string");

  // cache hit: second call is fast (served from the 10s TTL)
  const t1 = Date.now();
  const r2 = await fetch(`${APP}/api/stats/${fixtureId}`);
  await r2.json();
  const cachedMs = Date.now() - t1;
  check("second GET served from cache (fast)", r2.status === 200 && cachedMs < (Date.now() - t0), `${cachedMs}ms`);

  // seed/dev fixture (id<=0) -> zeros contract, no upstream call
  const rNeg = await fetch(`${APP}/api/stats/-5`);
  const neg = await rNeg.json();
  check("id<=0 -> 200 zeros contract", rNeg.status === 200 && neg.stats.length === 0 && neg.lineups.home === null && neg.status.short === "NS");

  // --- tab push auth ---
  const cookies: Record<string, string> = {};
  for (const u of USERS) {
    const { data: created } = await service.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: u.email, password: PASSWORD });
    cookies[u.username] = cookieFor(si!.session!);
    await post("/api/profile", cookies[u.username], { username: u.username });
    if (u.role) await service.from("profiles").update({ role: u.role }).eq("user_id", created!.user!.id);
  }
  const room = await post("/api/rooms", cookies.p7_c, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = room.body.room.id as string;

  let r = await post("/api/stats-tab", cookies.p7_c, { roomId, tab: "events" });
  check("commentator can push a tab -> 200", r.status === 200, `${r.status}`);
  r = await post("/api/stats-tab", cookies.p7_l, { roomId, tab: "events" });
  check("listener cannot push a tab -> 403", r.status === 403, `${r.status}`);
  r = await post("/api/stats-tab", cookies.p7_c, { roomId, tab: "bogus" });
  check("invalid tab -> 400", r.status === 400, `${r.status}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
