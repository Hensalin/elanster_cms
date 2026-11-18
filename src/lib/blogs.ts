import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { slugify } from "./http";
import { cleanHtml } from "./sanitize";

export const blogInput = z.object({
  websiteId: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(500).default(""),
  content: z.string().max(500_000).default(""),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  featuredImageId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  seoTitle: z.string().max(200).default(""),
  metaDescription: z.string().max(400).default(""),
  canonicalUrl: z.string().max(500).default(""),
  robots: z.enum(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]).default("index,follow"),
  ogTitle: z.string().max(200).default(""),
  ogDescription: z.string().max(400).default(""),
  ogImageId: z.string().nullable().optional(),
});
export type BlogInput = z.infer<typeof blogInput>;

/** Make a slug that is unique inside one website. */
export async function uniqueBlogSlug(websiteId: string, wanted: string, ignoreId?: string) {
  const base = slugify(wanted);
  let slug = base, i = 2;
  for (;;) {
    const [hit] = await db.select({ id: schema.blogs.id }).from(schema.blogs)
      .where(and(eq(schema.blogs.websiteId, websiteId), eq(schema.blogs.slug, slug)));
    if (!hit || hit.id === ignoreId) return slug;
    slug = `${base}-${i++}`;
  }
}

/** Save the tag names (creating tags that do not exist yet) for one blog. */
export async function setBlogTags(blogId: string, websiteId: string, names: string[]) {
  const wanted = [...new Map(names.map((n) => n.trim()).filter(Boolean).map((n) => [slugify(n), n])).entries()];
  await db.delete(schema.blogTags).where(eq(schema.blogTags.blogId, blogId));
  if (!wanted.length) return;
  await db.insert(schema.tags).values(wanted.map(([slug, name]) => ({ websiteId, slug, name }))).onConflictDoNothing();
  const rows = await db.select().from(schema.tags)
    .where(and(eq(schema.tags.websiteId, websiteId), inArray(schema.tags.slug, wanted.map(([s]) => s))));
  await db.insert(schema.blogTags).values(rows.map((t) => ({ blogId, tagId: t.id })));
}

export const blogColumns = (d: BlogInput) => ({
  title: d.title.trim(),
  excerpt: d.excerpt,
  content: cleanHtml(d.content),
  categoryId: d.categoryId || null,
  featuredImageId: d.featuredImageId || null,
  authorId: d.authorId || null,
  seoTitle: d.seoTitle, metaDescription: d.metaDescription, canonicalUrl: d.canonicalUrl,
  robots: d.robots, ogTitle: d.ogTitle, ogDescription: d.ogDescription, ogImageId: d.ogImageId || null,
});

/** Full blog (with category, tags, author, images) in the shape both admin and public APIs use. */
export async function blogWithRelations(id: string) {
  return db.query.blogs.findFirst({
    where: eq(schema.blogs.id, id),
    with: { category: true, author: true, featuredImage: true, tagLinks: { with: { tag: true } } },
  });
}
