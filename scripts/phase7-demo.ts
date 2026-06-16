/**
 * Temporary demo room pointed at a real completed fixture so the Phase 7 stats
 * panel can be eyeballed in the browser with live data. Cleans up everything
 * it creates. npx tsx --env-file=.env.local scripts/phase7-demo.ts on|off
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const EMAIL = "fancast.p7demo@example.com";
const PASSWORD = "p7demo-Pass-1!";
const FIXTURE_ID = 19427463; // real FT Man Utd vs Arsenal

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
function cookieFor(s: Session) {
  return `sb-${PROJECT_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
}

async function off() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL);
  if (u) { await service.from("rooms").delete().eq("commentator_id", u.id); await service.auth.admin.deleteUser(u.id); }
  await service.from("fixtures").delete().eq("id", FIXTURE_ID);
  console.log("demo torn down");
}

async function on() {
  await off();
  // a fixtures row must exist for the rooms FK (stats themselves come live from /api/stats)
  await service.from("fixtures").upsert({
    id: FIXTURE_ID, league_id: 8, season: 2026, competition: "Premier League", round: "1",
    home_team: "Manchester United", away_team: "Arsenal", home_team_id: 14, away_team_id: 19,
    kickoff_utc: "2025-08-17T15:30:00+00:00", status: "FT", home_score: 0, away_score: 1,
    updated_at: new Date().toISOString(),
  });
  const { data: created } = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookie = cookieFor(si!.session!);
  // create the profile first, THEN elevate to commentator
  await fetch(`${APP}/api/profile`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ username: "p7demo" }) });
  await service.from("profiles").update({ role: "commentator" }).eq("user_id", created!.user!.id);
  const r = await fetch(`${APP}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ action: "open_waiting", fixtureId: FIXTURE_ID }) });
  const room = (await r.json()).room;
  await fetch(`${APP}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ action: "start", roomId: room.id }) });
  console.log(`DEMO ROOM: ${APP}/room/${room.id}`);
}

(process.argv[2] === "off" ? off() : on()).catch((e) => { console.error(e); process.exit(1); });
