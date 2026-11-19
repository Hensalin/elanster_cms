import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { saveVersion } from "@/lib/ratelimit";
import { canEdit, canPublish, websiteRole } from "@/lib/auth";
import { blogColumns, blogInput, blogWithRelations, setBlogTags, uniqueBlogSlug } from "@/lib/blogs";
import { admin, fail, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, userId: Parameters<typeof websiteRole>[0]) {
  const b = await blogWithRelations(id);
  if (!b || b.deletedAt) return { err: fail("Not found", 404) };
  const role = await websiteRole(userId, b.websiteId);
  if (!canEdit(role)) return { err: fail("Forbidden", 403) };
  return { b, role };
}

export const GET = admin<Ctx>(async (_r, { params }, user) => {
  const r = await load((await params).id, user);
  return r.err ?? json(r.b);
});

export const PUT = admin<Ctx>(async (req, { params }, user) => {
  const r = await load((await params).id, user);
  if (r.err) return r.err;
  const { b, role } = r;
  // Editors may not change content that is already live or scheduled.
  if (!canPublish(role ?? null) && (b.status === "PUBLISHED" || b.status === "SCHEDULED"))
    return fail("Only a Website Admin can edit published content", 403);
  const d = blogInput.parse(await req.json());
  if (d.websiteId !== b.websiteId) return fail("An article cannot be moved to another website", 400);
  const slug = d.slug ? await uniqueBlogSlug(b.websiteId, d.slug, b.id) : b.slug;
  if (b.title !== d.title || b.content !== d.content || b.excerpt !== d.excerpt)
    await saveVersion("blog", b.id, b.websiteId, user.id, { title: b.title, excerpt: b.excerpt, content: b.content, seoTitle: b.seoTitle, metaDescription: b.metaDescription });
  await db.update(schema.blogs).set({ ...blogColumns(d), slug }).where(eq(schema.blogs.id, b.id));
  await setBlogTags(b.id, b.websiteId, d.tags);
  const wasLive = b.status === "PUBLISHED";
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: wasLive ? "BLOG_UPDATE_LIVE" : "BLOG_UPDATE", entity: "blog", entityId: b.id, summary: `${wasLive ? "Updated published article" : "Saved"} "${d.title}"` });
  if (wasLive) await db.insert(schema.publishingHistory).values({ blogId: b.id, userId: user.id, action: "UPDATE" });
  return json(await blogWithRelations(b.id));
});

export const DELETE = admin<Ctx>(async (_r, { params }, user) => {
  const r = await load((await params).id, user);
  if (r.err) return r.err;
  const { b, role } = r;
  if (!canPublish(role ?? null) && b.status !== "DRAFT") return fail("Only a Website Admin can delete this", 403);
  await db.update(schema.blogs).set({ deletedAt: new Date(), status: "UNPUBLISHED" }).where(eq(schema.blogs.id, b.id)); // soft delete
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: "BLOG_DELETE", entity: "blog", entityId: b.id, summary: `Deleted "${b.title}"` });
  return json({ ok: true });
});
