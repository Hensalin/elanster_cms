import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";
import { hasUnpublished, readContent } from "@/lib/pagecontent";

export const GET = admin(async (req, _c, user) => {
  const site = new URL(req.url).searchParams.get("website");
  const ids = await accessibleWebsiteIds(user);
  const conds = [isNull(schema.pages.deletedAt)];
  if (ids !== "all") conds.push(inArray(schema.pages.websiteId, ids.length ? ids : ["-"]));
  if (site) conds.push(eq(schema.pages.websiteId, site));
  const rows = await db.query.pages.findMany({ where: and(...conds), orderBy: asc(schema.pages.title), with: { website: { columns: { name: true, slug: true, domain: true } } } });
  return json(rows.map((p) => {
    const c = readContent(p.content);
    return { id: p.id, websiteId: p.websiteId, website: p.website, title: p.title, slug: p.slug, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt,
      fieldCount: c.fields.length, editedCount: Object.keys(c.draft).length, unpublished: hasUnpublished(c),
      reviewState: p.reviewState, reviewNote: p.reviewNote };
  }));
});
