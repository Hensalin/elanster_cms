import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { readContent, writeContent } from "@/lib/pagecontent";
import { saveVersion } from "@/lib/ratelimit";

/** Restore: puts the old version back as the current draft (the live site changes only when someone publishes). */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (_r, { params }, user) => {
  const [v] = await db.select().from(schema.versions).where(eq(schema.versions.id, (await params).id)); if (!v) return fail("Not found", 404);
  const data = v.data as Record<string, unknown>;
  if (v.entity === "blog") {
    const [b] = await db.select().from(schema.blogs).where(eq(schema.blogs.id, v.entityId)); if (!b) return fail("Not found", 404);
    const role = await websiteRole(user, b.websiteId); if (!role) return fail("Forbidden", 403);
    if (!canPublish(role) && b.status === "PUBLISHED") return fail("Only a Website Admin can change published content", 403);
    await saveVersion("blog", b.id, b.websiteId, user.id, { title: b.title, excerpt: b.excerpt, content: b.content, seoTitle: b.seoTitle, metaDescription: b.metaDescription });
    await db.update(schema.blogs).set({ title: String(data.title ?? b.title), excerpt: String(data.excerpt ?? b.excerpt), content: String(data.content ?? b.content),
      seoTitle: String(data.seoTitle ?? b.seoTitle), metaDescription: String(data.metaDescription ?? b.metaDescription) }).where(eq(schema.blogs.id, b.id));
    await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: "VERSION_RESTORE", entity: "blog", entityId: b.id, summary: `Restored an older version of "${b.title}"` });
  } else {
    const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, v.entityId)); if (!p) return fail("Not found", 404);
    if (!(await websiteRole(user, p.websiteId))) return fail("Forbidden", 403);
    const c = readContent(p.content); await saveVersion("page", p.id, p.websiteId, user.id, { draft: c.draft });
    await db.update(schema.pages).set({ content: writeContent({ ...c, draft: (data.draft as Record<string, string>) ?? {} }) }).where(eq(schema.pages.id, p.id));
    await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: p.websiteId, action: "VERSION_RESTORE", entity: "page", entityId: p.id, summary: `Restored an older draft of page "${p.title}"` });
  }
  return json({ ok: true });
});
