import { and, eq, lte, or, isNull } from "drizzle-orm";
import { schema } from "@/db";
import { websiteFromKey } from "./apikeys";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
export const preflight = () => new Response(null, { status: 204, headers: CORS });
export const pub = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...CORS, "Cache-Control": "public, max-age=0, s-maxage=30", ...extra } });
export const pubError = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

/** Only published articles, plus scheduled ones whose time has come. Drafts never match. */
export const livePublished = () => or(
  eq(schema.blogs.status, "PUBLISHED"),
  and(eq(schema.blogs.status, "SCHEDULED"), lte(schema.blogs.scheduledAt, new Date())),
)!;
export const notDeleted = () => isNull(schema.blogs.deletedAt);

/** Checks the API key and that it belongs to the website in the URL (id or short name). */
export async function authorize(req: Request, websiteParam: string) {
  const site = await websiteFromKey(req);
  if (!site) return { error: pubError("Missing or invalid API key", 401) } as const;
  if (websiteParam !== site.id && websiteParam !== site.slug)
    return { error: pubError("This API key does not have access to that website", 403) } as const;
  return { site } as const;
}

type BlogFull = NonNullable<Awaited<ReturnType<typeof import("./blogs").blogWithRelations>>>;
export function publicBlog(b: BlogFull, origin: string, withContent: boolean) {
  const img = (m: { filename: string; altText: string } | null | undefined) =>
    m ? { url: `${origin}/uploads/${m.filename}`, alt: m.altText } : null;
  return {
    id: b.id, title: b.title, slug: b.slug, excerpt: b.excerpt,
    ...(withContent ? { content: b.content } : {}),
    publishedAt: b.publishedAt, updatedAt: b.updatedAt,
    author: b.author?.name ?? null,
    category: b.category ? { name: b.category.name, slug: b.category.slug } : null,
    tags: b.tagLinks.map((l) => ({ name: l.tag.name, slug: l.tag.slug })),
    featuredImage: img(b.featuredImage),
    seo: {
      title: b.seoTitle || b.title, description: b.metaDescription || b.excerpt,
      canonicalUrl: b.canonicalUrl || null, robots: b.robots,
      ogTitle: b.ogTitle || b.seoTitle || b.title, ogDescription: b.ogDescription || b.metaDescription || b.excerpt,
    },
  };
}
