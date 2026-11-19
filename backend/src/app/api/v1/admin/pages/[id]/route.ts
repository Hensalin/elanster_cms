import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { saveVersion } from "@/lib/ratelimit";
import { canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { draftSchema, hasUnpublished, readContent, writeContent } from "@/lib/pagecontent";

async function load(id: string) {
  return db.query.pages.findFirst({ where: eq(schema.pages.id, id), with: { website: { columns: { name: true, slug: true, domain: true } } } });
}

export const GET = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const p = await load((await params).id);
  if (!p || p.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, p.websiteId);
  if (!role) return fail("Forbidden", 403);
  const c = readContent(p.content);
  return json({ id: p.id, websiteId: p.websiteId, website: p.website, title: p.title, slug: p.slug, status: p.status, publishedAt: p.publishedAt,
    updatedAt: p.updatedAt, file: c.file, fields: c.fields, draft: c.draft, published: c.published, unpublished: hasUnpublished(c) });
});

/** Save the draft text (only values that differ from the original are kept). Never changes the live site. */
export const PUT = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, id));
  if (!p || p.deletedAt) return fail("Not found", 404);
  if (!canEdit(await websiteRole(user, p.websiteId))) return fail("Forbidden", 403);
  const { draft } = draftSchema.parse(await req.json());
  const c = readContent(p.content);
  const orig = new Map(c.fields.map((f) => [f.key, f.text]));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft)) if (orig.has(k) && v !== orig.get(k)) clean[k] = v;
  if (JSON.stringify(c.draft) !== JSON.stringify(clean)) await saveVersion("page", p.id, p.websiteId, user.id, { draft: c.draft });
  await db.update(schema.pages).set({ content: writeContent({ ...c, draft: clean }) }).where(eq(schema.pages.id, id));
  return json({ ok: true, edited: Object.keys(clean).length, unpublished: hasUnpublished({ ...c, draft: clean }) });
});
