import { canPublish, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { syncPages } from "@/lib/sitescan";

/** Brings in every page the live website has right now (Framer-style). Safe to repeat: edits are kept. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const { id } = await params;
  if (!canPublish(await websiteRole(user, id))) return fail("Only a Website Admin can sync pages", 403);
  try { return json(await syncPages(id, user.id)); } catch (e) { return fail((e as Error).message, 422); }
});
