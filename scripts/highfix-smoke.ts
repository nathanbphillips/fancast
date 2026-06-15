/**
 * Verifies the audit HIGH fixes against a RUNNING dev server:
 *  H-3: /api/chat/hide is room-scoped (a commentator can't hide in another's room)
 *  H-1: hidden message bodies are not readable by anon/listeners via RLS
 *   npm run smoke:highfix / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "highfix-Pass-1!";
const USERS = [
  { email: "fancast.hf.a@example.com", username: "hf_a", role: "commentator" },
  { email: "fancast.hf.b@example.com", username: "hf_b", role: "commentator" },
  { email: "fancast.hf.l@example.com", username: "hf_l" },
  { email: "fancast.hf.admin@example.com", username: "hf_admin", role: "admin" },
];
const FIXTURE_ID = -1;

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
  const sessions: Record<string, Session> = {};
  for (const t of USERS) {
    const { data: created } = await service.auth.admin.createUser({ email: t.email, password: PASSWORD, email_confirm: true });
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: t.email, password: PASSWORD });
    sessions[t.username] = si!.session!;
    cookies[t.username] = cookieFor(si!.session!);
    await api("/api/profile", cookies[t.username], { username: t.username });
    if (t.role) await service.from("profiles").update({ role: t.role }).eq("user_id", created!.user!.id);
  }

  // A opens + starts a room; L posts messages
  let r = await api("/api/rooms", cookies.hf_a, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", cookies.hf_a, { action: "start", roomId });
  const send = async (who: string, text: string) =>
    (await api("/api/chat", cookies[who], { roomId, body: text })).body.message.id as string;
  const msgHiddenByA = await send("hf_l", "secret one — hidden by owner");
  const msgVisible = await send("hf_l", "this one stays visible");
  const msgHiddenByAdmin = await send("hf_l", "secret two — hidden by admin");

  // H-3: room scoping
  r = await api("/api/chat/hide", cookies.hf_l, { messageId: msgHiddenByA });
  check("listener cannot hide", r.status === 403);
  r = await api("/api/chat/hide", cookies.hf_b, { messageId: msgHiddenByA });
  check("a different commentator cannot hide in this room", r.status === 403, r.body.error);
  r = await api("/api/chat/hide", cookies.hf_a, { messageId: msgHiddenByA });
  check("room's own commentator can hide", r.status === 200);
  r = await api("/api/chat/hide", cookies.hf_admin, { messageId: msgHiddenByAdmin });
  check("admin can hide cross-room", r.status === 200);

  // H-1: RLS — hidden bodies not readable by anon / listener
  const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const anonHidden = await anonClient.from("chat_messages").select("id, body").eq("id", msgHiddenByA).maybeSingle();
  check("anon cannot read a hidden message (RLS)", anonHidden.data === null, JSON.stringify(anonHidden.data));
  const anonVisible = await anonClient.from("chat_messages").select("id, body").eq("id", msgVisible).maybeSingle();
  check("anon CAN still read a visible message", anonVisible.data?.id === msgVisible);
  const anonDump = await anonClient.from("chat_messages").select("id").not("hidden_by", "is", null);
  check("anon wholesale dump of hidden rows returns nothing", (anonDump.data?.length ?? 0) === 0, `${anonDump.data?.length} rows`);

  // listener (authed) also cannot read hidden
  const lClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  await lClient.auth.setSession({ access_token: sessions.hf_l.access_token, refresh_token: sessions.hf_l.refresh_token });
  const lHidden = await lClient.from("chat_messages").select("id").eq("id", msgHiddenByA).maybeSingle();
  check("listener cannot read a hidden message (RLS)", lHidden.data === null);

  // the room's commentator CAN read the hidden row (needs it for moderation)
  const aClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  await aClient.auth.setSession({ access_token: sessions.hf_a.access_token, refresh_token: sessions.hf_a.refresh_token });
  const aHidden = await aClient.from("chat_messages").select("id, body").eq("id", msgHiddenByA).maybeSingle();
  check("room commentator can read the hidden row", aHidden.data?.id === msgHiddenByA);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
