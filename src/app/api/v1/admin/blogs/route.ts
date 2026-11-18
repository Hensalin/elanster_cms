import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds, canEdit, websiteRole } from "@/lib/auth";
import { blogColumns, blogInput, blogWithRelations, setBlogTags, uniqueBlogSlug } from "@/lib/blogs";
import { admin, fail, json } from "@/lib/http";

export const GET = admin(async (req, _c, user) => {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(u.searchParams.get("limit")) || 10));
  const ids = await accessibleWebsiteIds(user);
  const conds = [isNull(schema.blogs.deletedAt)];
  if (ids !== "all") conds.push(inArray(schema.blogs.websiteId, ids.length ? ids : ["-"]));
  const site = u.searchParams.get("website"); if (site) conds.push(eq(schema.blogs.websiteId, site));
  const status = u.searchParams.get("status");
  if (status && ["DRAFT", "IN_REVIEW", "SCHEDULED", "PUBLISHED", "UNPUBLISHED"].includes(status))
    conds.push(eq(schema.blogs.status, status as "DRAFT"));
  const cat = u.searchParams.get("category"); if (cat) conds.push(eq(schema.blogs.categoryId, cat));
  const q = u.searchParams.get("q")?.trim();
  if (q) conds.push(or(ilike(schema.blogs.title, `%${q}%`), ilike(schema.blogs.slug, `%${q}%`))!);
  const where = and(...conds);
  const [{ n }] = await db.select({ n: count() }).from(schema.blogs).where(where);
  const rows = await db.query.blogs.findMany({
    where, orderBy: desc(schema.blogs.updatedAt), limit, offset: (page - 1) * limit,
    columns: { content: false },
    with: { website: { columns: { name: true, slug: true } }, category: { columns: { name: true } }, author: { columns: { name: true } }, featuredImage: { columns: { id: true, filename: true, altText: true } } },
  });
  return json({ items: rows, total: n, page, pages: Math.max(1, Math.ceil(n / limit)) });
});

export const POST = admin(async (req, _c, user) => {
  const d = blogInput.parse(await req.json());
  if (!canEdit(await websiteRole(user, d.websiteId))) return fail("You do not have access to this website", 403);
  const slug = await uniqueBlogSlug(d.websiteId, d.slug || d.title);
  const [b] = await db.insert(schema.blogs).values({ ...blogColumns(d), websiteId: d.websiteId, slug, authorId: d.authorId || user.id }).returning();
  await setBlogTags(b.id, d.websiteId, d.tags);
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: d.websiteId, action: "BLOG_CREATE", entity: "blog", entityId: b.id, summary: `Created draft "${b.title}"` });
  return json(await blogWithRelations(b.id), 201);
});
