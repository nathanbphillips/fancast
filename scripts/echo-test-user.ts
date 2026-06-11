/** Temp helper: create a test user and print its session cookie (for the
 *  sender-echo browser verification). Deleted after use. */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const email = "fancast.echo.test@example.com";

async function main() {
  if (process.argv[2] === "clean") {
    const { data: all } = await service.auth.admin.listUsers({ perPage: 1000 });
    const old = all?.users.find((u) => u.email === email);
    if (old) await service.auth.admin.deleteUser(old.id);
    console.log("cleaned");
    return;
  }
  const { data: all } = await service.auth.admin.listUsers({ perPage: 1000 });
  const old = all?.users.find((u) => u.email === email);
  if (old) await service.auth.admin.deleteUser(old.id);
  await service.auth.admin.createUser({
    email,
    password: "echo-Test-1!",
    email_confirm: true,
  });
  const { data } = await anon.auth.signInWithPassword({
    email,
    password: "echo-Test-1!",
  });
  const ref = new URL(URL_).hostname.split(".")[0];
  const value =
    "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  console.log(`sb-${ref}-auth-token`);
  console.log(value);
}

main();
