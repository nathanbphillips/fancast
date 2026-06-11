/**
 * Phase 4 smoke test against a RUNNING dev server (localhost:3000).
 * Full lifecycle walkthrough (the two-browser test, scripted): open
 * waiting room → commentator-only chat → Start Broadcast unlock →
 * questions → talk requests with consent + gates → slider → end.
 * An independent Ably observer asserts control/private channel delivery.
 *   npm run smoke4 / npm run smoke4 -- clean
 */
import * as Ably from "ably";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const FIXTURE_ID = -4;
const PASSWORD = "smoke4-Pass-1!";

const USERS = [
  { email: "fancast.smoke4.kev@example.com", username: "smoke4_kev", backdate: true, role: "commentator" },
  { email: "fancast.smoke4.alice@example.com", username: "smoke4_alice", backdate: true },
  { email: "fancast.smoke4.bob@example.com", username: "smoke4_bob", backdate: true },
  { email: "fancast.smoke4.fresh@example.com", username: "smoke4_fresh", backdate: false },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function cookieFor(session: Session): string {
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

async function api(path: string, cookie: string, body: unknown, method = "POST") {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
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
  const ids: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created, error } = await service.auth.admin.createUser({
      email: t.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${t.email}: ${error.message}`);
    ids[t.username] = created.user.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: signedIn } = await anon.auth.signInWithPassword({
      email: t.email,
      password: PASSWORD,
    });
    cookies[t.username] = cookieFor(signedIn!.session!);
    const r = await api("/api/profile", cookies[t.username], { username: t.username });
    if (r.status !== 201) throw new Error(`profile ${t.username}: ${JSON.stringify(r.body)}`);
    if (t.backdate) {
      await service
        .from("profiles")
        .update({ created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString() })
        .eq("user_id", created.user.id);
    }
    if (t.role) {
      await service.from("profiles").update({ role: t.role }).eq("user_id", created.user.id);
    }
  }

  // --- lifecycle: open waiting room
  let r = await api("/api/rooms", cookies.smoke4_alice, { action: "open_waiting", fixtureId: FIXTURE_ID });
  check("listener cannot open waiting room", r.status === 403);

  r = await api("/api/rooms", cookies.smoke4_kev, { action: "open_waiting", fixtureId: FIXTURE_ID });
  check("commentator opens waiting room", r.status === 201 && r.body.room?.state === "waiting");
  const roomId = r.body.room.id as string;

  // observer attaches AFTER open so it sees subsequent control events
  const observer = new Ably.Realtime({ key: process.env.ABLY_API_KEY! });
  const events: { ch: string; name: string; data: Record<string, unknown> }[] = [];
  const controlCh = observer.channels.get(`room:${roomId}:control`);
  const privCh = observer.channels.get(`room:${roomId}:private`);
  await controlCh.subscribe((m) =>
    events.push({ ch: "control", name: m.name!, data: m.data as Record<string, unknown> }),
  );
  await privCh.subscribe((m) =>
    events.push({ ch: "private", name: m.name!, data: m.data as Record<string, unknown> }),
  );

  r = await api("/api/rooms", cookies.smoke4_kev, { action: "open_waiting", fixtureId: FIXTURE_ID });
  check("re-open is idempotent", r.status === 200 && r.body.room?.id === roomId);

  // --- waiting room gates
  r = await api("/api/chat", cookies.smoke4_alice, { roomId, body: "can I talk?" });
  check("listener chat blocked in waiting", r.status === 403, r.body.error);
  r = await api("/api/chat", cookies.smoke4_kev, { roomId, body: "welcome to the waiting room" });
  check("commentator chat works in waiting", r.status === 201 && r.body.message?.is_waiting_room === true);
  r = await api("/api/questions", cookies.smoke4_alice, { roomId, body: "early question?" });
  check("questions blocked in waiting", r.status === 403);
  r = await api("/api/slider", cookies.smoke4_alice, { roomId, value: 80 });
  check("slider blocked in waiting", r.status === 403);
  r = await api("/api/links", cookies.smoke4_alice, { roomId, url: "https://example.com" });
  check("listener links blocked in waiting", r.status === 403);

  // --- start broadcast
  r = await api("/api/rooms", cookies.smoke4_alice, { action: "start", roomId });
  check("listener cannot start broadcast", r.status === 403);
  r = await api("/api/rooms", cookies.smoke4_kev, { action: "start", roomId });
  check("Start Broadcast -> pregame", r.status === 200 && r.body.room?.state === "pregame");
  r = await api("/api/rooms", cookies.smoke4_kev, { action: "start", roomId });
  check("double start rejected", r.status === 409);
  await sleep(1200);
  check(
    "state event on control channel",
    events.some((e) => e.ch === "control" && e.name === "state" && e.data.state === "pregame"),
  );

  // --- inputs unlocked
  r = await api("/api/chat", cookies.smoke4_alice, { roomId, body: "unlocked!" });
  check("listener chat unlocked after start", r.status === 201);

  // --- questions
  r = await api("/api/questions", cookies.smoke4_alice, { roomId, body: "Who starts up top?" });
  check("question submitted", r.status === 201);
  const questionId = r.body.question?.id;
  await sleep(1200);
  check(
    "question lands on private channel",
    events.some((e) => e.ch === "private" && e.name === "question"),
  );
  r = await api("/api/questions", cookies.smoke4_alice, { questionId, status: "acknowledged" }, "PATCH");
  check("author cannot ack own question", r.status === 403);
  r = await api("/api/questions", cookies.smoke4_kev, { questionId, status: "acknowledged" }, "PATCH");
  check("commentator acks question", r.status === 200);
  await sleep(1000);
  check(
    "question_update on private channel",
    events.some((e) => e.ch === "private" && e.name === "question_update"),
  );

  // --- talk request gates + consent
  r = await api("/api/talk", cookies.smoke4_fresh, { roomId, topic: "let me on", consent: true });
  check("48h account gate", r.status === 403, r.body.error);
  r = await api("/api/talk", cookies.smoke4_bob, { roomId, topic: "no messages yet", consent: true });
  check("5-message gate", r.status === 403, r.body.error);

  // alice needs 5 prior messages — seed them directly
  await service.from("chat_messages").insert(
    Array.from({ length: 4 }, (_, i) => ({
      room_id: roomId,
      user_id: ids.smoke4_alice,
      body: `seed message ${i}`,
    })),
  );
  r = await api("/api/talk", cookies.smoke4_alice, { roomId, topic: "Arteta's subs" });
  check("first request requires consent", r.status === 400 && r.body.code === "consent_required");
  r = await api("/api/talk", cookies.smoke4_alice, { roomId, topic: "Arteta's subs", consent: true });
  check("request with consent accepted", r.status === 201);
  const requestId = r.body.request?.id;
  r = await api("/api/talk", cookies.smoke4_alice, { roomId, topic: "second thoughts", consent: true });
  check("duplicate pending request rejected", r.status === 409);
  await sleep(1200);
  check(
    "talk_request on private channel",
    events.some((e) => e.ch === "private" && e.name === "talk_request"),
  );

  r = await api("/api/talk", cookies.smoke4_alice, { requestId, status: "accepted" }, "PATCH");
  check("listener cannot accept requests", r.status === 403);
  r = await api("/api/talk", cookies.smoke4_kev, { requestId, status: "dismissed" }, "PATCH");
  check("commentator dismisses request", r.status === 200);

  r = await api("/api/talk", cookies.smoke4_alice, { roomId, topic: "round two" });
  check("consent remembered on later requests", r.status === 201);
  const request2 = r.body.request?.id;
  r = await api("/api/talk", cookies.smoke4_kev, { requestId: request2, status: "accepted" }, "PATCH");
  check("commentator accepts request", r.status === 200);

  // --- slider
  r = await api("/api/slider", cookies.smoke4_alice, { roomId, value: 80 });
  check("slider vote", r.status === 200 && r.body.avg === 80 && r.body.count === 1);
  r = await api("/api/slider", cookies.smoke4_bob, { roomId, value: 20 });
  check("aggregate updates", r.status === 200 && r.body.avg === 50 && r.body.count === 2);
  await sleep(1200);
  check(
    "slider aggregate on control channel",
    events.some((e) => e.ch === "control" && e.name === "slider" && e.data.count === 2),
  );

  // --- end broadcast
  r = await api("/api/rooms", cookies.smoke4_kev, { action: "end", roomId });
  check("End Broadcast -> wrapped", r.status === 200 && r.body.room?.state === "wrapped");
  await sleep(1200);
  check(
    "wrapped state on control channel",
    events.some((e) => e.ch === "control" && e.name === "state" && e.data.state === "wrapped"),
  );
  r = await api("/api/chat", cookies.smoke4_alice, { roomId, body: "anyone still here?" });
  check("chat locked after wrap", r.status === 403);
  r = await api("/api/slider", cookies.smoke4_alice, { roomId, value: 10 });
  check("slider locked after wrap", r.status === 403);

  observer.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
