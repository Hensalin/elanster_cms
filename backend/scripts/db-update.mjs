// Applies SUPABASE-UPDATE.sql to the database in .env.local (safe to run more than once).
// Run: npm run db:update
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL || undefined;
const local = /localhost|127\.0\.0\.1|host=\//.test(url ?? "");
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
const sql = readFileSync(new URL("../SUPABASE-UPDATE.sql", import.meta.url), "utf8");
try {
  await client.connect();
  await client.query(sql);
  console.log("Database is up to date.");
} catch (e) {
  console.error("Database update failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
