import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

/** Checks that the live website is really wired to this CMS, so "Published" is never a guess. */
export const GET = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  if (!(await websiteRole(user, id))) return fail("Forbidden", 403);
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, id));
  if (!site) return fail("Not found", 404);
  const checks: { ok: boolean; label: string; hint?: string }[] = [];
  const base = site.domain.replace(/\/$/, "");
  if (!base) return json([{ ok: false, label: "Website address is set", hint: "Use Connect website on the Pages screen." }]);
  const get = async (path: string) => { try { const r = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(8000) }); return r.ok ? await r.text() : null; } catch { return null; } };
  const home = await get("/");
  checks.push({ ok: !!home, label: "Website opens", hint: home ? undefined : "The address could not be reached." });
  checks.push({ ok: !!home && home.includes("data-cms="), label: "Website pages are tagged for the CMS", hint: "Push the latest website files (tagged pages) to your website repository." });
  const cfg = await get("/js/cms-config.js");
  const url = cfg?.match(/url:\s*"([^"]*)"/)?.[1] ?? "", key = cfg?.match(/key:\s*"([^"]*)"/)?.[1] ?? "";
  const origin = new URL(req.url).origin;
  checks.push({ ok: !!url && url.replace(/\/$/, "") === origin, label: "Website points to this CMS", hint: `js/cms-config.js should have url: "${origin}"` });
  let keyOk = false;
  if (key) { const r = await fetch(`${origin}/api/v1/websites/${site.slug}`, { headers: { "X-API-Key": key } }).catch(() => null); keyOk = !!r?.ok; }
  checks.push({ ok: keyOk, label: "Website key is valid", hint: "Create a key in Websites → API keys and paste it in js/cms-config.js." });
  const pub = await db.select({ id: schema.pages.id }).from(schema.pages).where(and(eq(schema.pages.websiteId, id), eq(schema.pages.status, "PUBLISHED")));
  checks.push({ ok: pub.length > 0, label: `${pub.length} page(s) published`, hint: "Publish a page to make the live website use CMS text." });
  return json(checks);
});
