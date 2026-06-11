/**
 * Minimal forward-only migration runner.
 * Applies db/migrations/*.sql in filename order, each in a transaction,
 * tracking applied files in public.schema_migrations.
 *
 * Usage: npm run migrate
 * Requires SUPABASE_DB_URL in .env.local (session pooler; not needed by the app).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import "dotenv/config";

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is not set (see .env.example).");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(
      `create table if not exists public.schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    const applied = new Set(
      (await client.query("select name from public.schema_migrations")).rows.map(
        (r: { name: string }) => r.name,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`applying ${file} ...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (name) values ($1)",
          [file],
        );
        await client.query("commit");
        ran++;
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
    console.log(ran === 0 ? "nothing to apply — up to date" : `applied ${ran} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err.message ?? err);
  process.exit(1);
});
