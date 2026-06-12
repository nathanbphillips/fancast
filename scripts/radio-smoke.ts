/**
 * Radio/HLS end-to-end smoke test against a RUNNING dev server.
 * Opens a real room, starts the broadcast (which starts LiveKit egress
 * into Supabase storage), publishes live sine audio, and polls the public
 * HLS playlist until segments appear — the exact path radio listeners use.
 *   npm run smoke:radio / npm run smoke:radio -- clean
 */
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room as RtcRoom,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const EMAIL = "fancast.radio.kev@example.com";
const PASSWORD = "radio-Kev-1!";
const FIXTURE_ID = -2;

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function cookieFor(session: Session): string {
  return (
    `sb-${PROJECT_REF}-auth-token=base64-` +
    Buffer.from(JSON.stringify(session)).toString("base64url")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function s3(): S3Client {
  return new S3Client({
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    region: process.env.SUPABASE_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

async function cleanStorage(prefix: string) {
  const client = s3();
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: "radio", Prefix: prefix }),
  );
  for (const obj of listed.Contents ?? []) {
    await client.send(
      new DeleteObjectCommand({ Bucket: "radio", Key: obj.Key! }),
    );
  }
  if ((listed.Contents ?? []).length > 0) {
    console.log(`cleaned ${listed.Contents!.length} object(s) under ${prefix}`);
  }
}

async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL);
  if (u) {
    const { data: rooms } = await service
      .from("rooms")
      .select("id")
      .eq("commentator_id", u.id);
    for (const r of rooms ?? []) await cleanStorage(r.id);
    await service.from("rooms").delete().eq("commentator_id", u.id);
    await service.auth.admin.deleteUser(u.id);
    console.log(`removed ${EMAIL}`);
  }
  console.log("clean done");
}

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

  // commentator user + profile
  const { data: created, error } = await service.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: signedIn } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  const cookie = cookieFor(signedIn!.session!);
  await fetch(`${APP}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ username: "radio_kev" }),
  });
  await service
    .from("profiles")
    .update({ role: "commentator" })
    .eq("user_id", created.user.id);

  // open + start (start kicks off HLS egress server-side)
  let res = await fetch(`${APP}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "open_waiting", fixtureId: FIXTURE_ID }),
  });
  const roomId = (await res.json()).room.id as string;
  res = await fetch(`${APP}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "start", roomId }),
  });
  check("broadcast started", res.status === 200);

  const { data: roomRow } = await service
    .from("rooms")
    .select("hls_url, hls_egress_id")
    .eq("id", roomId)
    .single();
  check(
    "egress started and hls_url recorded",
    Boolean(roomRow?.hls_url && roomRow?.hls_egress_id),
    roomRow?.hls_url ?? "no url",
  );

  // publish live audio while polling the public playlist
  const tokenRes = await fetch(`${APP}/api/livekit/token?room=${roomId}`, {
    headers: { Cookie: cookie },
  });
  const { token, url } = await tokenRes.json();
  const rtc = new RtcRoom();
  await rtc.connect(url, token, { autoSubscribe: false, dynacast: false });
  const publishing = publishSine(rtc, 75);

  let playlist = "";
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const p = await fetch(roomRow!.hls_url!, { cache: "no-store" }).catch(
      () => null,
    );
    if (p?.ok) {
      playlist = await p.text();
      if (playlist.includes("#EXTINF")) break;
    }
    await sleep(5000);
  }
  check(
    "live HLS playlist serving with segments",
    playlist.includes("#EXTM3U") && playlist.includes("#EXTINF"),
    playlist ? `${playlist.split("\n").filter((l) => l.includes(".ts")).length} segment(s) listed` : "no playlist",
  );

  const segPath = playlist
    .split("\n")
    .find((l) => l.trim().endsWith(".ts"));
  if (segPath) {
    const segUrl = new URL(
      segPath,
      roomRow!.hls_url!.slice(0, roomRow!.hls_url!.lastIndexOf("/") + 1),
    ).toString();
    const seg = await fetch(segUrl, { cache: "no-store" });
    const bytes = seg.ok ? (await seg.arrayBuffer()).byteLength : 0;
    check("audio segment downloads", seg.ok && bytes > 1000, `${bytes} bytes`);
  } else {
    check("audio segment downloads", false, "no segment path in playlist");
  }

  await publishing;
  await rtc.disconnect();

  // end broadcast -> egress stops
  res = await fetch(`${APP}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "end", roomId }),
  });
  check("broadcast ended (egress stop requested)", res.status === 200);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
