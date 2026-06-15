/**
 * Verifies the atomic-aggregate RPCs (migration 0012) are callable ONLY by
 * service_role — not anon/authenticated (audit M-3 security boundary).
 *   npm run check:grants
 */
import { Client } from "pg";
import "dotenv/config";

const FUNCS = [
  "public.cast_message_vote(uuid,uuid,smallint)",
  "public.cast_link_vote(uuid,uuid,smallint)",
  "public.cast_message_flag(uuid,uuid,numeric)",
  "public.accept_talk_request(uuid)",
];

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error("SUPABASE_DB_URL not set"); process.exit(1); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let failures = 0;
  try {
    for (const fn of FUNCS) {
      for (const role of ["anon", "authenticated"]) {
        const { rows } = await client.query(`select has_function_privilege($1, $2, 'execute') as can`, [role, fn]);
        const can = rows[0].can as boolean;
        console.log(`${!can ? "PASS" : "FAIL"}  ${role} cannot execute ${fn}`);
        if (can) failures++;
      }
      const { rows: sr } = await client.query(`select has_function_privilege('service_role', $1, 'execute') as can`, [fn]);
      console.log(`${sr[0].can ? "PASS" : "FAIL"}  service_role CAN execute ${fn}`);
      if (!sr[0].can) failures++;
    }
  } finally {
    await client.end();
  }
  console.log(failures === 0 ? "\nALL GRANT CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
