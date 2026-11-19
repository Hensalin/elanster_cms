import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, fail, json, slugify } from "@/lib/http";

export const GET = admin(async (_req, _c, user) => {
  const ids = await accessibleWebsiteIds(user);
  const where = ids === "all" ? isNull(schema.websites.deletedAt)
    : and(isNull(schema.websites.deletedAt), inArray(schema.websites.id, ids.length ? ids : ["-"]));
  const sites = await db.select().from(schema.websites).where(where).orderBy(schema.websites.name);
  const counts = await db.select({ websiteId: schema.blogs.websiteId, status: schema.blogs.status, n: count() })
    .from(schema.blogs).where(isNull(schema.blogs.deletedAt)).groupBy(schema.blogs.websiteId, schema.blogs.status);
  return json(sites.map((s) => ({
    ...s,
    published: counts.find((c) => c.websiteId === s.id && c.status === "PUBLISHED")?.n ?? 0,
    drafts: counts.filter((c) => c.websiteId === s.id && c.status !== "PUBLISHED").reduce((a, c) => a + c.n, 0),
  })));
});

const body = z.object({ name: z.string().min(2).max(80), slug: z.string().max(60).optional(), domain: z.string().max(200).default("") });
export const POST = admin(async (req, _c, user) => {
  const d = body.parse(await req.json());
  const slug = slugify(d.slug || d.name);
  const [dup] = await db.select().from(schema.websites).where(eq(schema.websites.slug, slug));
  if (dup) return fail("A website with this short name already exists", 409);
  const [site] = await db.insert(schema.websites).values({ name: d.name, slug, domain: d.domain }).returning();
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: site.id, action: "WEBSITE_CREATE", entity: "website", entityId: site.id, summary: `Added website ${site.name}` });
  return json(site, 201);
}, { superOnly: true });
