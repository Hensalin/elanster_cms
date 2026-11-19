import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canEdit, canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { hasUnpublished, readContent, writeContent } from "@/lib/pagecontent";

const body = z.object({
  action: z.enum(["publish", "unpublish", "discard", "submit", "request_changes", "withdraw"]),
  note: z.string().max(2000).optional(),
});
const LABEL: Record<string, string> = { publish: "published", unpublish: "unpublished", discard: "discarded the changes on", submit: "sent for review", request_changes: "asked for changes on", withdraw: "took back from review" };

/** Page workflow. Editor: submit (send for review) or withdraw. Website Admin / Super Admin: publish, request changes, discard, unpublish. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, id));
  if (!p || p.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, p.websiteId);
  if (!role || !canEdit(role)) return fail("Forbidden", 403);
  // Editors may also throw away their own saved draft, as long as it is not waiting for review.
  const editorAction = d.action === "submit" || d.action === "withdraw" || (d.action === "discard" && p.reviewState !== "WAITING");
  if (!editorAction && !canPublish(role)) return fail("You can send this page for review. Only a Website Admin can publish it.", 403);
  const c = readContent(p.content);

  const clear = { reviewState: "", reviewNote: "", reviewAt: new Date() };
  let patch: Partial<typeof schema.pages.$inferInsert>;
  if (d.action === "submit") {
    if (!hasUnpublished(c)) return fail("There are no changes to send. Edit some text and save it first.", 422);
    if (p.reviewState === "WAITING") return fail("This page is already waiting for review.", 409);
    patch = { reviewState: "WAITING", reviewNote: "", reviewBy: user.id, reviewAt: new Date() };
  } else if (d.action === "withdraw") {
    if (p.reviewState !== "WAITING") return fail("This page is not waiting for review.", 409);
    if (!canPublish(role) && p.reviewBy !== user.id) return fail("Only the person who sent it can take it back.", 403);
    patch = clear;
  } else if (d.action === "request_changes") {
    if (!d.note?.trim()) return fail("Write what needs to change.", 422);
    if (p.reviewState !== "WAITING") return fail("This page is not waiting for review.", 409);
    patch = { reviewState: "CHANGES", reviewNote: d.note.trim(), reviewAt: new Date() };
  } else if (d.action === "publish") patch = { ...clear, status: "PUBLISHED", publishedAt: new Date(), content: writeContent({ ...c, published: { ...c.draft } }) };
  else if (d.action === "unpublish") patch = { status: "UNPUBLISHED" };
  else patch = { ...clear, content: writeContent({ ...c, draft: { ...c.published } }) };

  await db.update(schema.pages).set(patch).where(eq(schema.pages.id, id));
  const [site] = await db.select({ name: schema.websites.name }).from(schema.websites).where(eq(schema.websites.id, p.websiteId));
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: p.websiteId, action: "PAGE_" + d.action.toUpperCase(), entity: "page", entityId: id,
    summary: `${LABEL[d.action]} page "${p.title}" (${site?.name ?? ""})${d.note ? `: ${d.note.trim().slice(0, 140)}` : ""}` });
  return json({ ok: true });
});
