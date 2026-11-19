import { and, eq, inArray, isNull } from "drizzle-orm";
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
  authorName: z.string().max(120).optional(),
  seoTitle: z.string().max(200).default(""),
  metaDescription: z.string().max(400).default(""),
  canonicalUrl: z.string().max(500).default(""),
  robots: z.enum(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]).default("index,follow"),
  ogTitle: z.string().max(200).default(""),
  ogDescription: z.string().max(400).default(""),
  ogImageId: z.string().nullable().optional(),
});
export type BlogInput = z.infer<typeof blogInput>;

/** Checks that the category, pictures and author an article points to really exist (and belong to its website).
 *  Returns a readable problem, or null. Empty values and the text "null" are treated as "none". */
export async function checkBlogRefs(d: BlogInput, websiteId: string): Promise<string | null> {
  const none = (v?: string | null) => !v || v === "null" || v === "undefined";
  for (const k of ["categoryId", "featuredImageId", "ogImageId", "authorId"] as const) if (none(d[k])) d[k] = null;
  if (d.categoryId) {
    const [c] = await db.select({ w: schema.categories.websiteId }).from(schema.categories).where(eq(schema.categories.id, d.categoryId));
    if (!c || c.w !== websiteId) return "That category does not exist on this website. Pick another one.";
  }
  for (const k of ["featuredImageId", "ogImageId"] as const) {
    const id = d[k]; if (!id) continue;
    const [m] = await db.select({ id: schema.media.id }).from(schema.media).where(and(eq(schema.media.id, id), isNull(schema.media.deletedAt)));
    if (!m) return "That picture no longer exists. Choose or upload it again.";
  }
  if (d.authorId) { const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, d.authorId)); if (!u) return "That author does not exist."; }
  return null;
}

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

/** First ~160 characters of the article text, used when the writer leaves the short description empty. */
export const autoExcerpt = (html: string) => {
  const t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (t.length <= 160) return t;
  const cut = t.slice(0, 160); return cut.slice(0, Math.max(cut.lastIndexOf(" "), 120)).replace(/[,;:.\s]+$/, "") + "…";
};
/** The first uploaded image inside the article, used as the featured image when none is chosen. */
export const firstImageId = (html: string) => /\/api\/v1\/media\/([A-Za-z0-9_-]+)/.exec(html)?.[1] ?? null;

export const blogColumns = (d: BlogInput) => ({
  title: d.title.trim(),
  excerpt: d.excerpt.trim() || autoExcerpt(d.content),
  content: cleanHtml(d.content),
  categoryId: d.categoryId || null,
  featuredImageId: d.featuredImageId || firstImageId(d.content),
  authorId: d.authorId || null,
  ...(d.authorName !== undefined ? { authorName: d.authorName.trim() } : {}),
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
