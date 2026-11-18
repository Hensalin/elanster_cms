import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json, slugify } from "@/lib/http";

export const GET = admin(async (req, _c, user) => {
  const websiteId = new URL(req.url).searchParams.get("website");
  if (!websiteId) return fail("website is required", 422);
  if (!(await websiteRole(user, websiteId))) return fail("Forbidden", 403);
  return json(await db.select().from(schema.categories).where(eq(schema.categories.websiteId, websiteId)).orderBy(asc(schema.categories.name)));
});

export const POST = admin(async (req, _c, user) => {
  const d = z.object({ websiteId: z.string(), name: z.string().min(1).max(60) }).parse(await req.json());
  if (!canEdit(await websiteRole(user, d.websiteId))) return fail("Forbidden", 403);
  const slug = slugify(d.name);
  const [dup] = await db.select().from(schema.categories).where(and(eq(schema.categories.websiteId, d.websiteId), eq(schema.categories.slug, slug)));
  if (dup) return json(dup);
  const [c] = await db.insert(schema.categories).values({ websiteId: d.websiteId, name: d.name.trim(), slug }).returning();
  return json(c, 201);
});
