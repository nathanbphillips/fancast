/**
 * Regressions for audit M-6 (two-guest cap is atomic) and M-10 (talk_resolved
 * re-enables the requester's button).
 *  - 3 concurrent accepts on a 2-slot room -> exactly 2 accepted, never 3
 *  - dismissing a request publishes talk_resolved on CONTROL with userId+
 *    requestId but NOT status (FR-4.2 privacy)
 *   npm run smoke:talkcap / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import * as Ably from "ably";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "talkcap-Pass-1!";
const FIXTURE_ID = -1;
const CALLERS = 3;

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function cookieFor(s: Session) {
  return `sb-${PROJECT_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
}
async function api(path: string, cookie: string, body?: unknown, method = "POST") {
  const res = await fetch(`${APP}${path}`, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const callerEmails = Array.from({ length: CALLERS }, (_, i) => `fancast.tc.${i}@example.com`);
const ALL_EMAILS = [...callerEmails, "fancast.tc.c@example.com"];
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const email of ALL_EMAILS) {
    const u = data?.users.find((x) => x.email === email);
    if (u) { await service.from("rooms").delete().eq("commentator_id", u.id); await service.auth.admin.deleteUser(u.id); }
  }
  console.log("clean done");
}
async function makeUser(email: string, username: string, role?: string) {
  const { data: created } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  const cookie = cookieFor(si!.session!);
  await api("/api/profile", cookie, { username });
  if (role) await service.from("profiles").update({ role }).eq("user_id", created!.user!.id);
  return { id: created!.user!.id, cookie };
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const commentator = await makeUser("fancast.tc.c@example.com", "tc_c", "commentator");
  const callers = [];
  for (let i = 0; i < CALLERS; i++) callers.push(await makeUser(callerEmails[i], `tc_v${i}`));

  const r = await api("/api/rooms", commentator.cookie, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", commentator.cookie, { action: "start", roomId });

  // make every caller eligible: 72h-old account + 5 prior messages
  for (const c of callers) {
    await service.from("profiles").update({ created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString() }).eq("user_id", c.id);
    await service.from("chat_messages").insert(Array.from({ length: 5 }, (_, j) => ({ room_id: roomId, user_id: c.id, body: `warmup ${j}` })));
  }

  // each caller submits a pending request
  const requestIds: string[] = [];
  for (const c of callers) {
    const res = await api("/api/talk", c.cookie, { roomId, topic: "hi", consent: true });
    requestIds.push(res.body.request?.id);
  }
  check("three pending requests created", requestIds.every(Boolean), JSON.stringify(requestIds));

  // Ably observer on the control channel (M-10 publishes here)
  const observer = new Ably.Realtime({ key: process.env.ABLY_API_KEY! });
  const events: { name: string; data: Record<string, unknown> }[] = [];
  const controlCh = observer.channels.get(`room:${roomId}:control`);
  await controlCh.subscribe((m) => events.push({ name: m.name!, data: m.data as Record<string, unknown> }));

  // 3 concurrent accepts on a 2-slot room
  const results = await Promise.all(
    requestIds.map((id) => api("/api/talk", commentator.cookie, { requestId: id, status: "accepted" }, "PATCH")),
  );
  const ok = results.filter((x) => x.status === 200).length;
  const capFull = results.filter((x) => x.status === 409).length;
  check("exactly 2 accepts succeed (200)", ok === 2, `${ok} ok`);
  check("the 3rd is rejected cap_full (409)", capFull === 1, `${capFull} rejected, msg=${results.find((x) => x.status === 409)?.body?.error}`);
  const { count: acceptedCount } = await service
    .from("talk_requests").select("*", { count: "exact", head: true })
    .eq("room_id", roomId).eq("status", "accepted");
  check("DB has exactly 2 accepted (never 3)", acceptedCount === 2, `${acceptedCount}`);

  // dismiss the still-pending one -> talk_resolved on control, userId+requestId, no status
  const pending = await service.from("talk_requests").select("id, user_id").eq("room_id", roomId).eq("status", "pending").maybeSingle();
  if (pending.data) {
    await api("/api/talk", commentator.cookie, { requestId: pending.data.id, status: "dismissed" }, "PATCH");
    await new Promise((res) => setTimeout(res, 700));
    const resolved = events.find((e) => e.name === "talk_resolved" && e.data.requestId === pending.data!.id);
    check("talk_resolved published on control after dismiss", !!resolved, JSON.stringify(events.map((e) => e.name)));
    check("talk_resolved carries userId + requestId", !!resolved && resolved.data.userId === pending.data.user_id && !!resolved.data.requestId);
    check("talk_resolved does NOT leak status (privacy)", !!resolved && !("status" in resolved.data), JSON.stringify(resolved?.data));
  } else {
    check("a pending request remained to dismiss", false);
  }

  observer.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
