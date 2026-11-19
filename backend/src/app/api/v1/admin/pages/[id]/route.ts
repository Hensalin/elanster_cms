import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { saveVersion } from "@/lib/ratelimit";
import { canEdit, canPublish, websiteRole } from "@/lib/auth";
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
  const [by] = p.reviewBy ? await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.reviewBy)) : [];
  return json({ id: p.id, websiteId: p.websiteId, website: p.website, title: p.title, slug: p.slug, status: p.status, publishedAt: p.publishedAt,
    updatedAt: p.updatedAt, file: c.file, fields: c.fields, draft: c.draft, published: c.published, unpublished: hasUnpublished(c),
    review: { state: p.reviewState, note: p.reviewNote, by: by?.name ?? null, byMe: p.reviewBy === user.id, at: p.reviewAt },
    canPublish: canPublish(role) });
});

/** Save the draft text (only values that differ from the original are kept). Never changes the live site. */
export const PUT = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, id));
  if (!p || p.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, p.websiteId);
  if (!canEdit(role)) return fail("Forbidden", 403);
  // While an editor's changes wait for review they stay as sent; an admin can still adjust them before publishing.
  if (p.reviewState === "WAITING" && !canPublish(role)) return fail("This page is waiting for review. You can edit it again after an admin publishes it or sends it back, or take it back from review.", 409);
  const raw = await req.json();
  const { draft } = draftSchema.parse(raw);
  const seen = raw && typeof raw.expectedUpdatedAt === "string" ? new Date(raw.expectedUpdatedAt).getTime() : NaN;
  if (!isNaN(seen) && p.updatedAt.getTime() > seen + 1) return fail("Someone else saved this page after you opened it. Reload to see their changes, then apply yours again.", 409);
  const c = readContent(p.content);
  const orig = new Map(c.fields.map((f) => [f.key, f.text]));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft)) if (orig.has(k) && v !== orig.get(k)) clean[k] = v;
  if (JSON.stringify(c.draft) !== JSON.stringify(clean)) await saveVersion("page", p.id, p.websiteId, user.id, { draft: c.draft });
  const [after] = await db.update(schema.pages).set({ content: writeContent({ ...c, draft: clean }), editedBy: user.id }).where(eq(schema.pages.id, id)).returning({ updatedAt: schema.pages.updatedAt });
  return json({ ok: true, edited: Object.keys(clean).length, unpublished: hasUnpublished({ ...c, draft: clean }), updatedAt: after?.updatedAt });
});
