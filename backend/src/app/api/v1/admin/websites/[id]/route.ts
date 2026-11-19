import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { admin, fail, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ name: z.string().min(2).max(80), domain: z.string().max(200), active: z.boolean() }).partial();

export const PUT = admin<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  const [site] = await db.update(schema.websites).set(d).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "WEBSITE_UPDATE", entity: "website", entityId: id, summary: `Updated website ${site.name}` });
  return json(site);
}, { superOnly: true });

export const DELETE = admin<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const [site] = await db.update(schema.websites).set({ deletedAt: new Date(), active: false }).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, action: "WEBSITE_DELETE", entity: "website", entityId: id, summary: `Removed website ${site.name}` });
  return json({ ok: true });
}, { superOnly: true });
