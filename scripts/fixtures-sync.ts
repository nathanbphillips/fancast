/**
 * Manual fixture sync (FR-19.5): the same league-wide sync + no-show sweep the
 * daily cron runs, from the command line.
 *   npm run sync:fixtures
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { sweepNoShowRooms, syncFixtures } from "../lib/fixtures";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const sync = await syncFixtures(svc);
  console.log("syncFixtures:", JSON.stringify(sync));
  const sweep = await sweepNoShowRooms(svc);
  console.log("sweepNoShowRooms:", JSON.stringify(sweep));
  if (!sync.ok) process.exit(1);
}

void main();
