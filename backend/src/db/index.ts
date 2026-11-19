import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };
const url = process.env.DATABASE_URL ?? "";
const local = /localhost|127\.0\.0\.1|host=\//.test(url);
// Serverless-friendly: few connections, short idle time (Supabase closes idle ones), clear timeout instead of hanging.
const pool = globalForDb.pool ?? new Pool({
  connectionString: url, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000,
  ssl: local ? undefined : { rejectUnauthorized: false },
});
pool.on("error", (e) => console.error("[db] idle client error:", e.message));
globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
