import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";

/** Dashboard numbers. All queries run at the same time (one round trip instead of many). */
export const GET = admin(async (_req, _c, user) => {
  const ids = await accessibleWebsiteIds(user);
  const sites = ids === "all" ? [] : ids.length ? ids : ["-"];
  const siteFilter = (col: Parameters<typeof inArray>[0]) => (ids === "all" ? undefined : inArray(col, sites));
  const blogWhere = (...extra: (ReturnType<typeof eq> | undefined)[]) => and(isNull(schema.blogs.deletedAt), siteFilter(schema.blogs.websiteId), ...extra);
  const lite = { content: false } as const; const withSite = { website: { columns: { name: true } } } as const;
  const isSuper = user.role === "SUPER_ADMIN";

  const [[{ n: websites }], statusRows, [{ n: pages }], recentUpdated, recentPublished, activity, adminRows, reviewQueue, mine, userRows] = await Promise.all([
    db.select({ n: count() }).from(schema.websites).where(and(isNull(schema.websites.deletedAt), siteFilter(schema.websites.id))),
    db.select({ s: schema.blogs.status, n: count() }).from(schema.blogs).where(blogWhere()).groupBy(schema.blogs.status),
    db.select({ n: count() }).from(schema.pages).where(and(isNull(schema.pages.deletedAt), siteFilter(schema.pages.websiteId))),
    db.query.blogs.findMany({ where: blogWhere(), orderBy: desc(schema.blogs.updatedAt), limit: 5, columns: lite, with: withSite }),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.status, "PUBLISHED")), orderBy: desc(schema.blogs.publishedAt), limit: 5, columns: lite, with: withSite }),
    db.query.activityLogs.findMany({ where: ids === "all" ? undefined : inArray(schema.activityLogs.websiteId, sites), orderBy: desc(schema.activityLogs.createdAt), limit: 8, with: { user: { columns: { name: true } } } }),
    isSuper ? Promise.resolve([{ n: 1 }]) : db.select({ n: count() }).from(schema.websiteUsers).where(and(eq(schema.websiteUsers.userId, user.id), eq(schema.websiteUsers.role, "WEBSITE_ADMIN"))),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.status, "IN_REVIEW")), orderBy: desc(schema.blogs.updatedAt), limit: 8, columns: lite, with: { ...withSite, author: { columns: { name: true } } } }),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.authorId, user.id), inArray(schema.blogs.status, ["DRAFT", "IN_REVIEW"])), orderBy: desc(schema.blogs.updatedAt), limit: 16, columns: lite, with: withSite }),
    isSuper ? db.select({ active: schema.users.active, n: count() }).from(schema.users).where(isNull(schema.users.deletedAt)).groupBy(schema.users.active) : Promise.resolve([]),
  ]);
  const by = (s: string) => statusRows.find((r) => r.s === s)?.n ?? 0;
  const level: "super" | "admin" | "editor" = isSuper ? "super" : adminRows[0].n > 0 ? "admin" : "editor";
  const myDrafts = mine.filter((b) => b.status === "DRAFT").slice(0, 8), myReview = mine.filter((b) => b.status === "IN_REVIEW").slice(0, 8);
  const users = userRows.reduce((a, r) => a + r.n, 0), pendingUsers = userRows.find((r) => !r.active)?.n ?? 0;
  return json({ pendingUsers, changesRequested: myDrafts.filter((b) => b.reviewNote).map((b) => ({ id: b.id, title: b.title, reviewNote: b.reviewNote })), level, websites,
    published: by("PUBLISHED"), drafts: by("DRAFT"), review: by("IN_REVIEW"), pages, users, reviewQueue, myDrafts, myReview, recentUpdated, recentPublished, activity });
});
