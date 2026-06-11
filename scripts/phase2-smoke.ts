/**
 * Phase 2 smoke test against a RUNNING dev server (localhost:3000).
 * Creates two throwaway users, exercises the real API routes with real
 * session cookies, prints PASS/FAIL per check. Pair with cleanup:
 *   npm run smoke          — create test data + run checks (leaves data for visual check)
 *   npm run smoke -- clean — remove all test data
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];

const TEST_USERS = [
  { email: "fancast.smoke.alice@example.com", password: "smoke-Alice-1!", username: "smoke_alice" },
  { email: "fancast.smoke.kev@example.com", password: "smoke-Kev-1!", username: "smoke_kev" },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Session → the cookie header @supabase/ssr expects (with chunking). */
function sessionCookie(session: Session): string {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${PROJECT_REF}-auth-token`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return parts.join("; ");
}

async function findUserId(email: string): Promise<string | null> {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((u) => u.email === email)?.id ?? null;
}

async function clean() {
  for (const t of TEST_USERS) {
    const id = await findUserId(t.email);
    if (id) {
      await service.from("rooms").delete().eq("commentator_id", id);
      await service.auth.admin.deleteUser(id); // profiles/follows cascade
      console.log(`removed ${t.email}`);
    }
  }
  console.log("clean done");
}

async function api(path: string, method: string, cookie: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  if (process.argv[2] === "clean") return clean();

  await clean(); // idempotent start

  // --- create users + sessions
  const sessions: Session[] = [];
  for (const t of TEST_USERS) {
    const { error } = await service.auth.admin.createUser({
      email: t.email,
      password: t.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${t.email}: ${error.message}`);
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data, error: signInErr } = await anon.auth.signInWithPassword({
      email: t.email,
      password: t.password,
    });
    if (signInErr || !data.session) throw new Error(`signIn ${t.email}: ${signInErr?.message}`);
    sessions.push(data.session);
  }
  const [alice, kev] = sessions;
  const aliceCookie = sessionCookie(alice);
  const kevCookie = sessionCookie(kev);

  // --- profile creation via the real route
  let r = await api("/api/profile", "POST", aliceCookie, { username: TEST_USERS[0].username });
  check("create profile (alice)", r.status === 201, JSON.stringify(r.body));

  r = await api("/api/profile", "POST", aliceCookie, { username: "other_name" });
  check("second profile rejected", r.status === 409);

  r = await api("/api/profile", "POST", kevCookie, { username: TEST_USERS[0].username });
  check("duplicate username rejected", r.status === 409);

  r = await api("/api/profile", "POST", kevCookie, { username: "bad name!" });
  check("invalid username rejected", r.status === 400);

  r = await api("/api/profile", "POST", kevCookie, { username: TEST_USERS[1].username });
  check("create profile (kev)", r.status === 201);

  r = await api("/api/profile", "POST", "", { username: "anon_hacker" });
  check("anonymous profile create rejected", r.status === 401);

  // --- username change + 30-day lock
  r = await api("/api/profile", "PATCH", aliceCookie, { username: "smoke_alice2" });
  check("first username change allowed", r.status === 200);

  r = await api("/api/profile", "PATCH", aliceCookie, { username: "smoke_alice3" });
  check("second change within 30 days blocked", r.status === 403, r.body.error);

  // --- theme pref
  r = await api("/api/profile", "PATCH", aliceCookie, { theme_pref: "light" });
  check("theme pref saved", r.status === 200 && r.body.profile.theme_pref === "light");

  // --- follows
  r = await api("/api/follow", "POST", aliceCookie, { commentatorId: kev.user.id });
  check("follow non-commentator rejected", r.status === 400);

  await service.from("profiles").update({ role: "commentator" }).eq("user_id", kev.user.id);

  r = await api("/api/follow", "POST", aliceCookie, { commentatorId: kev.user.id });
  check("follow commentator", r.status === 201);

  const { count: c1 } = await service
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("commentator_id", kev.user.id);
  check("follower count is 1", c1 === 1);

  r = await api("/api/follow", "DELETE", aliceCookie, { commentatorId: kev.user.id });
  check("unfollow", r.status === 200);
  const { count: c0 } = await service
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("commentator_id", kev.user.id);
  check("follower count is 0", c0 === 0);

  // re-follow + a waiting room for the visual pass
  await api("/api/follow", "POST", aliceCookie, { commentatorId: kev.user.id });
  const { data: room, error: roomErr } = await service
    .from("rooms")
    .insert({
      fixture_id: -1,
      commentator_id: kev.user.id,
      state: "waiting",
      scheduled_kickoff: "2026-08-15T16:30:00Z",
    })
    .select()
    .single();
  check("room created (waiting)", !roomErr && room !== null, roomErr?.message);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
