import { and, desc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";
import { gitScheduledDue } from "@/lib/gitpublish";

async function nameMap(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, string>();
  return new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, list))).map((u) => [u.id, u.name]));
}
type Note = { id: string; kind: "approve" | "review" | "changes" | "live"; title: string; text: string; href: string; at: string; action: boolean; stamp?: string };

/** The bell in the top bar. Each person only gets what concerns them:
 *  Super Admin: new accounts to approve + articles waiting for review on every website.
 *  Website Admin: articles waiting for review on the websites they publish for.
 *  Pages follow the same rules: admins see pages waiting for review, editors see pages sent back or published.
 *  Editor: articles sent back with changes requested, and their articles that went live. */
type User = Parameters<typeof accessibleWebsiteIds>[0];
async function buildNotes(user: User) {
  const notes: Note[] = []; const ids = await accessibleWebsiteIds(user); const all = ids === "all" ? [] : ids;
  const isSuper = user.role === "SUPER_ADMIN";
  // A Super Admin publishes for every website that still exists.
  const everySite = isSuper ? (await db.select({ id: schema.websites.id }).from(schema.websites).where(isNull(schema.websites.deletedAt))).map((w) => w.id) : all;
  const publishFor = isSuper ? everySite : (await db.select({ id: schema.websiteUsers.websiteId }).from(schema.websiteUsers)
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
    const sug = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.pendingState, "WAITING"), inArray(schema.blogs.websiteId, publishFor)),
      orderBy: desc(schema.blogs.pendingAt), limit: 15, columns: { id: true, title: true, pendingAt: true, pendingBy: true }, with: { website: { columns: { name: true } } } });
    const sugNames = await nameMap(sug.map((x) => x.pendingBy));
    for (const b of sug) notes.push({ id: "s" + b.id, kind: "review", title: `Changes waiting for review: “${b.title}”`, text: `${sugNames.get(b.pendingBy ?? "") ?? "Someone"} · ${b.website?.name ?? ""}`, href: `/content?open=blogs:${b.id}`, at: (b.pendingAt ?? new Date()).toISOString(), action: true });
    const prev = await db.query.pages.findMany({ where: and(isNull(schema.pages.deletedAt), eq(schema.pages.reviewState, "WAITING"), inArray(schema.pages.websiteId, publishFor)),
      orderBy: desc(schema.pages.reviewAt), limit: 15, columns: { id: true, title: true, reviewAt: true, reviewBy: true }, with: { website: { columns: { name: true } } } });
    const names = await nameMap(prev.map((x) => x.reviewBy));
    for (const pg of prev) notes.push({ id: "pr" + pg.id, kind: "review", title: `Page waiting for review: ${pg.title}`, text: `${names.get(pg.reviewBy ?? "") ?? "Someone"} · ${pg.website?.name ?? ""}`, href: `/pages/${pg.id}`, at: (pg.reviewAt ?? new Date()).toISOString(), action: true });
  }
  if (everySite.length) {
    const all = everySite;
    const mine = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.authorId, user.id), inArray(schema.blogs.websiteId, all), ne(schema.blogs.reviewNote, ""), eq(schema.blogs.status, "DRAFT")),
      orderBy: desc(schema.blogs.updatedAt), limit: 10, columns: { id: true, title: true, reviewNote: true, updatedAt: true } });
    for (const b of mine) notes.push({ stamp: "n" + createHash("sha1").update(b.reviewNote).digest("hex").slice(0, 10), id: "c" + b.id, kind: "changes", title: `Changes requested on “${b.title}”`, text: b.reviewNote.slice(0, 120), href: `/content?open=blogs:${b.id}`, at: b.updatedAt.toISOString(), action: true });
    const mySug = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.pendingBy, user.id), inArray(schema.blogs.websiteId, all)),
      orderBy: desc(schema.blogs.pendingAt), limit: 10, columns: { id: true, title: true, pending: true, pendingState: true, pendingAt: true, reviewNote: true } });
    for (const b of mySug) {
      const at = (b.pendingAt ?? new Date()).toISOString();
      if (b.pendingState === "CHANGES") notes.push({ id: "sc" + b.id, kind: "changes", title: `Changes requested on “${b.title}”`, text: b.reviewNote.slice(0, 120), href: `/content?open=blogs:${b.id}`, at, action: true });
      else if (!isSuper && !b.pending && b.pendingAt && +b.pendingAt > Date.now() - 14 * 864e5)
        notes.push({ id: "sl" + b.id, kind: "live", title: `Your changes to “${b.title}” are live`, text: "Approved and published", href: `/content?open=blogs:${b.id}`, at, action: false });
    }
    const myPages = await db.query.pages.findMany({ where: and(isNull(schema.pages.deletedAt), eq(schema.pages.reviewBy, user.id), inArray(schema.pages.websiteId, all)),
      orderBy: desc(schema.pages.reviewAt), limit: 15, columns: { id: true, title: true, reviewState: true, reviewNote: true, reviewAt: true, publishedAt: true }, with: { website: { columns: { name: true } } } });
    for (const pg of myPages) {
      const at = (pg.reviewAt ?? new Date()).toISOString();
      if (pg.reviewState === "CHANGES") notes.push({ id: "pc" + pg.id, kind: "changes", title: `Changes requested on page ${pg.title}`, text: pg.reviewNote.slice(0, 120), href: `/pages/${pg.id}`, at, action: true });
      else if (!isSuper && pg.reviewState === "" && pg.publishedAt && pg.reviewAt && +pg.publishedAt >= +pg.reviewAt - 5000 && +pg.publishedAt > Date.now() - 14 * 864e5)
        notes.push({ id: "pl" + pg.id, kind: "live", title: `Your changes to ${pg.title} are live`, text: `Published on ${pg.website?.name ?? "your website"}`, href: `/pages/${pg.id}`, at, action: false });
    }
    if (!isSuper) {
      const live = await db.query.blogs.findMany({ where: and(isNull(schema.blogs.deletedAt), eq(schema.blogs.authorId, user.id), inArray(schema.blogs.websiteId, all), eq(schema.blogs.status, "PUBLISHED"), gte(schema.blogs.publishedAt, new Date(Date.now() - 14 * 864e5))),
        orderBy: desc(schema.blogs.publishedAt), limit: 5, columns: { id: true, title: true, publishedAt: true }, with: { website: { columns: { name: true } } } });
      for (const b of live) notes.push({ id: "l" + b.id, kind: "live", title: `“${b.title}” is live`, text: `Published on ${b.website?.name ?? "your website"}`, href: `/content?open=blogs:${b.id}`, at: (b.publishedAt ?? new Date()).toISOString(), action: false });
    }
  }
  notes.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return notes;
}
// The same request seen once stays seen while the editor keeps saving; a new note or a new event makes it new again.
const keyOf = (n: Note) => `${n.id}@${n.stamp ?? n.at}`;

