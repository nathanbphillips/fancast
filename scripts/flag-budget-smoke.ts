/**
 * Regression for audit M-8: the flag budget must count ALL of a user's flags
 * in a room, not the truncated first 1000 messages. Seeds >1000 messages, then
 * proves the 10-flag/match cap fires exactly at the 11th flag.
 *   npm run smoke:flagbudget / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "flagbudget-Pass-1!";
const FIXTURE_ID = -1;
const SEED_COUNT = 1500; // > PostgREST's 1000-row default
const USERS = [
  { email: "fancast.fb.c@example.com", username: "fb_c", role: "commentator" },
  { email: "fancast.fb.spammer@example.com", username: "fb_spammer" },
  { email: "fancast.fb.flagger@example.com", username: "fb_flagger" },
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
async function api(path: string, cookie: string, body?: unknown) {
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

  const id: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created } = await service.auth.admin.createUser({ email: t.email, password: PASSWORD, email_confirm: true });
    id[t.username] = created!.user!.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: t.email, password: PASSWORD });
    cookies[t.username] = cookieFor(si!.session!);
    await api("/api/profile", cookies[t.username], { username: t.username });
    if (t.role) await service.from("profiles").update({ role: t.role }).eq("user_id", id[t.username]);
  }

  // commentator opens + starts a room so chat inputs are open
  const r = await api("/api/rooms", cookies.fb_c, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", cookies.fb_c, { action: "start", roomId });

  // seed > 1000 messages authored by the spammer (service insert bypasses rate limit)
  const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({ room_id: roomId, user_id: id.fb_spammer, body: `seed ${i}` }));
  const inserted: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await service.from("chat_messages").insert(rows.slice(i, i + 500)).select("id");
    if (error) throw error;
    inserted.push(...data!.map((m) => m.id));
  }
  check(`seeded ${SEED_COUNT} messages`, inserted.length === SEED_COUNT, `${inserted.length}`);

  // flagger flags 10 distinct messages — all should be accepted
  let accepted = 0;
  for (let i = 0; i < 10; i++) {
    const res = await api("/api/chat/flag", cookies.fb_flagger, { messageId: inserted[i * 100] });
    if (res.status === 200) accepted++;
  }
  check("first 10 flags accepted", accepted === 10, `${accepted}/10`);

  // the 11th flag must be rejected by the budget — with the old truncated
  // count it would likely slip through (flagged ids fall outside the 1000 window)
  const eleventh = await api("/api/chat/flag", cookies.fb_flagger, { messageId: inserted[1050] });
  check("11th flag rejected with 429 (budget exact past 1000 rows)", eleventh.status === 429, `${eleventh.status} ${JSON.stringify(eleventh.body)}`);

  // a different user can still flag in the same large room (count query works at scale)
  const other = await api("/api/chat/flag", cookies.fb_c, { messageId: inserted[1234] });
  check("a different user's first flag still accepted in the big room", other.status === 200, `${other.status}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
