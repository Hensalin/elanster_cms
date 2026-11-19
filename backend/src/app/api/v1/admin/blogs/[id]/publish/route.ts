import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

const body = z.object({
  action: z.enum(["publish", "unpublish", "schedule", "submit", "request_changes"]),
  note: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  const [b] = await db.select().from(schema.blogs).where(eq(schema.blogs.id, id));
  if (!b || b.deletedAt) return fail("Not found", 404);
  const role = await websiteRole(user, b.websiteId);
  if (!role) return fail("Forbidden", 403);
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
  return json(updated);
});
