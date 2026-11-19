import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newKey } from "@/lib/apikeys";
import { admin, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = admin<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const rows = await db.select({ id: schema.apiKeys.id, label: schema.apiKeys.label, prefix: schema.apiKeys.prefix,
    active: schema.apiKeys.active, lastUsedAt: schema.apiKeys.lastUsedAt, createdAt: schema.apiKeys.createdAt })
    .from(schema.apiKeys).where(eq(schema.apiKeys.websiteId, id)).orderBy(desc(schema.apiKeys.createdAt));
  return json(rows);
}, { superOnly: true });

export const POST = admin<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { label } = z.object({ label: z.string().min(1).max(60).default("Website") }).parse(await req.json().catch(() => ({})));
  const k = newKey();
  await db.insert(schema.apiKeys).values({ websiteId: id, label, prefix: k.prefix, keyHash: k.keyHash });
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "API_KEY_CREATE", summary: `Created API key "${label}"` });
  // The full key is shown ONCE. Only its hash is stored.
  return json({ key: k.key, prefix: k.prefix }, 201);
}, { superOnly: true });
