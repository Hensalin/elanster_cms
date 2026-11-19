import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");
export function newKey() {
  const key = "ek_live_" + randomBytes(24).toString("hex");
  return { key, prefix: key.slice(0, 12), keyHash: hashKey(key) };
}

/** Find the website a public request is allowed to read, from its API key. */
export async function websiteFromKey(req: Request) {
  const raw = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;
  const [row] = await db.select({ key: schema.apiKeys, site: schema.websites })
    .from(schema.apiKeys).innerJoin(schema.websites, eq(schema.websites.id, schema.apiKeys.websiteId))
    .where(and(eq(schema.apiKeys.keyHash, hashKey(raw)), eq(schema.apiKeys.active, true),
      eq(schema.websites.active, true), isNull(schema.websites.deletedAt)));
  if (!row) return null;
  // Awaited: on Vercel an unfinished update can be dropped after the response, so "last used" would never change.
  await db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, row.key.id)).catch(() => {});
  return row.site;
}
