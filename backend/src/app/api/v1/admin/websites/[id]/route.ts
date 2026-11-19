import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { admin, fail, json, normDomain } from "@/lib/http";
import { syncPages } from "@/lib/sitescan";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ name: z.string().min(2).max(80), domain: z.string().max(200), active: z.boolean() }).partial();

export const PUT = admin<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  if (d.domain !== undefined) {
    d.domain = normDomain(d.domain);
    if (d.domain) { const [same] = await db.select().from(schema.websites).where(and(eq(schema.websites.domain, d.domain), ne(schema.websites.id, id), isNull(schema.websites.deletedAt)));
      if (same) return fail(`This address is already connected as “${same.name}”. One address = one website — remove that one first.`, 409); }
  }
  const [site] = await db.update(schema.websites).set(d).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "WEBSITE_UPDATE", entity: "website", entityId: id, summary: `Updated website ${site.name}` });
  // New address → bring in that website's pages straight away (Framer-style).
  let sync = null;
  if (d.domain && site.active) { try { sync = await syncPages(id, user.id); } catch (e) { sync = { error: (e as Error).message }; } }
  return json({ ...site, sync });
}, { superOnly: true });

export const DELETE = admin<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const [site] = await db.update(schema.websites).set({ deletedAt: new Date(), active: false }).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, action: "WEBSITE_DELETE", entity: "website", entityId: id, summary: `Removed website ${site.name}` });
  return json({ ok: true });
}, { superOnly: true });
