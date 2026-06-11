/**
 * Manual role grants (PRD 2.2: commentator and admin are granted by hand).
 * Usage: npm run grant-role -- <username> <listener|commentator|admin>
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const ROLES = ["listener", "commentator", "admin"] as const;

async function main() {
  const [username, role] = process.argv.slice(2);
  if (!username || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error("usage: npm run grant-role -- <username> <listener|commentator|admin>");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("username", username)
    .select("username, role");

  if (error) {
    console.error("failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error(`no profile with username "${username}"`);
    process.exit(1);
  }
  console.log(`${data[0].username} is now ${data[0].role}`);
}

main();
