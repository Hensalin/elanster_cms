import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { validBranch, validRepo } from "@/lib/github";
import { gitPublish } from "@/lib/gitpublish";
import { admin, fail, json, normDomain } from "@/lib/http";
import { syncPages } from "@/lib/sitescan";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({
  name: z.string().min(2).max(80), domain: z.string().max(200), active: z.boolean(),
  gitRepo: z.string().max(201).refine((r) => r === "" || validRepo(r), "Write the repository as owner/name, for example Hensalin/elanster_website-demo"),
  gitBranch: z.string().max(100).refine((b) => validBranch(b), "That branch name is not valid"),
}).partial();

export const PUT = admin<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const d = body.parse(await req.json());
  if (d.domain !== undefined) {
    d.domain = normDomain(d.domain);
    if (d.domain) { const [same] = await db.select().from(schema.websites).where(and(eq(schema.websites.domain, d.domain), ne(schema.websites.id, id), isNull(schema.websites.deletedAt)));
      if (same) return fail(`This address is already connected as “${same.name}”. One address = one website — remove that one first.`, 409); }
  }
  if (d.gitRepo !== undefined) d.gitRepo = d.gitRepo.trim();
  // Turning Git publishing off: the pages are written once more without "content only from Git", so the website shows CMS changes again.
  let gitOff: string | null = null;
  if (d.gitRepo === "") { const [cur] = await db.select({ repo: schema.websites.gitRepo }).from(schema.websites).where(eq(schema.websites.id, id));
    if (cur?.repo) { const r = await gitPublish(id, { why: "turn off Git publishing", unmark: true }); gitOff = r.status === "FAILED" ? r.message : null; } }
  const [site] = await db.update(schema.websites).set(d).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "WEBSITE_UPDATE", entity: "website", entityId: id, summary: `Updated website ${site.name}` });
  // New address → bring in that website's pages straight away (Framer-style).
  let sync = null;
  if (d.domain && site.active) { try { sync = await syncPages(id, user.id); } catch (e) { sync = { error: (e as Error).message }; } }
  return json({ ...site, sync, ...(gitOff ? { gitWarning: `Git publishing was turned off, but the last write failed: ${gitOff}` } : {}) });
}, { superOnly: true });

export const DELETE = admin<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const [site] = await db.update(schema.websites).set({ deletedAt: new Date(), active: false }).where(eq(schema.websites.id, id)).returning();
  if (!site) return fail("Not found", 404);
  await db.insert(schema.activityLogs).values({ userId: user.id, action: "WEBSITE_DELETE", entity: "website", entityId: id, summary: `Removed website ${site.name}` });
  return json({ ok: true });
}, { superOnly: true });
