import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { readContent } from "@/lib/pagecontent";
import { authorize, preflight, pub, pubError } from "@/lib/public";

export const OPTIONS = preflight;
/** Published text for one page (only the pieces that were edited). The website swaps them into its own design. */
export async function GET(req: Request, { params }: { params: Promise<{ websiteId: string; slug: string }> }) {
  const { websiteId, slug } = await params;
  const a = await authorize(req, websiteId);
  if ("error" in a) return a.error;
  const [p] = await db.select().from(schema.pages).where(and(
    eq(schema.pages.websiteId, a.site.id), eq(schema.pages.slug, slug), eq(schema.pages.status, "PUBLISHED"), isNull(schema.pages.deletedAt)));
  if (!p) return pubError("Page not found", 404);
  const c = readContent(p.content);
  // "original" is the wording each text has on the website, so the website script can find texts that carry no data-cms marker.
  return pub({ slug: p.slug, title: p.title, publishedAt: p.publishedAt, fields: c.published,
    original: Object.fromEntries(c.fields.map((f) => [f.key, f.text])) });
}
