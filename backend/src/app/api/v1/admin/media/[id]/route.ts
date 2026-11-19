import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

async function mine(id: string, user: Parameters<typeof websiteRole>[0]) {
  const [m] = await db.select({ id: schema.media.id, websiteId: schema.media.websiteId }).from(schema.media).where(eq(schema.media.id, id));
  if (!m) return { err: fail("Not found", 404) };
  if (!canEdit(await websiteRole(user, m.websiteId))) return { err: fail("Forbidden", 403) };
  return { m };
}
export const PUT = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params; const r = await mine(id, user); if (r.err) return r.err;
  const { altText } = z.object({ altText: z.string().max(300) }).parse(await req.json());
  await db.update(schema.media).set({ altText }).where(eq(schema.media.id, id)); return json({ ok: true });
});
export const DELETE = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const { id } = await params; const r = await mine(id, user); if (r.err) return r.err;
  await db.update(schema.media).set({ deletedAt: new Date() }).where(eq(schema.media.id, id)); return json({ ok: true });
});
