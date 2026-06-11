/** Temp helper: reset the smoke4 room to `waiting` and print session
 *  cookies for kev (commentator) + alice (listener) for browser checks. */
import * as Ably from "ably";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "smoke4-Pass-1!";

function cookieFor(session: Session): string {
  return (
    `sb-${PROJECT_REF}-auth-token=base64-` +
    Buffer.from(JSON.stringify(session)).toString("base64url")
  );
}

async function main() {
  const { data: room } = await service
    .from("rooms")
    .update({ state: "waiting", started_at: null, ended_at: null })
    .eq("fixture_id", -4)
    .select("id")
    .single();
  // publish like the API does — DB first, then the control event — so
  // rewind subscribers see the reset too
  const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  await rest.channels.get(`room:${room!.id}:control`).publish("state", {
    state: "waiting",
    ts: new Date().toISOString(),
  });
  console.log(`ROOM=${room!.id}`);

  for (const who of ["kev", "alice"]) {
    const { data } = await anon.auth.signInWithPassword({
      email: `fancast.smoke4.${who}@example.com`,
      password: PASSWORD,
    });
    console.log(`${who.toUpperCase()}_COOKIE=${cookieFor(data!.session!)}`);
  }
}

main();
