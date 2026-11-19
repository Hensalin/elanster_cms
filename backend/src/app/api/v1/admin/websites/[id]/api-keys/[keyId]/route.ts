import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { admin, fail, json } from "@/lib/http";

export const DELETE = admin<{ params: Promise<{ id: string; keyId: string }> }>(async (_req, { params }, user) => {
  const { id, keyId } = await params;
  const [k] = await db.update(schema.apiKeys).set({ active: false })
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.websiteId, id))).returning();
  if (!k) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "API_KEY_REVOKE", summary: `Revoked API key "${k.label}"` });
  return json({ ok: true });
}, { superOnly: true });
