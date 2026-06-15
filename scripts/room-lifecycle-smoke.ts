/**
 * Regressions for audit M-5 (start/end TOCTOU), L-1 (clock transition race),
 * L-2 (wrapped room can't reopen), and M-7 (deleteBroadcastRoom helper).
 *   npm run smoke:lifecycle / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";
import { deleteBroadcastRoom } from "../lib/egress";
import { livekitRoomName, roomService } from "../lib/livekit";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "lifecycle-Pass-1!";
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
async function api(path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const EMAIL = "fancast.lc.c@example.com";
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL);
  if (u) { await service.from("rooms").delete().eq("commentator_id", u.id); await service.auth.admin.deleteUser(u.id); }
  console.log("clean done");
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const { data: created } = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookie = cookieFor(si!.session!);
  await api("/api/profile", cookie, { username: "lc_c" });
  await service.from("profiles").update({ role: "commentator" }).eq("user_id", created!.user!.id);

  const open = await api("/api/rooms", cookie, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = open.body.room.id as string;

  // M-5: two concurrent starts -> exactly one wins, at most one recording row
  const starts = await Promise.all([
    api("/api/rooms", cookie, { action: "start", roomId }),
    api("/api/rooms", cookie, { action: "start", roomId }),
  ]);
  const startOk = starts.filter((x) => x.status === 200).length;
  check("concurrent start: exactly one 200", startOk === 1, JSON.stringify(starts.map((x) => x.status)));
  check("concurrent start: the other is 409", starts.filter((x) => x.status === 409).length === 1);
  const recCount = (await service.from("recordings").select("egress_id", { count: "exact" }).eq("room_id", roomId)).count ?? 0;
  check("concurrent start: at most one recording row (no double egress)", recCount <= 1, `${recCount} rows`);
  const room1 = await service.from("rooms").select("state").eq("id", roomId).single();
  check("room is pregame after start", room1.data!.state === "pregame", room1.data!.state);

  // L-1: two concurrent start1h -> one wins, exactly one start1h clock_event
  const clocks = await Promise.all([
    api("/api/clock", cookie, { roomId, action: "start1h" }),
    api("/api/clock", cookie, { roomId, action: "start1h" }),
  ]);
  check("concurrent start1h: exactly one 200", clocks.filter((x) => x.status === 200).length === 1, JSON.stringify(clocks.map((x) => x.status)));
  const evCount = (await service.from("clock_events").select("*", { count: "exact", head: true }).eq("room_id", roomId).eq("action", "start1h")).count ?? 0;
  check("exactly one start1h clock_event (no duplicate period)", evCount === 1, `${evCount} events`);

  // M-5: two concurrent ends -> one wins
  const ends = await Promise.all([
    api("/api/rooms", cookie, { action: "end", roomId }),
    api("/api/rooms", cookie, { action: "end", roomId }),
  ]);
  check("concurrent end: exactly one 200", ends.filter((x) => x.status === 200).length === 1, JSON.stringify(ends.map((x) => x.status)));
  const room2 = await service.from("rooms").select("state").eq("id", roomId).single();
  check("room is wrapped after end", room2.data!.state === "wrapped", room2.data!.state);

  // L-2: reopening the wrapped room's fixture is a clear 409, not the dead room
  const reopen = await api("/api/rooms", cookie, { action: "open_waiting", fixtureId: FIXTURE_ID });
  check("reopen wrapped room -> 409 with clear message", reopen.status === 409 && /ended/i.test(reopen.body.error ?? ""), `${reopen.status} ${reopen.body.error}`);

  // M-7: deleteBroadcastRoom actually removes a LiveKit room (teardown primitive)
  try {
    const testId = crypto.randomUUID();
    const name = livekitRoomName(testId);
    await roomService().createRoom({ name, emptyTimeout: 60 });
    await deleteBroadcastRoom(testId);
    const rooms = await roomService().listRooms();
    check("deleteBroadcastRoom removes the LiveKit room", !rooms.some((r) => r.name === name));
  } catch (e) {
    check("deleteBroadcastRoom LiveKit teardown (needs LiveKit creds)", false, (e as Error).message);
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
