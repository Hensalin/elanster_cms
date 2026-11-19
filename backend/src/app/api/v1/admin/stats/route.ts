import { and, count, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds, focusIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";
import { hasUnpublished, readContent } from "@/lib/pagecontent";

/** Dashboard numbers. All queries run at the same time (one round trip instead of many). */
export const GET = admin(async (req, _c, user) => {
  // Every number is limited to the websites this person can see, or to the one chosen at the top (?website=ID).
  const sites = focusIds(await accessibleWebsiteIds(user), req); const focused = new URL(req.url).searchParams.has("website");
  const siteFilter = (col: Parameters<typeof inArray>[0]) => inArray(col, sites);
  const blogWhere = (...extra: (ReturnType<typeof eq> | undefined)[]) => and(isNull(schema.blogs.deletedAt), siteFilter(schema.blogs.websiteId), ...extra);
  const lite = { content: false } as const; const withSite = { website: { columns: { name: true } } } as const;
  const isSuper = user.role === "SUPER_ADMIN";

  const [[{ n: websites }], statusRows, [{ n: pages }], recentUpdated, recentPublished, activity, adminRows, reviewQueue, mine, userRows] = await Promise.all([
    db.select({ n: count() }).from(schema.websites).where(and(isNull(schema.websites.deletedAt), siteFilter(schema.websites.id))),
    db.select({ s: schema.blogs.status, n: count() }).from(schema.blogs).where(blogWhere()).groupBy(schema.blogs.status),
    db.select({ n: count() }).from(schema.pages).where(and(isNull(schema.pages.deletedAt), siteFilter(schema.pages.websiteId))),
    db.query.blogs.findMany({ where: blogWhere(), orderBy: desc(schema.blogs.updatedAt), limit: 5, columns: lite, with: withSite }),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.status, "PUBLISHED")), orderBy: desc(schema.blogs.publishedAt), limit: 30, columns: lite, with: withSite }),
    db.query.activityLogs.findMany({ where: user.role === "SUPER_ADMIN" && !focused ? or(isNull(schema.activityLogs.websiteId), inArray(schema.activityLogs.websiteId, sites)) : inArray(schema.activityLogs.websiteId, sites), orderBy: desc(schema.activityLogs.createdAt), limit: 25, with: { user: { columns: { name: true } } } }),
    isSuper ? Promise.resolve([{ n: 1 }]) : db.select({ n: count() }).from(schema.websiteUsers).where(and(eq(schema.websiteUsers.userId, user.id), eq(schema.websiteUsers.role, "WEBSITE_ADMIN"))),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.status, "IN_REVIEW")), orderBy: desc(schema.blogs.updatedAt), limit: 8, columns: lite, with: { ...withSite, author: { columns: { name: true } } } }),
    db.query.blogs.findMany({ where: blogWhere(eq(schema.blogs.authorId, user.id), inArray(schema.blogs.status, ["DRAFT", "IN_REVIEW"])), orderBy: desc(schema.blogs.updatedAt), limit: 16, columns: lite, with: withSite }),
    isSuper ? db.select({ active: schema.users.active, n: count() }).from(schema.users).where(isNull(schema.users.deletedAt)).groupBy(schema.users.active) : Promise.resolve([]),
  ]);
  // Pages: live / with unpublished changes / waiting for review, and the review queue (articles and pages together).
  const pageRows = await db.query.pages.findMany({ where: and(isNull(schema.pages.deletedAt), siteFilter(schema.pages.websiteId)),
    columns: { id: true, title: true, status: true, content: true, reviewState: true, reviewNote: true, reviewBy: true, reviewAt: true, editedBy: true, updatedAt: true }, with: withSite });
  const ids = [...new Set(pageRows.map((p) => p.reviewBy).filter((x): x is string => !!x))];
  const names = new Map(ids.length ? (await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids))).map((u) => [u.id, u.name]) : []);
  const pageItem = (p: (typeof pageRows)[number], status: string) => ({ id: p.id, kind: "page", href: `/pages/${p.id}`, title: `Page: ${p.title}`, website: p.website,
    author: p.reviewBy ? { name: names.get(p.reviewBy) ?? "" } : null, updatedAt: p.reviewAt ?? p.updatedAt, status, reviewNote: p.reviewNote });
  const unpub = pageRows.filter((p) => hasUnpublished(readContent(p.content)));
  const waiting = pageRows.filter((p) => p.reviewState === "WAITING");
  const pageStats = { live: pageRows.filter((p) => p.status === "PUBLISHED").length, changed: unpub.length, waiting: waiting.length };
  const tagBlog = <T extends { id: string; updatedAt: Date }>(b: T) => ({ ...b, kind: "article", href: `/content?open=blogs:${b.id}` });
  const byDate = (a: { updatedAt: Date }, b: { updatedAt: Date }) => +new Date(b.updatedAt) - +new Date(a.updatedAt);
  const queue = [...reviewQueue.map(tagBlog), ...waiting.map((p) => pageItem(p, "IN_REVIEW"))].sort(byDate);
  const myPageDrafts = unpub.filter((p) => p.editedBy === user.id && p.reviewState !== "WAITING").map((p) => pageItem(p, "DRAFT"));
  const myPageReview = waiting.filter((p) => p.reviewBy === user.id).map((p) => pageItem(p, "IN_REVIEW"));
  const pageChanges = pageRows.filter((p) => p.reviewState === "CHANGES" && p.reviewBy === user.id).map((p) => ({ id: p.id, title: `Page: ${p.title}`, reviewNote: p.reviewNote, href: `/pages/${p.id}` }));
  // Suggested changes to live articles count as review work too.
  const sug = await db.query.blogs.findMany({ where: and(blogWhere(), isNotNull(schema.blogs.pending)), columns: { id: true, title: true, pendingState: true, pendingBy: true, pendingAt: true, reviewNote: true, updatedAt: true }, with: withSite });
  const sugItem = (b: (typeof sug)[number], status: string) => ({ id: b.id, kind: "article", href: `/content?open=blogs:${b.id}`, title: `Changes: ${b.title}`, website: b.website,
    author: b.pendingBy ? { name: names.get(b.pendingBy) ?? "" } : null, updatedAt: b.pendingAt ?? b.updatedAt, status, reviewNote: b.reviewNote });
  const sugWaiting = sug.filter((b) => b.pendingState === "WAITING");
  for (const b of sug) if (b.pendingBy && !names.has(b.pendingBy)) { const [u] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, b.pendingBy)); if (u) names.set(b.pendingBy, u.name); }
  queue.push(...sugWaiting.map((b) => sugItem(b, "IN_REVIEW"))); queue.sort(byDate);
  myPageReview.push(...sugWaiting.filter((b) => b.pendingBy === user.id).map((b) => sugItem(b, "IN_REVIEW")));
  myPageDrafts.push(...sug.filter((b) => b.pendingBy === user.id && b.pendingState === "").map((b) => sugItem(b, "DRAFT")));
  pageChanges.push(...sug.filter((b) => b.pendingBy === user.id && b.pendingState === "CHANGES").map((b) => ({ id: b.id, title: b.title, reviewNote: b.reviewNote, href: `/content?open=blogs:${b.id}` })));
  const by = (s: string) => statusRows.find((r) => r.s === s)?.n ?? 0;
  const level: "super" | "admin" | "editor" = isSuper ? "super" : adminRows[0].n > 0 ? "admin" : "editor";
  const myDrafts = mine.filter((b) => b.status === "DRAFT").slice(0, 8), myReview = mine.filter((b) => b.status === "IN_REVIEW").slice(0, 8);
  const users = userRows.reduce((a, r) => a + r.n, 0), pendingUsers = userRows.find((r) => !r.active)?.n ?? 0;
  return json({ pendingUsers, level, websites, pages, users, pageStats,
    changesRequested: [...myDrafts.filter((b) => b.reviewNote).map((b) => ({ id: b.id, title: b.title, reviewNote: b.reviewNote, href: `/content?open=blogs:${b.id}` })), ...pageChanges],
    published: by("PUBLISHED"), drafts: by("DRAFT"), review: by("IN_REVIEW") + waiting.length + sugWaiting.length, reviewQueue: queue,
    myDrafts: [...myDrafts.map(tagBlog), ...myPageDrafts].sort(byDate).slice(0, 8), myReview: [...myReview.map(tagBlog), ...myPageReview].sort(byDate).slice(0, 8),
    recentUpdated: recentUpdated.map(tagBlog), recentPublished: recentPublished.map(tagBlog), activity });
});
