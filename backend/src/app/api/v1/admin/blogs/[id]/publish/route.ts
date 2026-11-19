import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { blogColumns, blogInput, blogWithRelations, checkBlogRefs, setBlogTags, uniqueBlogSlug } from "@/lib/blogs";
import { gitAfter } from "@/lib/gitpublish";
import { saveVersion } from "@/lib/ratelimit";
import { admin, fail, json } from "@/lib/http";

const body = z.object({
  action: z.enum(["publish", "unpublish", "schedule", "submit", "request_changes",
    "submit_changes", "withdraw_changes", "approve_changes", "reject_changes", "discard_changes"]),
  note: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// Git publishing runs after the answer is sent; give it time to finish on Vercel.
export const maxDuration = 60;
export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  const [b] = await db.select().from(schema.blogs).where(eq(schema.blogs.id, id));
  if (!b || b.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, b.websiteId);
  if (!role) return fail("Forbidden", 403);
  // Suggested changes to a live article.
  if (d.action.endsWith("_changes") && d.action !== "request_changes") {
    const admin_ = canPublish(role); const mine = b.pendingBy === user.id;
    if (!b.pending) return fail("There are no suggested changes on this article.", 409);
    const log = (label: string, text: string) => Promise.all([
      db.insert(schema.publishingHistory).values({ blogId: id, userId: user.id, action: label, note: d.note ?? "" }),
      db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: "BLOG_" + label, entity: "blog", entityId: id, summary: `${text} "${b.title}"` })]);
    if (d.action === "submit_changes") {
      if (!mine && !admin_) return fail("Only the person who made these changes can send them.", 403);
      await db.update(schema.blogs).set({ pendingState: "WAITING", pendingAt: new Date(), reviewNote: "" }).where(eq(schema.blogs.id, id));
      await log("SUBMIT_CHANGES", "sent changes for review on");
    } else if (d.action === "withdraw_changes") {
      if (!mine && !admin_) return fail("Only the person who made these changes can take them back.", 403);
      await db.update(schema.blogs).set({ pendingState: "" }).where(eq(schema.blogs.id, id));
    } else if (d.action === "discard_changes") {
      if (!mine && !admin_) return fail("Only the person who made these changes, or an admin, can throw them away.", 403);
      await db.update(schema.blogs).set({ pending: null, pendingState: "", pendingBy: null }).where(eq(schema.blogs.id, id));
      await log("DISCARD_CHANGES", "threw away suggested changes on");
    } else {
      if (!admin_) return fail("Only a Website Admin can approve or send back changes.", 403);
      if (d.action === "reject_changes") {
        if (!d.note?.trim()) return fail("Write what needs to change", 422);
        await db.update(schema.blogs).set({ pendingState: "CHANGES", reviewNote: d.note.trim(), pendingAt: new Date() }).where(eq(schema.blogs.id, id));
        await log("REJECT_CHANGES", "asked for changes on");
      } else {   // approve: the suggested version becomes the live article
        const p = blogInput.safeParse(JSON.parse(b.pending));
        if (!p.success) return fail("The suggested changes could not be read. Ask the editor to save them again.", 422);
        const bad = await checkBlogRefs(p.data, b.websiteId); if (bad) return fail(bad, 422);
        const slug = p.data.slug ? await uniqueBlogSlug(b.websiteId, p.data.slug, b.id) : b.slug;
        await saveVersion("blog", b.id, b.websiteId, user.id, { title: b.title, excerpt: b.excerpt, content: b.content, seoTitle: b.seoTitle, metaDescription: b.metaDescription });
        await db.update(schema.blogs).set({ ...blogColumns(p.data), slug, pending: null, pendingState: "", reviewNote: "", pendingAt: new Date() }).where(eq(schema.blogs.id, id));
        await setBlogTags(id, b.websiteId, p.data.tags);
        await log("APPROVE_CHANGES", "approved and published changes on");
      }
    }
    if (d.action === "approve_changes") gitAfter(b.websiteId, `approve changes to article ${b.slug}`);
    return json(await blogWithRelations(id));
  }
  // Backend rule: only Super Admin / Website Admin can make content live.
  if (d.action !== "submit" && !canPublish(role)) return fail("You can submit this for review, but only a Website Admin can publish", 403);
  if (d.action === "publish" && !b.title.trim()) return fail("Add a title first", 422);

  const now = new Date();
  let patch: Partial<typeof schema.blogs.$inferInsert>;
  let label: string;
  if (d.action === "publish") { patch = { status: "PUBLISHED", publishedAt: b.publishedAt ?? now, scheduledAt: null, reviewNote: "" }; label = "PUBLISH"; }
  else if (d.action === "unpublish") { patch = { status: "UNPUBLISHED" }; label = "UNPUBLISH"; }
  else if (d.action === "submit") { patch = { status: "IN_REVIEW", reviewNote: "" }; label = "SUBMIT_REVIEW"; }
  else if (d.action === "request_changes") {
    if (!d.note?.trim()) return fail("Write what needs to change", 422);
    patch = { status: "DRAFT", reviewNote: d.note.trim() }; label = "REQUEST_CHANGES";
  }
  else {
    const when = d.scheduledAt ? new Date(d.scheduledAt) : null;
    if (!when || when.getTime() <= now.getTime()) return fail("Choose a date and time in the future", 422);
    patch = { status: "SCHEDULED", scheduledAt: when, publishedAt: when }; label = "SCHEDULE";
  }
  const [updated] = await db.update(schema.blogs).set(patch).where(eq(schema.blogs.id, id)).returning();
  await db.insert(schema.publishingHistory).values({ blogId: id, userId: user.id, action: label, note: d.note ?? "" });
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: b.websiteId, action: "BLOG_" + label, entity: "blog", entityId: id, summary: `${label.toLowerCase().replace("_", " ")}: "${b.title}"` });
  if (d.action === "publish" || d.action === "unpublish") gitAfter(b.websiteId, `${d.action} article ${b.slug}`);
  return json(updated);
});
