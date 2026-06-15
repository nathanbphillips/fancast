/**
 * Regression for audit M-3: denormalized vote/flag aggregates must equal the
 * authoritative vote rows even under concurrent writes. The old
 * read-modify-write drifted; the atomic RPCs (migration 0012) must not.
 *   npm run smoke:votes / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "votes-Pass-1!";
const FIXTURE_ID = -1;
const N = 8;

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
const emails = (n: number) => Array.from({ length: n }, (_, i) => `fancast.vote.${i}@example.com`);
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const email of [...emails(N), "fancast.vote.c@example.com"]) {
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
  return cookie;
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const commentator = await makeUser("fancast.vote.c@example.com", "vote_c", "commentator");
  const voters: string[] = [];
  for (let i = 0; i < N; i++) voters.push(await makeUser(emails(N)[i], `vote_v${i}`));

  const r = await api("/api/rooms", commentator, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", commentator, { action: "start", roomId });

  // a message to vote on (authored by the commentator)
  const msg = await api("/api/chat", commentator, { roomId, body: "vote on me" });
  const messageId = msg.body.message.id as string;

  // N voters upvote the SAME message concurrently
  await Promise.all(voters.map((c) => api("/api/chat/vote", c, { messageId, value: 1 })));
  let agg = await service.from("chat_messages").select("up_count, down_count").eq("id", messageId).single();
  let rows = await service.from("message_votes").select("value").eq("message_id", messageId);
  let rowUp = (rows.data ?? []).filter((v) => v.value === 1).length;
  check("concurrent upvotes: up_count matches vote rows (no drift)", agg.data!.up_count === rowUp && rowUp === N, `up_count=${agg.data!.up_count} rows=${rowUp}`);

  // all N flip to downvote concurrently
  await Promise.all(voters.map((c) => api("/api/chat/vote", c, { messageId, value: -1 })));
  agg = await service.from("chat_messages").select("up_count, down_count").eq("id", messageId).single();
  rows = await service.from("message_votes").select("value").eq("message_id", messageId);
  rowUp = (rows.data ?? []).filter((v) => v.value === 1).length;
  const rowDown = (rows.data ?? []).filter((v) => v.value === -1).length;
  check("concurrent flip: counts match rows", agg.data!.up_count === rowUp && agg.data!.down_count === rowDown && rowUp === 0 && rowDown === N, `up=${agg.data!.up_count} down=${agg.data!.down_count}`);

  // link vote: 6 down + 1 up concurrently -> hidden (down>2*up && total>=5)
  const linkRes = await api("/api/links", commentator, { roomId, url: "https://www.bbc.co.uk/sport/football" });
  const linkId = linkRes.body.link?.id as string;
  if (!linkId) {
    check("link submitted for vote test", false, JSON.stringify(linkRes.body));
  } else {
    await Promise.all(voters.slice(0, 7).map((c, i) => api("/api/links/vote", c, { linkId, value: i === 0 ? 1 : -1 })));
    const lagg = await service.from("links").select("up_count, down_count, hidden").eq("id", linkId).single();
    const lrows = await service.from("link_votes").select("value").eq("link_id", linkId);
    const lUp = (lrows.data ?? []).filter((v) => v.value === 1).length;
    const lDown = (lrows.data ?? []).filter((v) => v.value === -1).length;
    const expectHidden = lDown > 2 * lUp && lUp + lDown >= 5;
    check("link counts match rows under concurrency", lagg.data!.up_count === lUp && lagg.data!.down_count === lDown, `up=${lagg.data!.up_count}/${lUp} down=${lagg.data!.down_count}/${lDown}`);
    check("link hidden flag matches recomputed threshold", lagg.data!.hidden === expectHidden, `hidden=${lagg.data!.hidden} expect=${expectHidden}`);
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
