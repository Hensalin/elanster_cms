import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canEdit, websiteRole } from "@/lib/auth";
import { blogWithRelations, setBlogTags, uniqueBlogSlug } from "@/lib/blogs";
import { admin, fail, json } from "@/lib/http";

export const POST = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const b = await blogWithRelations((await params).id);
  if (!b || b.deletedAt) return fail("Not found", 404);
  if (!canEdit(await websiteRole(user, b.websiteId))) return fail("Forbidden", 403);
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, scheduledAt: _s, category: _cat, author: _a, featuredImage: _f, tagLinks, ...rest } = b;
  const title = `${b.title} (copy)`;
  const [copy] = await db.insert(schema.blogs).values({ ...rest, title, slug: await uniqueBlogSlug(b.websiteId, title), status: "DRAFT", authorId: user.id }).returning();
  await setBlogTags(copy.id, b.websiteId, tagLinks.map((l) => l.tag.name));
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: "BLOG_DUPLICATE", entity: "blog", entityId: copy.id, summary: `Duplicated "${b.title}"` });
  return json(copy, 201);
});
