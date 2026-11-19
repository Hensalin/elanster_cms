import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

type Check = { ok: boolean; label: string; hint?: string };

/** Checks, step by step, that the live website is really reading from this CMS. */
export const GET = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, user) => {
  const { id } = await params;
  if (!(await websiteRole(user, id))) return fail("Forbidden", 403);
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, id));
  if (!site) return fail("Not found", 404);
  const checks: Check[] = [];
  const done = () => json(checks);
  const base = site.domain.trim().replace(/\/$/, "");
  checks.push({ ok: !!base, label: "Website address is set", hint: base ? undefined : "Click the link icon next to this website and enter its address, e.g. https://www.example.com" });
  if (!base) return done();
  if (!site.active) { checks.push({ ok: false, label: "Website is turned on in the CMS", hint: "Click the power icon to turn it on. While it is off, the website cannot read anything." }); return done(); }

  const get = async (u: string, headers?: Record<string, string>) => {
    try { const r = await fetch(u, { cache: "no-store", headers, signal: AbortSignal.timeout(8000) }); return { ok: r.ok, status: r.status, text: await r.text() }; }
    catch { return { ok: false, status: 0, text: "" }; }
  };
  const home = await get(base + "/");
  checks.push({ ok: home.ok, label: "Website opens", hint: home.ok ? undefined : `Could not open ${base}. Check the address is right and the site is online.` });
  if (!home.ok) return done();

  const cfg = await get(base + "/js/cms-config.js");
  const found = cfg.ok && /ELANSTER_CMS/.test(cfg.text);
  checks.push({ ok: found, label: "Connection file found (js/cms-config.js)", hint: found ? undefined : "Add js/cms-config.js to the website (Pages → Website connection → Download connection file) and push it." });
  if (!found) return done();
  const url = (cfg.text.match(/url:\s*"([^"]*)"/)?.[1] ?? "").replace(/\/$/, "");
  const slug = cfg.text.match(/site:\s*"([^"]*)"/)?.[1] ?? "";
  const key = cfg.text.match(/key:\s*"([^"]*)"/)?.[1] ?? "";
  checks.push({ ok: !!url && !!key, label: "Connection file is filled in", hint: url && key ? undefined : "The file needs both the CMS address (url) and a key." });
  checks.push({ ok: slug === site.slug || slug === site.id, label: `Connection file is for this website (“${site.slug}”)`, hint: slug === site.slug ? undefined : `The file says site: "${slug || "(empty)"}". Change it to site: "${site.slug}".` });
  if (!url || !key) return done();

  const me = await get(url + "/api/v1/websites", { "X-API-Key": key });
  let owner: { id?: string; slug?: string } | undefined; try { owner = (JSON.parse(me.text) as { id: string; slug: string }[])[0]; } catch { /* not JSON */ }
  const keyOk = me.ok && owner?.id === site.id;
  checks.push({ ok: keyOk, label: "Key works and belongs to this website",
    hint: keyOk ? undefined : me.status === 401 ? "The key is wrong, revoked, or its website is turned off. Create a new key under API keys." :
      owner?.slug ? `This key belongs to another website (“${owner.slug}”). Create a key for this website instead.` : `The CMS address in the file (${url || "empty"}) did not answer.` });

  checks.push({ ok: home.text.includes("data-cms="), label: "Pages are prepared for CMS text", hint: "Optional: needed only for editing page text. Push the tagged page files to the website." });
  const pub = await db.select({ id: schema.pages.id }).from(schema.pages).where(and(eq(schema.pages.websiteId, id), eq(schema.pages.status, "PUBLISHED")));
  checks.push({ ok: pub.length > 0, label: `${pub.length} page${pub.length === 1 ? "" : "s"} published`, hint: "Optional: publish a page to show CMS text on it." });
  return done();
});
