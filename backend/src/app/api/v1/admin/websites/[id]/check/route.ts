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

  // Find the connection: the one-line script (in the page or in a shared .js file) or the older js/cms-config.js file.
  let url = "", slug = "", key = "", how = "";
  const oneLine = (t: string) => t.match(/(https?:\/\/[^"'\s]+)\/cms\.js["'][^]{0,200}?data-key["'],?\s*=?\s*["'](ek_[a-z0-9_]+)["']/i)
    || t.match(/src=["'](https?:\/\/[^"'\s]+)\/cms\.js["'][^>]*data-key=["'](ek_[a-z0-9_]+)["']/i);
  let m = oneLine(home.text);
  if (m) how = "the home page";
  if (!m) {
    const srcs = [...home.text.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)].map((x) => x[1]).filter((u) => !/^https?:\/\//i.test(u) || u.startsWith(base)).slice(0, 15);
    for (const s of srcs) { const f = await get(new URL(s, base + "/").href); m = f.ok ? oneLine(f.text) : null; if (m) { how = s.split("?")[0]; break; } }
  }
  if (m) { url = m[1].replace(/\/$/, ""); key = m[2]; slug = site.slug; }
  else {
    const cfg = await get(base + "/js/cms-config.js");
    if (cfg.ok && /ELANSTER_CMS/.test(cfg.text)) {
      how = "js/cms-config.js";
      url = (cfg.text.match(/url:\s*"([^"]*)"/)?.[1] ?? "").replace(/\/$/, "");
      slug = cfg.text.match(/site:\s*"([^"]*)"/)?.[1] ?? "";
      key = cfg.text.match(/key:\s*"([^"]*)"/)?.[1] ?? "";
    }
  }
  checks.push({ ok: !!how, label: how ? `CMS script found (in ${how})` : "CMS script found on the website", hint: how ? undefined : "Create a key under API keys, copy the script, paste it at the top of a .js file every page loads (or in the <head> of each page), push, and wait a minute." });
  if (!how) return done();
  checks.push({ ok: !!url && !!key, label: "Script has the CMS address and a key", hint: url && key ? undefined : "The script needs both the CMS address and a key." });
  if (how === "js/cms-config.js") checks.push({ ok: slug === site.slug || slug === site.id, label: `Connection file is for this website (“${site.slug}”)`, hint: slug === site.slug ? undefined : `The file says site: "${slug || "(empty)"}". Change it to site: "${site.slug}".` });
  if (!url || !key) return done();

  const me = await get(url + "/api/v1/websites", { "X-API-Key": key });
  let owner: { id?: string; slug?: string } | undefined; try { owner = (JSON.parse(me.text) as { id: string; slug: string }[])[0]; } catch { /* not JSON */ }
  const keyOk = me.ok && owner?.id === site.id;
  checks.push({ ok: keyOk, label: "Key works and belongs to this website",
    hint: keyOk ? undefined : me.status === 401 ? "The key is wrong, revoked, or its website is turned off. Create a new key under API keys." :
      owner?.slug ? `This key belongs to another website (“${owner.slug}”). Create a key for this website instead.` : `The CMS address in the file (${url || "empty"}) did not answer.` });

  const pgs = await db.select({ content: schema.pages.content }).from(schema.pages).where(eq(schema.pages.websiteId, id));
  const texts = pgs.reduce((n, p) => { try { return n + ((JSON.parse(p.content).fields ?? []) as { tag: string }[]).filter((f) => !f.tag.startsWith("seo")).length; } catch { return n; } }, 0);
  checks.push({ ok: texts > 0, label: texts ? `${texts} texts found on the website pages` : "Texts found on the website pages", hint: "Optional: click Sync pages on the Content page so the CMS reads the texts of every page." });
  const pub = await db.select({ id: schema.pages.id }).from(schema.pages).where(and(eq(schema.pages.websiteId, id), eq(schema.pages.status, "PUBLISHED")));
  checks.push({ ok: pub.length > 0, label: `${pub.length} page${pub.length === 1 ? "" : "s"} published`, hint: "Optional: publish a page to show CMS text on it." });
  return done();
});
