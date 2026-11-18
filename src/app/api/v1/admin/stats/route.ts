import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";

export const GET = admin(async (_req, _c, user) => {
  const ids = await accessibleWebsiteIds(user);
  const sites = ids === "all" ? [] : ids.length ? ids : ["-"];
  const siteFilter = (col: Parameters<typeof inArray>[0]) => (ids === "all" ? undefined : inArray(col, sites));
  const blogWhere = (...extra: (ReturnType<typeof eq> | undefined)[]) =>
    and(isNull(schema.blogs.deletedAt), siteFilter(schema.blogs.websiteId), ...extra);

  const [{ n: websites }] = await db.select({ n: count() }).from(schema.websites)
    .where(and(isNull(schema.websites.deletedAt), siteFilter(schema.websites.id)));
  const [{ n: published }] = await db.select({ n: count() }).from(schema.blogs).where(blogWhere(eq(schema.blogs.status, "PUBLISHED")));
  const [{ n: drafts }] = await db.select({ n: count() }).from(schema.blogs).where(blogWhere(eq(schema.blogs.status, "DRAFT")));
  const [{ n: review }] = await db.select({ n: count() }).from(schema.blogs).where(blogWhere(eq(schema.blogs.status, "IN_REVIEW")));
  const [{ n: pages }] = await db.select({ n: count() }).from(schema.pages).where(and(isNull(schema.pages.deletedAt), siteFilter(schema.pages.websiteId)));
  const recentUpdated = await db.query.blogs.findMany({ where: blogWhere(), orderBy: desc(schema.blogs.updatedAt), limit: 5, columns: { content: false }, with: { website: { columns: { name: true } } } });
  const recentPublished = await db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.status, "PUBLISHED")), orderBy: desc(schema.blogs.publishedAt), limit: 5, columns: { content: false }, with: { website: { columns: { name: true } } } });
  const activity = await db.query.activityLogs.findMany({ where: ids === "all" ? undefined : inArray(schema.activityLogs.websiteId, sites), orderBy: desc(schema.activityLogs.createdAt), limit: 8, with: { user: { columns: { name: true } } } });
  return json({ websites, published, drafts, review, pages, recentUpdated, recentPublished, activity });
});
