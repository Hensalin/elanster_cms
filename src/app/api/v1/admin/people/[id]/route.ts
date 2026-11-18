import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { admin, fail, json } from "@/lib/http";

const body = z.object({
  active: z.boolean().optional(), role: z.enum(["SUPER_ADMIN", "WEBSITE_ADMIN", "EDITOR"]).optional(),
  sites: z.array(z.object({ websiteId: z.string(), role: z.enum(["WEBSITE_ADMIN", "EDITOR"]) })).optional(),
});

export const PATCH = admin<{ params: Promise<{ id: string }> }>(async (req, c, me) => {
  const { id } = await c.params; const d = body.parse(await req.json());
  if (id === me.id && (d.active === false || (d.role && d.role !== "SUPER_ADMIN"))) return fail("You can't lock yourself out. Ask another Super Admin.", 400);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)); if (!u) return fail("Not found", 404);
  const set: Record<string, unknown> = {}; if (d.active !== undefined) set.active = d.active; if (d.role) set.role = d.role;
  if (Object.keys(set).length) await db.update(schema.users).set(set).where(eq(schema.users.id, id));
  if (d.sites) {
    await db.delete(schema.websiteUsers).where(eq(schema.websiteUsers.userId, id));
    if (d.sites.length) await db.insert(schema.websiteUsers).values(d.sites.map((s) => ({ userId: id, websiteId: s.websiteId, role: s.role })));
  }
  await db.insert(schema.activityLogs).values({ userId: me.id, action: "USER_UPDATE", summary: `${me.name} updated ${u.name}${d.active === true ? " (approved)" : d.active === false ? " (switched off)" : ""}` });
  return json({ ok: true });
}, { superOnly: true });

export const DELETE = admin<{ params: Promise<{ id: string }> }>(async (_r, c, me) => {
  const { id } = await c.params; if (id === me.id) return fail("You can't delete yourself.", 400);
  await db.update(schema.users).set({ deletedAt: new Date(), active: false }).where(eq(schema.users.id, id));
  return json({ ok: true });
}, { superOnly: true });
