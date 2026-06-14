/** Remove all leftover smoke-test users (fancast.rec/proc/smoke*) and
 *  their rooms + storage. Usable when rtc-blocked smoke scripts can't
 *  self-clean. npm run clean:test */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  const test = (data?.users ?? []).filter((u) =>
    /^fancast\.(rec|proc|smoke|radio|echo|linkcard)/.test(u.email ?? ""),
  );
  for (const u of test) {
    const { data: rooms } = await s.from("rooms").select("id").eq("commentator_id", u.id);
    for (const r of rooms ?? []) {
      for (const b of ["radio", "recordings"]) {
        const { data: objs } = await s.storage.from(b).list(r.id);
        if (objs?.length) {
          await s.storage.from(b).remove(objs.map((o) => `${r.id}/${o.name}`));
        }
      }
    }
    await s.from("rooms").delete().eq("commentator_id", u.id);
    await s.auth.admin.deleteUser(u.id);
  }
  console.log(`removed ${test.length} test user(s)`);

  const { data: remaining } = await s
    .from("rooms")
    .select("id, state, commentator:profiles!rooms_commentator_id_fkey(username)");
  console.log("remaining rooms:", JSON.stringify(remaining));
}
main();
