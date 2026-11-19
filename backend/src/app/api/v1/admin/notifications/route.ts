import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";

type Note = { id: string; kind: "approve" | "review" | "changes" | "live"; title: string; text: string; href: string; at: string; action: boolean };

/** The bell in the top bar. Each person only gets what concerns them:
 *  Super Admin: new accounts to approve + articles waiting for review on every website.
 *  Website Admin: articles waiting for review on the websites they publish for.
 *  Editor: articles sent back with changes requested, and their articles that went live. */
export const GET = admin(async (_req, _c, user) => {
  const notes: Note[] = []; const ids = await accessibleWebsiteIds(user); const all = ids === "all" ? [] : ids;
  const isSuper = user.role === "SUPER_ADMIN";
  const publishFor = isSuper ? all : (await db.select({ id: schema.websiteUsers.websiteId }).from(schema.websiteUsers)
    .where(and(eq(schema.websiteUsers.userId, user.id), eq(schema.websiteUsers.role, "WEBSITE_ADMIN")))).map((r) => r.id).filter((id) => all.includes(id));

  if (isSuper) {
    const waiting = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, at: schema.users.createdAt }).from(schema.users)
      .where(and(eq(schema.users.active, false), isNull(schema.users.deletedAt))).orderBy(desc(schema.users.createdAt)).limit(10);
    for (const u of waiting) notes.push({ id: "u" + u.id, kind: "approve", title: `${u.name} asked for an account`, text: `${u.email} · approve and choose their websites`, href: "/users", at: u.at.toISOString(), action: true });
  }
  if (publishFor.length) {
    const rev = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.status, "IN_REVIEW"), inArray(schema.blogs.websiteId, publishFor)),
      orderBy: desc(schema.blogs.updatedAt), limit: 15, columns: { id: true, title: true, updatedAt: true }, with: { website: { columns: { name: true } }, author: { columns: { name: true } } } });
    for (const b of rev) notes.push({ id: "r" + b.id, kind: "review", title: `Waiting for review: “${b.title}”`, text: `${b.author?.name ?? "Someone"} · ${b.website?.name ?? ""}`, href: `/content?open=blogs:${b.id}`, at: b.updatedAt.toISOString(), action: true });
  }
  if (all.length) {
    const mine = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.authorId, user.id), inArray(schema.blogs.websiteId, all), ne(schema.blogs.reviewNote, ""), eq(schema.blogs.status, "DRAFT")),
      orderBy: desc(schema.blogs.updatedAt), limit: 10, columns: { id: true, title: true, reviewNote: true, updatedAt: true } });
    for (const b of mine) notes.push({ id: "c" + b.id, kind: "changes", title: `Changes requested on “${b.title}”`, text: b.reviewNote.slice(0, 120), href: `/content?open=blogs:${b.id}`, at: b.updatedAt.toISOString(), action: true });
    if (!isSuper) {
      const live = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.authorId, user.id), inArray(schema.blogs.websiteId, all), eq(schema.blogs.status, "PUBLISHED"), gte(schema.blogs.publishedAt, new Date(Date.now() - 14 * 864e5))),
        orderBy: desc(schema.blogs.publishedAt), limit: 5, columns: { id: true, title: true, publishedAt: true }, with: { website: { columns: { name: true } } } });
      for (const b of live) notes.push({ id: "l" + b.id, kind: "live", title: `“${b.title}” is live`, text: `Published on ${b.website?.name ?? "your website"}`, href: `/content?open=blogs:${b.id}`, at: (b.publishedAt ?? new Date()).toISOString(), action: false });
    }
  }
  notes.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return json({ items: notes, actions: notes.filter((n) => n.action).length });
});
