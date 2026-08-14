/** Re-run recording processing on production for a given room id. */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const BASE = "https://arseradio.com";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const REF = new URL(SUPA_URL).hostname.split(".")[0];
const EMAIL = "arseradio.reprocess.probe@example.com";
const PW = `Rp-${randomBytes(24).toString("base64url")}-1!`;
const USERNAME = "reprocess_probe";
const ROOMS = process.argv.slice(2);

const service = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  if (!ROOMS.length) throw new Error("pass one or more room ids");

  const prior = (await service.auth.admin.listUsers({ perPage: 200 })).data?.users.find(
    (u) => u.email === EMAIL,
  );
  if (prior) await service.auth.admin.deleteUser(prior.id);
  const { data: made } = await service.auth.admin.createUser({
    email: EMAIL,
    password: PW,
    email_confirm: true,
  });
  const uid = made!.user!.id;
  try {
    await service.from("profiles").insert({ user_id: uid, username: USERNAME, role: "admin" });
    const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: EMAIL, password: PW });
    const cookie =
      `sb-${REF}-auth-token=base64-` + Buffer.from(JSON.stringify(si!.session)).toString("base64url");

    for (const roomId of ROOMS) {
      console.log(`\n=== ${roomId} ===`);
      const before = await service
        .from("recordings").select("status, error, full_mp3_path").eq("room_id", roomId).maybeSingle();
      console.log("  before:", JSON.stringify(before.data));

      const res = await fetch(`${BASE}/api/recordings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ action: "process", roomId }),
      });
      console.log(`  POST process -> HTTP ${res.status}`, (await res.text()).slice(0, 200));

      // processing runs in after(); poll the row
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        const { data } = await service
          .from("recordings")
          .select("status, error, duration_seconds, full_mp3_path, zip_path")
          .eq("room_id", roomId)
          .maybeSingle<{ status: string; error: string | null; duration_seconds: number | null; full_mp3_path: string | null; zip_path: string | null }>();
        process.stdout.write(`  [${i * 6}s] ${data?.status}${data?.error ? " err=" + data.error : ""}\r`);
        if (data && data.status !== "processing") {
          console.log(`\n  AFTER: status=${data.status} error=${data.error ?? "-"} duration=${data.duration_seconds ?? "?"}s`);
          console.log(`         full_mp3=${data.full_mp3_path ?? "-"}  zip=${data.zip_path ?? "-"}`);
          const { data: segs } = await service
            .from("recording_segments").select("idx,label,bytes,storage_path").eq("recording_id", (await service.from("recordings").select("id").eq("room_id", roomId).maybeSingle()).data!.id as string).order("idx");
          for (const s of segs ?? []) {
            console.log(`         seg #${s.idx} ${s.label} ${(Number(s.bytes) / 1024 / 1024).toFixed(2)} MB`);
          }
          const { data: objs } = await service.storage.from("recordings").list(roomId, { limit: 50 });
          for (const o of objs ?? []) {
            const size = (o.metadata as { size?: number } | null)?.size ?? 0;
            console.log(`         storage ${(size / 1024 / 1024).toFixed(2)} MB  ${o.name}`);
          }
          break;
        }
      }
    }
  } finally {
    await service.auth.admin.deleteUser(uid);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
