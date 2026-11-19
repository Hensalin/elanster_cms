import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { readContent, writeContent } from "@/lib/pagecontent";

const body = z.object({ action: z.enum(["publish", "unpublish", "discard"]) });

export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const { action } = body.parse(await req.json());
  const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, id));
  if (!p || p.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, p.websiteId);
  if (!role) return fail("Forbidden", 403);
  if (!canPublish(role)) return fail("Only a Website Admin can publish page changes", 403);
  const c = readContent(p.content);
  let patch: Partial<typeof schema.pages.$inferInsert>;
  if (action === "publish") patch = { status: "PUBLISHED", publishedAt: new Date(), content: writeContent({ ...c, published: { ...c.draft } }) };
  else if (action === "unpublish") patch = { status: "UNPUBLISHED" };
  else patch = { content: writeContent({ ...c, draft: { ...c.published } }) };
  await db.update(schema.pages).set(patch).where(eq(schema.pages.id, id));
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: p.websiteId, action: "PAGE_" + action.toUpperCase(), entity: "page", entityId: id, summary: `${action}: page "${p.title}"` });
  return json({ ok: true });
});
