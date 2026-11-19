import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { manifestSchema, readContent, writeContent } from "@/lib/pagecontent";
import { syncPages } from "@/lib/sitescan";

/** Import (or refresh) the editable text of a website's pages from the site scan file. Safe to repeat: edits are kept. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  if (!canPublish(await websiteRole(user, id))) return fail("Only a Website Admin can import pages", 403);
  const text = await req.text();
  // No file sent: read the website's own pages from its address (never another website's pages).
  if (!text.trim()) { try { const r = await syncPages(id, user.id); return json({ created: r.created, updated: r.updated, removed: r.removed, pages: r.pages.length }); } catch (e) { return fail((e as Error).message, 422); } }
  const m = manifestSchema.parse(JSON.parse(text));
  const list = [...m.pages, ...(m.global ? [m.global] : [])];
  let created = 0, updated = 0;
  for (const p of list) {
    const [ex] = await db.select().from(schema.pages).where(and(eq(schema.pages.websiteId, id), eq(schema.pages.slug, p.slug)));
    const keys = new Set(p.fields.map((f) => f.key));
    if (!ex) {
      await db.insert(schema.pages).values({ websiteId: id, title: p.title, slug: p.slug, status: "DRAFT",
        content: writeContent({ file: p.file ?? null, fields: p.fields, draft: {}, published: {} }) });
      created++;
    } else {
      const old = readContent(ex.content);
      const keep = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([k]) => keys.has(k)));
      await db.update(schema.pages).set({ title: p.title, deletedAt: null,
        content: writeContent({ file: p.file ?? null, fields: p.fields, draft: keep(old.draft), published: keep(old.published) }) }).where(eq(schema.pages.id, ex.id));
      updated++;
    }
  }
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "PAGES_IMPORT", entity: "page", entityId: id, summary: `Imported pages (${created} new, ${updated} refreshed)` });
  return json({ created, updated });
});
