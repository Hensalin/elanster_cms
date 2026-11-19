import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

/** ?entity=blog|page&id=...  -> newest 20 saved versions */
export const GET = admin(async (req, _c, user) => {
  const u = new URL(req.url); const entity = u.searchParams.get("entity"), id = u.searchParams.get("id");
  if ((entity !== "blog" && entity !== "page") || !id) return fail("entity and id are required", 422);
  const t = entity === "blog" ? schema.blogs : schema.pages;
  const [row] = await db.select({ websiteId: t.websiteId }).from(t).where(eq(t.id, id)); if (!row) return fail("Not found", 404);
  if (!(await websiteRole(user, row.websiteId))) return fail("Forbidden", 403);
  return json(await db.query.versions.findMany({ where: and(eq(schema.versions.entity, entity), eq(schema.versions.entityId, id)), orderBy: desc(schema.versions.createdAt), limit: 20, with: { user: { columns: { name: true } } } }));
});
