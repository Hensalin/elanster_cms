import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Counts an attempt for `key`. Returns true when the limit is reached. Stored in the database so it survives redeploys. */
export async function hit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const reset = new Date(Date.now() + windowMs);
  const r = await db.execute(sql`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, ${reset})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < now() THEN ${reset} ELSE rate_limits.reset_at END
    RETURNING count`);
  const row = (r as unknown as { rows: { count: number }[] }).rows[0];
  return Number(row?.count ?? 0) > limit;
}
export async function blocked(key: string, limit: number): Promise<boolean> {
  const r = await db.execute(sql`SELECT count FROM rate_limits WHERE key = ${key} AND reset_at > now()`);
  const row = (r as unknown as { rows: { count: number }[] }).rows[0];
  return Number(row?.count ?? 0) >= limit;
}
export async function clear(key: string) { await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`); }
// The visitor's address as set by the hosting platform (Vercel sets x-real-ip; a visitor cannot fake it).
export const ipOf = (req: Request) => (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

/** Save a copy of an article or page (keeps the newest 20). */
export async function saveVersion(entity: "blog" | "page", entityId: string, websiteId: string, userId: string, data: unknown) {
  await db.execute(sql`INSERT INTO content_versions (id, entity, entity_id, website_id, user_id, data)
    VALUES (${"v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)}, ${entity}, ${entityId}, ${websiteId}, ${userId}, ${JSON.stringify(data)}::jsonb)`);
  await db.execute(sql`DELETE FROM content_versions WHERE entity = ${entity} AND entity_id = ${entityId} AND id NOT IN (
    SELECT id FROM content_versions WHERE entity = ${entity} AND entity_id = ${entityId} ORDER BY created_at DESC LIMIT 20)`);
}
