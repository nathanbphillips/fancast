/**
 * Phase 3 smoke test against a RUNNING dev server (localhost:3000).
 * Simulates the two-browser acceptance session: chat, rate limit, votes,
 * weighted flag-to-hide, commentator hide, admin ban/purge, links with
 * unfurl + blocklist + ratio hiding — asserting realtime delivery via an
 * independent Ably subscriber.
 *   npm run smoke3          — run checks (cleans before, leaves data after)
 *   npm run smoke3 -- clean — remove all test data
 */
import * as Ably from "ably";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const FIXTURE_ID = -2;
const BLOCKED_DOMAIN = "blocked-test.example.com";

type TestUser = { email: string; username: string; backdate?: boolean; role?: string };
const USERS: TestUser[] = [
  { email: "fancast.smoke3.alice@example.com", username: "smoke3_alice", backdate: true },
  { email: "fancast.smoke3.bob@example.com", username: "smoke3_bob", backdate: true },
  { email: "fancast.smoke3.kev@example.com", username: "smoke3_kev", backdate: true, role: "commentator" },
  { email: "fancast.smoke3.admin@example.com", username: "smoke3_admin", backdate: true, role: "admin" },
  { email: "fancast.smoke3.f1@example.com", username: "smoke3_f1", backdate: true },
  { email: "fancast.smoke3.f2@example.com", username: "smoke3_f2", backdate: true },
  { email: "fancast.smoke3.f3@example.com", username: "smoke3_f3", backdate: true },
];
const PASSWORD = "smoke3-Pass-1!";

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
  const emails = [...USERS.map((t) => t.email), "fancast.smoke3.fresh@example.com"];
  for (const email of emails) {
    const u = data?.users.find((x) => x.email === email);
    if (u) {
      await service.from("rooms").delete().eq("commentator_id", u.id);
      await service.auth.admin.deleteUser(u.id);
      console.log(`removed ${email}`);
    }
  }
  await service.from("blocklist_domains").delete().eq("domain", BLOCKED_DOMAIN);
  console.log("clean done");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  // --- users
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  for (const t of USERS) {
    let userId: string;
    const { data: created, error } = await service.auth.admin.createUser({
      email: t.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      // leftover from an aborted run — reuse it
      const { data: all } = await service.auth.admin.listUsers({ perPage: 1000 });
      const existing = all?.users.find((x) => x.email === t.email);
      if (!existing) throw new Error(`createUser ${t.email}: ${error.message}`);
      userId = existing.id;
    } else {
      userId = created.user.id;
    }
    ids[t.username] = userId;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: signedIn } = await anon.auth.signInWithPassword({
      email: t.email,
      password: PASSWORD,
    });
    cookies[t.username] = cookieFor(signedIn!.session!);
    const r = await api("/api/profile", cookies[t.username], { username: t.username });
    if (r.status !== 201 && r.status !== 409) {
      throw new Error(`profile ${t.username}: ${JSON.stringify(r.body)}`);
    }
    if (t.backdate) {
      await service
        .from("profiles")
        .update({ created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString() })
        .eq("user_id", userId);
    }
    if (t.role) {
      await service.from("profiles").update({ role: t.role }).eq("user_id", userId);
    }
  }

  // --- room (pregame, kev commentating)
  const { data: room, error: roomErr } = await service
    .from("rooms")
    .insert({
      fixture_id: FIXTURE_ID,
      commentator_id: ids.smoke3_kev,
      state: "pregame",
      scheduled_kickoff: "2026-08-22T14:00:00Z",
    })
    .select()
    .single();
  if (roomErr) throw new Error(roomErr.message);

  // --- independent realtime observer (the "second browser")
  const observer = new Ably.Realtime({ key: process.env.ABLY_API_KEY! });
  const events: { ch: string; name: string; data: unknown }[] = [];
  const chatCh = observer.channels.get(`room:${room.id}:chat`);
  const linksCh = observer.channels.get(`room:${room.id}:links`);
  await chatCh.subscribe((m) => events.push({ ch: "chat", name: m.name!, data: m.data }));
  await linksCh.subscribe((m) => events.push({ ch: "links", name: m.name!, data: m.data }));

  // --- chat send + realtime delivery
  let r = await api("/api/chat", cookies.smoke3_alice, { roomId: room.id, body: "COYG! Who's ready?" });
  check("send message", r.status === 201);
  const aliceMsgId = r.body.message?.id;
  await sleep(1500);
  check(
    "message arrives over realtime",
    events.some((e) => e.ch === "chat" && e.name === "message"),
  );

  // --- anonymous send rejected
  r = await api("/api/chat", "", { roomId: room.id, body: "anon msg" });
  check("anonymous send rejected", r.status === 401);

  // --- rate limit: alice already sent 1; two more fine, fourth within 6s blocked
  await api("/api/chat", cookies.smoke3_alice, { roomId: room.id, body: "burst 2" });
  await api("/api/chat", cookies.smoke3_alice, { roomId: room.id, body: "burst 3" });
  r = await api("/api/chat", cookies.smoke3_alice, { roomId: room.id, body: "burst 4" });
  check("rate limit kicks in (429)", r.status === 429, r.body.error);

  // --- votes
  r = await api("/api/chat/vote", cookies.smoke3_bob, { messageId: aliceMsgId, value: 1 });
  check("upvote", r.status === 200 && r.body.up === 1);
  r = await api("/api/chat/vote", cookies.smoke3_bob, { messageId: aliceMsgId, value: -1 });
  check("vote changeable", r.status === 200 && r.body.up === 0 && r.body.down === 1);
  r = await api("/api/chat/vote", cookies.smoke3_bob, { messageId: aliceMsgId, value: 0 });
  check("vote removable", r.status === 200 && r.body.down === 0);
  await sleep(1000);
  check(
    "vote updates arrive over realtime",
    events.some((e) => e.ch === "chat" && e.name === "vote"),
  );

  // --- weighted flag-to-hide: bob posts, three established users (1.0 each) flag
  r = await api("/api/chat", cookies.smoke3_bob, { roomId: room.id, body: "something flaggable" });
  const bobMsgId = r.body.message?.id;
  r = await api("/api/chat/flag", cookies.smoke3_f1, { messageId: bobMsgId });
  check("flag 1 accepted, not hidden yet", r.status === 200 && r.body.hidden === false);
  r = await api("/api/chat/flag", cookies.smoke3_f1, { messageId: bobMsgId });
  check("duplicate flag rejected", r.status === 409);
  r = await api("/api/chat/flag", cookies.smoke3_bob, { messageId: bobMsgId });
  check("self-flag rejected", r.status === 400);
  await api("/api/chat/flag", cookies.smoke3_f2, { messageId: bobMsgId });
  r = await api("/api/chat/flag", cookies.smoke3_f3, { messageId: bobMsgId });
  check("third established flag hides (>=3.0)", r.status === 200 && r.body.hidden === true);
  const { data: hiddenMsg } = await service
    .from("chat_messages")
    .select("hidden_by, flag_weight")
    .eq("id", bobMsgId)
    .single();
  check(
    "hide logged in DB",
    hiddenMsg?.hidden_by === "flags" && Number(hiddenMsg?.flag_weight) === 3.0,
    JSON.stringify(hiddenMsg),
  );
  await sleep(1000);
  check(
    "hide arrives over realtime",
    events.some((e) => e.ch === "chat" && e.name === "hide"),
  );

  // --- fresh account flags at 0.5
  const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: freshUser } = await service.auth.admin.createUser({
    email: "fancast.smoke3.fresh@example.com",
    password: PASSWORD,
    email_confirm: true,
  });
  const { data: freshSession } = await anonClient.auth.signInWithPassword({
    email: "fancast.smoke3.fresh@example.com",
    password: PASSWORD,
  });
  const freshCookie = cookieFor(freshSession!.session!);
  await api("/api/profile", freshCookie, { username: "smoke3_fresh" });
  r = await api("/api/chat", cookies.smoke3_kev, { roomId: room.id, body: "kev checking in" });
  const kevMsgId = r.body.message?.id;
  await api("/api/chat/flag", freshCookie, { messageId: kevMsgId });
  const { data: kevMsg } = await service
    .from("chat_messages")
    .select("flag_weight")
    .eq("id", kevMsgId)
    .single();
  check("new account flag weighs 0.5", Number(kevMsg?.flag_weight) === 0.5);

  // --- commentator instant hide
  r = await api("/api/chat", cookies.smoke3_alice, { roomId: room.id, body: "hide me, kev" });
  const hideTargetId = r.body.message?.id;
  r = await api("/api/chat/hide", cookies.smoke3_kev, { messageId: hideTargetId });
  check("commentator instant-hide", r.status === 200);
  r = await api("/api/chat/hide", cookies.smoke3_alice, { messageId: hideTargetId });
  check("listener cannot hide", r.status === 403);

  // --- admin ban + purge
  r = await api("/api/admin/ban", cookies.smoke3_admin, { userId: ids.smoke3_bob, reason: "test" });
  check("admin ban", r.status === 200);
  r = await api("/api/chat", cookies.smoke3_bob, { roomId: room.id, body: "banned user msg" });
  check("banned user cannot post", r.status === 403);
  r = await api("/api/admin/ban", cookies.smoke3_alice, { userId: ids.smoke3_bob }, "DELETE");
  check("non-admin cannot unban", r.status === 403);
  r = await api("/api/admin/purge", cookies.smoke3_admin, { userId: ids.smoke3_alice, roomId: room.id });
  check("admin purge hides messages", r.status === 200 && r.body.purged >= 1, `purged ${r.body.purged}`);

  // --- links: unfurl
  r = await api("/api/links", cookies.smoke3_f1, {
    roomId: room.id,
    url: "https://www.theguardian.com/football",
  });
  check("link submitted", r.status === 201, r.body.error ?? "");
  const linkId = r.body.link?.id;
  check("unfurl produced a title", typeof r.body.link?.og_title === "string" && r.body.link.og_title.length > 0, r.body.link?.og_title);
  await sleep(1000);
  check(
    "link arrives over realtime",
    events.some((e) => e.ch === "links" && e.name === "link"),
  );

  // --- blocklist
  r = await api("/api/admin/blocklist", cookies.smoke3_admin, { domain: BLOCKED_DOMAIN, reason: "test" });
  check("admin adds blocklist domain", r.status === 201);
  r = await api("/api/links", cookies.smoke3_f1, { roomId: room.id, url: `https://${BLOCKED_DOMAIN}/stream` });
  check("blocklisted domain rejected", r.status === 422, r.body.error);
  r = await api("/api/links", cookies.smoke3_f1, { roomId: room.id, url: `https://sub.${BLOCKED_DOMAIN}/x` });
  check("blocklisted subdomain rejected", r.status === 422);

  // --- link ratio hiding: 5 downvotes, 0 up → hidden
  // note: bob is banned by this point, so he can't be one of the five voters
  for (const u of ["smoke3_alice", "smoke3_kev", "smoke3_f1", "smoke3_f2", "smoke3_f3"]) {
    r = await api("/api/links/vote", cookies[u], { linkId, value: -1 });
  }
  check("link hidden at 2:1 with >=5 votes", r.body.hidden === true, JSON.stringify(r.body));

  // --- anonymous ably token is scoped
  const tokenRes = await fetch(`${APP}/api/ably/token?room=${room.id}`);
  const token = await tokenRes.json();
  const cap = JSON.parse(token.capability ?? "{}");
  check(
    "anon token: subscribe-only chat capability",
    tokenRes.status === 200 &&
      JSON.stringify([...(cap[`room:${room.id}:chat`] ?? [])].sort()) ===
        JSON.stringify(["history", "presence", "subscribe"]) &&
      !Object.keys(cap).some((k) => k.includes("private")),
    JSON.stringify(cap),
  );

  observer.close();
  // remove the fresh user created mid-test
  if (freshUser?.user) {
    await service.auth.admin.deleteUser(freshUser.user.id);
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
