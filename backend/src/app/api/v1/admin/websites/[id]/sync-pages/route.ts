import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canPublish, websiteRole } from "@/lib/auth";
import { syncFromGit } from "@/lib/gitsync";
import { admin, fail, json } from "@/lib/http";
import { syncPages } from "@/lib/sitescan";

export const maxDuration = 60;
/** Brings in the website's pages (and blog): from its GitHub repository when connected by GitHub, else from the live address.
    Safe to repeat: edits are kept. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const { id } = await params;
  if (!canPublish(await websiteRole(user, id))) return fail("Only a Website Admin can sync pages", 403);
  const [site] = await db.select({ repo: schema.websites.gitRepo }).from(schema.websites).where(eq(schema.websites.id, id));
  try { return json(site?.repo ? await syncFromGit(id, user.id) : await syncPages(id, user.id)); } catch (e) { return fail((e as Error).message, 422); }
});