export const GET = admin(async (_req, _c, user) => {
  await gitScheduledDue().catch((e) => console.error("scheduled git check failed", e));
  const notes = await buildNotes(user);
  const seenRows = notes.length ? await db.select({ k: schema.notificationSeen.noteKey }).from(schema.notificationSeen)
    .where(and(eq(schema.notificationSeen.userId, user.id), inArray(schema.notificationSeen.noteKey, notes.map(keyOf)))) : [];
  const seen = new Set(seenRows.map((r) => r.k));
  const items = notes.map((n) => ({ ...n, key: keyOf(n), seen: seen.has(keyOf(n)) }));
  return json({ items, unseen: items.filter((n) => !n.seen).length, actions: notes.filter((n) => n.action).length });
});

/** Marks notifications as seen: { keys: [...] } (those the person looked at or clicked) or { all: true }. */
export const POST = admin(async (req, _c, user) => {
  const d = z.object({ keys: z.array(z.string().min(3).max(200)).max(200).optional(), all: z.boolean().optional() }).parse(await req.json());
  let keys = d.keys ?? [];
  if (d.all) keys = (await buildNotes(user)).map(keyOf);
  if (keys.length) await db.insert(schema.notificationSeen).values(keys.map((noteKey) => ({ userId: user.id, noteKey }))).onConflictDoNothing();
  // keep the table small: marks older than 90 days are no longer needed (those events are long gone from the bell)
  await db.delete(schema.notificationSeen).where(and(eq(schema.notificationSeen.userId, user.id), lt(schema.notificationSeen.seenAt, new Date(Date.now() - 90 * 864e5))));
  return json({ ok: true, marked: keys.length });
});
