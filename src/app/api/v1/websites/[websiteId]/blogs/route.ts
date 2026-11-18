import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { authorize, livePublished, notDeleted, preflight, pub, publicBlog } from "@/lib/public";

export const OPTIONS = preflight;
export async function GET(req: Request, { params }: { params: Promise<{ websiteId: string }> }) {
  const a = await authorize(req, (await params).websiteId);
  if ("error" in a) return a.error;
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(u.searchParams.get("limit")) || 10));
  const conds = [eq(schema.blogs.websiteId, a.site.id), notDeleted(), livePublished()];
  const cat = u.searchParams.get("category");
  if (cat) { const [c] = await db.select().from(schema.categories).where(and(eq(schema.categories.websiteId, a.site.id), eq(schema.categories.slug, cat))); conds.push(eq(schema.blogs.categoryId, c?.id ?? "-")); }
  const tag = u.searchParams.get("tag");
  if (tag) {
    const [t] = await db.select().from(schema.tags).where(and(eq(schema.tags.websiteId, a.site.id), eq(schema.tags.slug, tag)));
    const links = t ? await db.select().from(schema.blogTags).where(eq(schema.blogTags.tagId, t.id)) : [];
    conds.push(inArray(schema.blogs.id, links.length ? links.map((l) => l.blogId) : ["-"]));
  }
  const q = u.searchParams.get("q")?.trim(); if (q) conds.push(ilike(schema.blogs.title, `%${q}%`));
  const where = and(...conds);
  const [{ n }] = await db.select({ n: count() }).from(schema.blogs).where(where);
  const rows = await db.query.blogs.findMany({ where, orderBy: desc(schema.blogs.publishedAt), limit, offset: (page - 1) * limit,
    with: { category: true, author: true, featuredImage: true, tagLinks: { with: { tag: true } } } });
  return pub({ items: rows.map((b) => publicBlog(b, u.origin, false)), total: n, page, pages: Math.max(1, Math.ceil(n / limit)) });
}
