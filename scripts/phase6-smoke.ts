/**
 * Phase 6 clock smoke test against a RUNNING dev server (localhost:3000).
 * Simulated full match cycle: pregame -> 1H -> halftime -> 2H -> postgame
 * -> ET -> postgame, with adjustments, illegal-transition rejections, and
 * derivation checks against the REST-fetched event log (reconnect path).
 *   npm run smoke6 / npm run smoke6 -- clean
 */
import * as Ably from "ably";
import { createClient, type Session } from "@supabase/supabase-js";
import { deriveClock, formatClock, type ClockEventInput } from "../lib/clock";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const FIXTURE_ID = -1;
const PASSWORD = "smoke6-Pass-1!";

const USERS = [
  { email: "fancast.smoke6.kev@example.com", username: "smoke6_kev", role: "commentator" },
  { email: "fancast.smoke6.alice@example.com", username: "smoke6_alice" },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function cookieFor(session: Session): string {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

async function api(path: string, cookie: string, body?: unknown, method = "POST") {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const t of USERS) {
    const u = data?.users.find((x) => x.email === t.email);
    if (u) {
      await service.from("rooms").delete().eq("commentator_id", u.id);
      await service.auth.admin.deleteUser(u.id);
      console.log(`removed ${t.email}`);
    }
  }
  console.log("clean done");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const cookies: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created, error } = await service.auth.admin.createUser({
      email: t.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: signedIn } = await anon.auth.signInWithPassword({
      email: t.email,
      password: PASSWORD,
    });
    cookies[t.username] = cookieFor(signedIn!.session!);
    await api("/api/profile", cookies[t.username], { username: t.username });
    if (t.role) {
      await service.from("profiles").update({ role: t.role }).eq("user_id", created.user.id);
    }
  }

  let r = await api("/api/rooms", cookies.smoke6_kev, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;

  const observer = new Ably.Realtime({ key: process.env.ABLY_API_KEY! });
  const clockEvents: ClockEventInput[] = [];
  const states: string[] = [];
  const ch = observer.channels.get(`room:${roomId}:control`);
  await ch.subscribe("clock", (m) => clockEvents.push(m.data as ClockEventInput));
  await ch.subscribe("state", (m) => states.push((m.data as { state: string }).state));

  await api("/api/rooms", cookies.smoke6_kev, { action: "start", roomId });

  // --- guards
  r = await api("/api/clock", cookies.smoke6_alice, { roomId, action: "start1h" });
  check("listener cannot run the clock", r.status === 403);
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "start2h" });
  check("illegal transition rejected (start2h from pregame)", r.status === 409);
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "adjust", offsetSeconds: 1 });
  check("adjust rejected while stopped", r.status === 409);

  // --- full cycle
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "start1h" });
  check("start1h -> live_1h", r.status === 200 && r.body.state === "live_1h");
  await sleep(2200);
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "adjust", offsetSeconds: 1 });
  check("+1s adjust accepted while live", r.status === 200);
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "adjust", offsetSeconds: -1 });
  check("-1s adjust accepted", r.status === 200);

  // derivation from the DB event log (= reconnect path)
  const { data: events1 } = await service
    .from("clock_events")
    .select("action, server_ts, offset_seconds")
    .eq("room_id", roomId)
    .order("server_ts", { ascending: true });
  const d1 = deriveClock(events1 as ClockEventInput[], Date.now());
  check(
    "derived clock runs in 1H at ~elapsed seconds",
    d1.running === true && d1.period === "1H" && d1.elapsedSeconds >= 2 && d1.elapsedSeconds <= 6,
    d1.running ? `1H ${formatClock(d1.elapsedSeconds)}` : "not running",
  );

  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "stop1h" });
  check("stop1h -> halftime", r.status === 200 && r.body.state === "halftime");
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "start2h" });
  check("start2h -> live_2h", r.status === 200 && r.body.state === "live_2h");

  const { data: events2 } = await service
    .from("clock_events")
    .select("action, server_ts, offset_seconds")
    .eq("room_id", roomId)
    .order("server_ts", { ascending: true });
  const d2 = deriveClock(events2 as ClockEventInput[], Date.now());
  check(
    "second half derives from 45:00",
    d2.running === true && d2.period === "2H" && d2.elapsedSeconds >= 45 * 60 && d2.elapsedSeconds < 45 * 60 + 5,
    d2.running ? formatClock(d2.elapsedSeconds) : "not running",
  );

  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "stop2h" });
  check("stop2h -> postgame", r.status === 200 && r.body.state === "postgame");
  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "start_et" });
  check("start_et -> extra_time", r.status === 200 && r.body.state === "extra_time");

  const { data: events3 } = await service
    .from("clock_events")
    .select("action, server_ts, offset_seconds")
    .eq("room_id", roomId)
    .order("server_ts", { ascending: true });
  const d3 = deriveClock(events3 as ClockEventInput[], Date.now());
  check(
    "extra time derives from 90:00",
    d3.running === true && d3.period === "ET" && d3.elapsedSeconds >= 90 * 60,
    d3.running ? formatClock(d3.elapsedSeconds) : "not running",
  );

  r = await api("/api/clock", cookies.smoke6_kev, { roomId, action: "stop_et" });
  check("stop_et -> postgame", r.status === 200 && r.body.state === "postgame");

  await sleep(1500);
  check(
    "every clock action published exactly once",
    clockEvents.length === 8,
    `${clockEvents.length} events`,
  );
  check(
    "state events accompanied the transitions",
    ["live_1h", "halftime", "live_2h", "postgame", "extra_time"].every((s) => states.includes(s)),
    states.join(","),
  );

  await api("/api/rooms", cookies.smoke6_kev, { action: "end", roomId });
  observer.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
