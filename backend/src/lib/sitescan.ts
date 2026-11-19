import { and, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { manifestSchema, readContent, writeContent, type PageField } from "./pagecontent";

type Manifest = z.infer<typeof manifestSchema>;
type ScanPage = Manifest["pages"][number];

const get = async (url: string) => {
  try { const r = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(9000), headers: { "User-Agent": "ElansterCMS-PageSync/1.0" } });
    return r.ok ? await r.text() : null; } catch { return null; }
};
const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
const plain = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const slugOf = (path: string) => { const f = path.replace(/^\/+/, "").replace(/\/$/, "").replace(/\.html?$/, "").replace(/\/index$/, ""); return !f || f === "index" ? "home" : f.replace(/\//g, "-"); };
const labelOf = (key: string, tag: string, text: string) => (text ? text.slice(0, 60) : key) + (tag === "a" ? " (link)" : "");

/** Finds every page of a website: from its sitemap.xml and the links on its home page. */
async function findPages(base: string, home: string) {
  const host = new URL(base).host; const paths = new Set<string>(["/"]);
  const add = (href: string) => {
    try { const u = new URL(href, base + "/"); if (u.host !== host) return; const p = u.pathname;
      if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|pdf|xml|json|txt|zip|woff2?|otf|mp4)$/i.test(p)) return;
      if (/(^|\/)(404|500)(\.html)?$/.test(p)) return; paths.add(p.replace(/\/index\.html$/, "/")); } catch { /* bad link */ }
  };
  const sm = await get(base + "/sitemap.xml");
  if (sm) for (const m of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) add(m[1]);
  for (const m of home.matchAll(/<a\b[^>]*href="([^"#?]+)[^"]*"/gi)) add(m[1]);
  return [...paths].slice(0, 40);
}

/** Reads the editable text of one page: everything tagged data-cms="key", plus its Google title/description. */
function readPage(path: string, html: string) {
  // The page's name in the CMS comes from its tags (data-cms="products.hero.1" → "products"), else from the file name.
  const prefixes = new Map<string, number>();
  for (const m of html.matchAll(/\sdata-cms(?:-img)?="([a-z0-9_-]+)\./gi)) if (m[1] !== "global") prefixes.set(m[1], (prefixes.get(m[1]) ?? 0) + 1);
  const top = [...prefixes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const slug = top ?? slugOf(path); const fields: PageField[] = []; const global: PageField[] = [];
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ;
  const desc = decode(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "");
  if (title) fields.push({ key: `${slug}.seo.title`, label: "Page title (Google)", group: "SEO", tag: "seo-title", text: title });
  if (desc) fields.push({ key: `${slug}.seo.description`, label: "Meta description (Google)", group: "SEO", tag: "seo-description", text: desc });
  const seen = new Set<string>();
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*?)\sdata-cms="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const [, tag, , key, , inner] = m; if (seen.has(key)) continue; seen.add(key);
    const text = plain(inner); const group = key.split(".")[1] ? key.split(".")[1].replace(/^\w/, (c) => c.toUpperCase()) : "Page";
    const f = { key, label: labelOf(key, tag.toLowerCase(), text), group, tag: tag.toLowerCase(), text };
    (key.startsWith("global.") ? global : fields).push(f);
  }
  const name = title.split(/\s[—|–-]\s/)[0].trim() || slug;
  return { page: { slug, title: slug === "home" ? "Home" : name, file: path === "/" ? "index.html" : path.replace(/^\//, ""), fields } as ScanPage, global, tagged: seen.size };
}

/** Framer-style sync: whatever pages the live website has now appear in the CMS. Edits already made are kept. */
export async function syncPages(websiteId: string, userId: string | null) {
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, websiteId));
  if (!site) throw new Error("Website not found");
  const base = site.domain.trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("Set the website address first (for example https://www.example.com).");
  const home = await get(base + "/");
  if (!home) throw new Error(`Could not open ${base}. Check the address and that the site is online.`);

  // 1) The site's own scan file, when it has a valid one. 2) Otherwise read the pages directly.
  let manifest: Manifest | null = null; let source: "manifest" | "scan" = "scan"; const untagged: string[] = [];
  const mf = await get(base + "/cms-manifest.json");
  if (mf) { try { const p = manifestSchema.safeParse(JSON.parse(mf)); if (p.success) { manifest = p.data; source = "manifest"; } } catch { /* not JSON */ } }
  if (!manifest) {
    const pages: ScanPage[] = []; const glob = new Map<string, PageField>();
    for (const path of await findPages(base, home)) {
      const html = path === "/" ? home : await get(base + path); if (!html) continue;
      const r = readPage(path, html); if (pages.some((p) => p.slug === r.page.slug)) continue;
      pages.push(r.page); r.global.forEach((g) => { if (!glob.has(g.key)) glob.set(g.key, g); });
      if (!r.tagged) untagged.push(r.page.slug);
    }
    if (!pages.length) throw new Error("No pages were found on the website.");
    manifest = { pages, ...(glob.size ? { global: { slug: "_global", title: "Header & footer", file: null, fields: [...glob.values()] } } : {}) };
  }

  const list = [...manifest.pages, ...(manifest.global ? [manifest.global] : [])];
  let created = 0, updated = 0;
  for (const p of list) {
    const [ex] = await db.select().from(schema.pages).where(and(eq(schema.pages.websiteId, websiteId), eq(schema.pages.slug, p.slug)));
    const keys = new Set(p.fields.map((f) => f.key));
    if (!ex) {
      await db.insert(schema.pages).values({ websiteId, title: p.title, slug: p.slug, status: "DRAFT", content: writeContent({ file: p.file ?? null, fields: p.fields, draft: {}, published: {} }) });
      created++;
    } else {
      const old = readContent(ex.content); const keep = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([k]) => keys.has(k)));
      await db.update(schema.pages).set({ title: p.title, deletedAt: null, content: writeContent({ file: p.file ?? null, fields: p.fields, draft: keep(old.draft), published: keep(old.published) }) }).where(eq(schema.pages.id, ex.id));
      updated++;
    }
  }
  // Pages that are no longer on the website are hidden (they come back if the page returns).
  const removed = (await db.update(schema.pages).set({ deletedAt: new Date() })
    .where(and(eq(schema.pages.websiteId, websiteId), isNull(schema.pages.deletedAt), notInArray(schema.pages.slug, list.map((p) => p.slug)))).returning({ id: schema.pages.id })).length;
  await db.insert(schema.activityLogs).values({ userId, websiteId, action: "PAGES_IMPORT", entity: "page", entityId: websiteId,
    summary: `Synced pages from ${base} (${created} new, ${updated} refreshed${removed ? `, ${removed} removed` : ""})` });
  return { source, created, updated, removed, pages: list.map((p) => ({ slug: p.slug, title: p.title, fields: p.fields.length })), untagged };
}
