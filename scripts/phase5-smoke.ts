/**
 * Phase 5 smoke test against a RUNNING dev server (localhost:3000).
 * Real audio end-to-end via @livekit/rtc-node: the commentator publishes a
 * sine wave, a listener must receive frames. Plus: role-scoped tokens,
 * publish denial for listeners, on-air elevation, Leave Air, removal +
 * permanent bar, and the 2-guest cap.
 *   npm run smoke5 / npm run smoke5 -- clean
 */
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room as RtcRoom,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const FIXTURE_ID = -3;
const PASSWORD = "smoke5-Pass-1!";

const USERS = [
  { email: "fancast.smoke5.kev@example.com", username: "smoke5_kev", role: "commentator" },
  { email: "fancast.smoke5.alice@example.com", username: "smoke5_alice" },
  { email: "fancast.smoke5.bob@example.com", username: "smoke5_bob" },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function cookieFor(session: Session): string {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

async function api(path: string, cookie: string, body?: unknown, method = "POST") {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
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

/** Publish a 440Hz sine wave for `seconds`, ~10ms frames at 48kHz mono. */
async function publishSine(room: RtcRoom, seconds: number) {
  const sampleRate = 48000;
  const source = new AudioSource(sampleRate, 1);
  const track = LocalAudioTrack.createAudioTrack("mic", source);
  await room.localParticipant!.publishTrack(
    track,
    new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE, dtx: false }),
  );
  const samplesPerFrame = 480;
  const totalFrames = Math.floor((seconds * sampleRate) / samplesPerFrame);
  let phase = 0;
  for (let i = 0; i < totalFrames; i++) {
    const data = new Int16Array(samplesPerFrame);
    for (let s = 0; s < samplesPerFrame; s++) {
      data[s] = Math.round(Math.sin(phase) * 12000);
      phase += (2 * Math.PI * 440) / sampleRate;
    }
    await source.captureFrame(
      new AudioFrame(data, sampleRate, 1, samplesPerFrame),
    );
  }
}

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
    if (error) throw new Error(`createUser: ${error.message}`);
    ids[t.username] = created.user.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: signedIn } = await anon.auth.signInWithPassword({
      email: t.email,
      password: PASSWORD,
    });
    cookies[t.username] = cookieFor(signedIn!.session!);
    await api("/api/profile", cookies[t.username], { username: t.username });
    await service
      .from("profiles")
      .update({
        created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
        ...(t.role ? { role: t.role } : {}),
      })
      .eq("user_id", created.user.id);
  }

  // room: open + start
  let r = await api("/api/rooms", cookies.smoke5_kev, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", cookies.smoke5_kev, { action: "start", roomId });

  // --- token grants
  r = await api(`/api/livekit/token?room=${roomId}`, cookies.smoke5_kev, undefined, "GET");
  check("commentator token grants publish", r.status === 200 && r.body.canPublish === true);
  const kevToken = r.body.token as string;
  const lkUrl = r.body.url as string;

  r = await api(`/api/livekit/token?room=${roomId}`, cookies.smoke5_alice, undefined, "GET");
  check("listener token is subscribe-only", r.status === 200 && r.body.canPublish === false);
  const aliceToken = r.body.token as string;

  r = await api(`/api/livekit/token?room=${roomId}`, "", undefined, "GET");
  check("anonymous gets a listener token", r.status === 200 && r.body.canPublish === false);

  // --- real audio: kev publishes sine, alice receives frames
  const kevRoom = new RtcRoom();
  await kevRoom.connect(lkUrl, kevToken, { autoSubscribe: true, dynacast: false });

  const aliceRoom = new RtcRoom();
  let framesReceived = 0;
  let energyHeard = 0;
  aliceRoom.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;
    const reader = new AudioStream(track).getReader();
    (async () => {
      while (framesReceived <= 400) {
        const { done, value: frame } = await reader.read();
        if (done || !frame) break;
        framesReceived++;
        const data = frame.data;
        for (let i = 0; i < data.length; i += 37) {
          energyHeard += Math.abs(data[i]);
        }
      }
      await reader.cancel().catch(() => {});
    })();
  });
  await aliceRoom.connect(lkUrl, aliceToken, { autoSubscribe: true, dynacast: false });

  await publishSine(kevRoom, 4);
  await sleep(1500);
  check(
    "listener receives commentator audio frames",
    framesReceived > 100,
    `${framesReceived} frames`,
  );
  check("received audio is not silence", energyHeard > 100_000, `energy ${Math.round(energyHeard)}`);

  // --- listener cannot publish with subscribe-only permissions
  let publishDenied = false;
  try {
    const src = new AudioSource(48000, 1);
    const t = LocalAudioTrack.createAudioTrack("pirate", src);
    await aliceRoom.localParticipant!.publishTrack(
      t,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );
  } catch {
    publishDenied = true;
  }
  check("listener publish attempt denied", publishDenied);

  // --- elevation: alice requests, kev accepts, fresh token grants publish
  await service.from("chat_messages").insert(
    Array.from({ length: 5 }, (_, i) => ({
      room_id: roomId,
      user_id: ids.smoke5_alice,
      body: `seed ${i}`,
    })),
  );
  r = await api("/api/talk", cookies.smoke5_alice, { roomId, topic: "elevation test", consent: true });
  const requestId = r.body.request?.id;
  r = await api("/api/talk", cookies.smoke5_kev, { requestId, status: "accepted" }, "PATCH");
  check("accept succeeds", r.status === 200);

  const { data: elevatedEvent } = await service
    .from("speaker_events")
    .select("action")
    .eq("room_id", roomId)
    .eq("user_id", ids.smoke5_alice)
    .eq("action", "elevated")
    .maybeSingle();
  check("elevation logged in speaker_events", elevatedEvent !== null);

  r = await api(`/api/livekit/token?room=${roomId}`, cookies.smoke5_alice, undefined, "GET");
  check("post-accept token grants publish", r.body.canPublish === true);
  const aliceOnAirToken = r.body.token as string;

  await aliceRoom.disconnect();
  const aliceOnAir = new RtcRoom();
  await aliceOnAir.connect(lkUrl, aliceOnAirToken, { autoSubscribe: false, dynacast: false });
  let guestPublished = false;
  try {
    await publishSine(aliceOnAir, 1);
    guestPublished = true;
  } catch {}
  check("elevated guest can publish audio", guestPublished);

  // --- Leave Air
  r = await api("/api/talk/leave", cookies.smoke5_alice, { roomId });
  check("Leave Air succeeds", r.status === 200);
  const { data: leftEvent } = await service
    .from("speaker_events")
    .select("action")
    .eq("user_id", ids.smoke5_alice)
    .eq("action", "left_air")
    .maybeSingle();
  check("left_air logged", leftEvent !== null);
  r = await api(`/api/livekit/token?room=${roomId}`, cookies.smoke5_alice, undefined, "GET");
  check("token reverts to subscribe-only after leaving", r.body.canPublish === false);

  // --- ending a call is NEUTRAL (founder decision 2026-06-11)
  await service.from("chat_messages").insert(
    Array.from({ length: 5 }, (_, i) => ({
      room_id: roomId,
      user_id: ids.smoke5_bob,
      body: `seed ${i}`,
    })),
  );
  r = await api("/api/talk", cookies.smoke5_bob, { roomId, topic: "bob's turn", consent: true });
  const bobRequest = r.body.request?.id;
  await api("/api/talk", cookies.smoke5_kev, { requestId: bobRequest, status: "accepted" }, "PATCH");
  r = await api("/api/talk/leave", cookies.smoke5_kev, { roomId, userId: ids.smoke5_bob });
  check("commentator ends guest call", r.status === 200);
  const { data: endedEvent } = await service
    .from("speaker_events")
    .select("action")
    .eq("user_id", ids.smoke5_bob)
    .eq("action", "call_ended")
    .maybeSingle();
  check("end-call logged as neutral call_ended", endedEvent !== null);
  r = await api("/api/talk", cookies.smoke5_bob, { roomId, topic: "again?", consent: true });
  check("ended caller can request again (no penalty)", r.status === 201);
  const bobRequest2 = r.body.request?.id;
  await api("/api/talk", cookies.smoke5_kev, { requestId: bobRequest2, status: "dismissed" }, "PATCH");
  r = await api("/api/talk/leave", cookies.smoke5_alice, { roomId, userId: ids.smoke5_bob });
  check("listener cannot end others' calls", r.status === 403 || r.status === 404);

  // --- caller flags (informational, commentator-only)
  r = await api("/api/callers", cookies.smoke5_alice, { action: "flag", userId: ids.smoke5_bob, note: "nope" });
  check("listener cannot flag callers", r.status === 403);
  r = await api("/api/callers", cookies.smoke5_kev, { action: "flag", userId: ids.smoke5_bob, roomId, note: "trolled on air" });
  check("commentator flags caller", r.status === 201);
  r = await api("/api/talk", cookies.smoke5_bob, { roomId, topic: "third time", consent: true });
  check(
    "new request carries the flag summary",
    r.status === 201 &&
      r.body.request?.caller_flags?.count === 1 &&
      r.body.request?.caller_flags?.notes?.[0]?.note === "trolled on air",
    JSON.stringify(r.body.request?.caller_flags),
  );
  await api("/api/talk", cookies.smoke5_kev, { requestId: r.body.request?.id, status: "dismissed" }, "PATCH");
  const { data: bobProfile } = await service
    .from("profiles")
    .select("standing, role")
    .eq("user_id", ids.smoke5_bob)
    .single();
  check("flag leaves the profile untouched", bobProfile?.standing === "good");

  // --- explicit block: reversible call-in bar, nothing else
  r = await api("/api/callers", cookies.smoke5_kev, { action: "block", userId: ids.smoke5_bob, reason: "persistent trolling" });
  check("commentator blocks caller", r.status === 201);
  r = await api("/api/talk", cookies.smoke5_bob, { roomId, topic: "blocked?", consent: true });
  check("blocked caller cannot request", r.status === 403, r.body.error);
  r = await api("/api/chat", cookies.smoke5_bob, { roomId, body: "still chatting though" });
  check("blocked caller can still chat", r.status === 201);
  r = await api("/api/callers", cookies.smoke5_kev, { action: "unblock", userId: ids.smoke5_bob });
  check("unblock works", r.status === 200);
  r = await api("/api/talk", cookies.smoke5_bob, { roomId, topic: "back again", consent: true });
  check("unblocked caller can request again", r.status === 201);
  await api("/api/talk", cookies.smoke5_kev, { requestId: r.body.request?.id, status: "dismissed" }, "PATCH");

  // --- 2-guest cap
  await service.from("talk_requests").insert([
    { room_id: roomId, user_id: ids.smoke5_alice, topic: "cap1", status: "accepted", consent_at: new Date().toISOString() },
    { room_id: roomId, user_id: ids.smoke5_bob, topic: "cap2", status: "accepted", consent_at: new Date().toISOString() },
  ]);
  const { data: thirdReq } = await service
    .from("talk_requests")
    .insert({ room_id: roomId, user_id: ids.smoke5_kev, topic: "third", status: "pending", consent_at: new Date().toISOString() })
    .select()
    .single();
  r = await api("/api/talk", cookies.smoke5_kev, { requestId: thirdReq!.id, status: "accepted" }, "PATCH");
  check("third guest rejected (2-guest cap)", r.status === 409, r.body.error);

  // --- wrapped room refuses tokens
  await api("/api/rooms", cookies.smoke5_kev, { action: "end", roomId });
  r = await api(`/api/livekit/token?room=${roomId}`, cookies.smoke5_alice, undefined, "GET");
  check("wrapped room refuses audio tokens", r.status === 403);

  await kevRoom.disconnect();
  await aliceOnAir.disconnect();

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
