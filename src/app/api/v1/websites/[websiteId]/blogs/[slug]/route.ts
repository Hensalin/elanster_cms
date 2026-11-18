import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authorize, livePublished, notDeleted, preflight, pub, pubError, publicBlog } from "@/lib/public";

export const OPTIONS = preflight;
export async function GET(req: Request, { params }: { params: Promise<{ websiteId: string; slug: string }> }) {
  const { websiteId, slug } = await params;
  const a = await authorize(req, websiteId);
  if ("error" in a) return a.error;
  const b = await db.query.blogs.findFirst({
    where: and(eq(schema.blogs.websiteId, a.site.id), eq(schema.blogs.slug, slug), notDeleted(), livePublished()),
    with: { category: true, author: true, featuredImage: true, tagLinks: { with: { tag: true } } },
  });
  if (!b) return pubError("Article not found", 404);
  return pub(publicBlog(b, new URL(req.url).origin, true));
}
