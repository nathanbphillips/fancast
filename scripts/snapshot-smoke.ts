/**
 * Verifies the reconnect snapshot endpoint (audit M-4):
 *  - returns the reconcilable slice (state, clockEvents, sliderAgg, features)
 *  - moderator-only fields (questions, talkRequests) ONLY for the room
 *    commentator/admin — empty for anon and non-moderator listeners
 *   npm run smoke:snapshot / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "snap-Pass-1!";
const FIXTURE_ID = -1;
const USERS = [
  { email: "fancast.snap.c@example.com", username: "snap_c", role: "commentator" },
  { email: "fancast.snap.l@example.com", username: "snap_l" },
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
async function snapshot(roomId: string, cookie?: string) {
  const res = await fetch(`${APP}/api/rooms/${roomId}/snapshot`, { headers: cookie ? { Cookie: cookie } : {} });
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

  const cookies: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created } = await service.auth.admin.createUser({ email: t.email, password: PASSWORD, email_confirm: true });
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: t.email, password: PASSWORD });
    cookies[t.username] = cookieFor(si!.session!);
    await post("/api/profile", cookies[t.username], { username: t.username });
    if (t.role) await service.from("profiles").update({ role: t.role }).eq("user_id", created!.user!.id);
  }

  const r = await post("/api/rooms", cookies.snap_c, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await post("/api/rooms", cookies.snap_c, { action: "start", roomId });   // -> pregame
  await post("/api/clock", cookies.snap_c, { roomId, action: "start1h" }); // -> live_1h + clock_event
  await post("/api/slider", cookies.snap_l, { roomId, value: 80 });        // non-default aggregate
  await post("/api/questions", cookies.snap_l, { roomId, body: "snapshot question?" });

  // commentator (moderator) sees everything
  let s = await snapshot(roomId, cookies.snap_c);
  check("commentator snapshot 200", s.status === 200, `${s.status}`);
  check("state reflects live_1h", s.body.state === "live_1h", s.body.state);
  check("clockEvents includes start1h", Array.isArray(s.body.clockEvents) && s.body.clockEvents.some((e: { action: string }) => e.action === "start1h"));
  check("sliderAgg reflects the vote", s.body.sliderAgg?.count === 1 && s.body.sliderAgg?.avg === 80, JSON.stringify(s.body.sliderAgg));
  check("moderator sees questions", Array.isArray(s.body.questions) && s.body.questions.length === 1);
  check("talkRequests is an array (moderator field present)", Array.isArray(s.body.talkRequests));

  // anonymous: public slice yes, moderator fields empty
  s = await snapshot(roomId);
  check("anon snapshot 200", s.status === 200, `${s.status}`);
  check("anon sees state + clockEvents + sliderAgg", s.body.state === "live_1h" && Array.isArray(s.body.clockEvents) && !!s.body.sliderAgg);
  check("anon does NOT see questions", Array.isArray(s.body.questions) && s.body.questions.length === 0, `${s.body.questions?.length}`);
  check("anon does NOT see talkRequests", Array.isArray(s.body.talkRequests) && s.body.talkRequests.length === 0);

  // non-moderator listener: same redaction
  s = await snapshot(roomId, cookies.snap_l);
  check("listener does NOT see questions", Array.isArray(s.body.questions) && s.body.questions.length === 0);

  // bad inputs
  check("invalid room id -> 400", (await snapshot("not-a-uuid")).status === 400);
  check("unknown room -> 404", (await snapshot("00000000-0000-4000-8000-000000000000")).status === 404);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
