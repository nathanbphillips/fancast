/**
 * Regression for audit M-1: a banned user must get NO LiveKit token (not even
 * subscribe). Verifies the token route consults bans, and that it is reversible.
 *   npm run smoke:lkban / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "lkban-Pass-1!";
const FIXTURE_ID = -1;
const USERS = [
  { email: "fancast.lk.c@example.com", username: "lk_c", role: "commentator" },
  { email: "fancast.lk.l@example.com", username: "lk_l" },
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
async function token(roomId: string, cookie?: string) {
  const res = await fetch(`${APP}/api/livekit/token?room=${roomId}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const t of USERS) {
    const u = data?.users.find((x) => x.email === t.email);
    if (u) {
      await service.from("bans").delete().eq("user_id", u.id);
      await service.from("rooms").delete().eq("commentator_id", u.id);
      await service.auth.admin.deleteUser(u.id);
    }
  }
  console.log("clean done");
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const id: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created } = await service.auth.admin.createUser({ email: t.email, password: PASSWORD, email_confirm: true });
    id[t.username] = created!.user!.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: t.email, password: PASSWORD });
    cookies[t.username] = cookieFor(si!.session!);
    await post("/api/profile", cookies[t.username], { username: t.username });
    if (t.role) await service.from("profiles").update({ role: t.role }).eq("user_id", id[t.username]);
  }

  const r = await post("/api/rooms", cookies.lk_c, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await post("/api/rooms", cookies.lk_c, { action: "start", roomId });

  // baseline: tokens issued correctly before any ban
  let t = await token(roomId, cookies.lk_c);
  check("commentator gets a publish token", t.status === 200 && t.body.canPublish === true, `${t.status} canPublish=${t.body.canPublish}`);
  t = await token(roomId, cookies.lk_l);
  check("listener gets a subscribe-only token", t.status === 200 && t.body.canPublish === false, `${t.status} canPublish=${t.body.canPublish}`);
  t = await token(roomId);
  check("anonymous gets a subscribe-only token", t.status === 200 && t.body.canPublish === false, `${t.status}`);

  // ban the listener -> no token at all
  await service.from("bans").insert({ user_id: id.lk_l, reason: "test" });
  t = await token(roomId, cookies.lk_l);
  check("banned listener gets 403 (no subscribe token)", t.status === 403, `${t.status} ${JSON.stringify(t.body)}`);

  // ban the commentator -> publish path also blocked
  await service.from("bans").insert({ user_id: id.lk_c, reason: "test" });
  t = await token(roomId, cookies.lk_c);
  check("banned commentator gets 403 (publish path blocked)", t.status === 403, `${t.status}`);

  // anonymous still unaffected by user bans
  t = await token(roomId);
  check("anonymous still gets a token while users are banned", t.status === 200, `${t.status}`);

  // unban -> tokens restored with correct caps
  await service.from("bans").delete().eq("user_id", id.lk_l);
  await service.from("bans").delete().eq("user_id", id.lk_c);
  t = await token(roomId, cookies.lk_l);
  check("unbanned listener gets a subscribe token again", t.status === 200 && t.body.canPublish === false, `${t.status} canPublish=${t.body.canPublish}`);
  t = await token(roomId, cookies.lk_c);
  check("unbanned commentator gets a publish token again", t.status === 200 && t.body.canPublish === true, `${t.status} canPublish=${t.body.canPublish}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
