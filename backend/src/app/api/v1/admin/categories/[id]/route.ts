import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json, slugify } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const load = async (id: string) => (await db.select().from(schema.categories).where(eq(schema.categories.id, id)))[0];
export const PATCH = admin<Ctx>(async (req, { params }, user) => {
  const c = await load((await params).id); if (!c) return fail("Not found", 404);
  if (!canPublish(await websiteRole(user, c.websiteId))) return fail("Only admins can change categories", 403);
  const d = z.object({ name: z.string().trim().min(1).max(60).optional(), color: z.enum(["", "orange", "blue", "lime", "pink"]).optional() }).parse(await req.json());
  await db.update(schema.categories).set({ ...d, ...(d.name ? { slug: slugify(d.name) } : {}) }).where(eq(schema.categories.id, c.id));
  return json({ ok: true });
});
export const DELETE = admin<Ctx>(async (_r, { params }, user) => {
  const c = await load((await params).id); if (!c) return fail("Not found", 404);
  if (!canPublish(await websiteRole(user, c.websiteId))) return fail("Only admins can delete categories", 403);
  await db.update(schema.blogs).set({ categoryId: null }).where(eq(schema.blogs.categoryId, c.id));
  await db.delete(schema.categories).where(eq(schema.categories.id, c.id));
  return json({ ok: true });
});
