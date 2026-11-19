import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { admin, fail, json } from "@/lib/http";
import { gitPublish } from "@/lib/gitpublish";
import { hasToken } from "@/lib/github";
import { findCopies, removeCopies } from "@/lib/sitescan";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 60;

const info = async (id: string) => {
  const [s] = await db.select().from(schema.websites).where(eq(schema.websites.id, id));
  if (!s || s.deletedAt) return null;
  const c = await findCopies(id);
  return { repo: s.gitRepo, branch: s.gitBranch, enabled: !!s.gitRepo, tokenSet: hasToken(), status: s.gitStatus, message: s.gitMessage, commit: s.gitCommit, at: s.gitAt,
    copies: { articles: c.articles.length, pages: c.pages.length, examples: c.articles.slice(0, 3).map((b) => b.slug) } };
};

/** Git publishing status of one website (Super Admin). */
export const GET = admin<Ctx>(async (_r, { params }) => {
  const i = await info((await params).id);
  return i ? json(i) : fail("Not found", 404);
}, { superOnly: true });

/** "Publish to Git now" (retry / first run) or "Take over this file" after someone edited it directly in Git. */
export const POST = admin<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const d = z.object({ action: z.enum(["publish", "take_over", "remove_copies"]), file: z.string().max(200).optional() }).parse(await req.json());
  if (!(await info(id))) return fail("Not found", 404);
  if (d.action === "remove_copies") {
    const n = await removeCopies(id);
    await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "REMOVE_COPIES", entity: "website", entityId: id, summary: `Hid ${n.articles} copied article(s) and ${n.pages} copied page(s) made by the sync` });
    const r = (await info(id))!.enabled ? await gitPublish(id, { why: "remove copied articles" }) : null;
    return json({ removed: n, ...(r ?? {}), ...(await info(id)) });
  }
  if (d.action === "take_over" && !d.file) return fail("Choose the file to take over", 422);
  const r = await gitPublish(id, { why: d.action === "take_over" ? `take over ${d.file}` : "publish now", force: d.file ? [d.file] : [] });
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "GIT_" + d.action.toUpperCase(), entity: "website", entityId: id, summary: `Git publish (${d.action}): ${r.status}${r.files ? `, ${r.files} file(s)` : ""}` });
  return json({ ...r, ...(await info(id)) });
}, { superOnly: true });
