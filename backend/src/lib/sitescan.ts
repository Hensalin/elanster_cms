import { and, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { manifestSchema, readContent, writeContent, type PageField } from "./pagecontent";
import { cleanHtml } from "./sanitize";
import { findImages, findTexts, kindOf, textHash } from "./pagetexts";
import { safeFetch, sniffImage } from "./netguard";

type Manifest = z.infer<typeof manifestSchema>;
type ScanPage = Manifest["pages"][number];

const get = async (url: string) => {
  try { const r = await safeFetch(url, { maxBytes: 4_000_000, headers: { "User-Agent": "ElansterCMS-PageSync/1.0" } }); return r.ok ? r.text() : null; } catch { return null; }
};
const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", middot: "·", hellip: "…", copy: "©", reg: "®", trade: "™", bull: "•", rarr: "→", larr: "←", times: "×", deg: "°", eacute: "é", laquo: "«", raquo: "»" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
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

/* Pages without data-cms markers: the CMS picks the texts itself (see pagetexts.ts). Each text gets a key made from its
   wording, so the website needs no changes: the CMS script finds the text on the live page by that original wording. */
/** Adds texts to pages that have no markers. Texts found on most pages (menu, footer) become shared "global" texts. */
function autoFields(found: { page: ScanPage; html: string }[], glob: Map<string, PageField>) {
  if (!found.length) return;
  // Pictures are fields too (tag "image", text = their original address), so they can be swapped from the CMS.
  const per = found.map((f) => ({ ...f, texts: [...findTexts(f.html), ...findImages(f.html).map((i) => ({ tag: "image", text: i.src, section: i.section, alt: i.alt }))] }));
  const count = new Map<string, number>();
  per.forEach((p) => new Set(p.texts.map((t) => t.tag + "\u0000" + t.text)).forEach((k) => count.set(k, (count.get(k) ?? 0) + 1)));
  const min = Math.max(2, Math.round(found.length * 0.6));
  for (const p of per) {
    const have = new Set(p.page.fields.map((f) => f.key));
    for (const t of p.texts) {
      const shared = found.length > 1 && (count.get(t.tag + "\u0000" + t.text) ?? 0) >= min;
      const k = t.tag === "image" ? "img" : t.tag;
      const key = shared ? `global.${k}.${textHash(t.text)}` : `${p.page.slug}.${k}.${textHash(t.text)}`;
      const label = t.tag === "image" ? ("alt" in t && t.alt ? `Image: ${String(t.alt).slice(0, 40)}` : "Image") : kindOf(t.tag);
      const f: PageField = { key, label, group: shared ? `${t.section} (every page)` : t.section, tag: t.tag, text: t.text };
      if (shared) { if (!glob.has(key)) glob.set(key, f); }
      else if (!have.has(key)) { have.add(key); p.page.fields.push(f); }
    }
  }
}

type FoundPost = { slug: string; title: string; excerpt: string; category?: { name: string; slug: string }; image?: string; alt?: string; date?: string; url?: string; content?: string };
const COLORS: Record<string, string> = { "ai-strategy": "orange", "ai-economics": "blue", "ai-engineering": "lime" };

/** Pages and article files written by Git publishing carry this tag. The sync never reads them back as pages or articles
    (otherwise every sync would bring the CMS's own article pages in again as new "article-…" articles). */
export const GENERATED = /<meta\s+name=["']generator["']\s+content=["']Elanster CMS["']/i;
/** "article-article-my-post" → "my-post": the address Git publishing gives an article page, back to the article's own address. */
export const baseSlug = (s: string) => s.replace(/^(?:article-)+/, "");

/** Finds the blog articles a website already shows: schema.org BlogPosting data, or the article list in its blog script. */
export async function findPosts(base: string, htmls: string[]): Promise<FoundPost[]> {
  const posts = new Map<string, FoundPost>();
  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  // 1) schema.org BlogPosting / Article blocks
  for (const html of htmls) for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n: unknown): void => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) { n.forEach(walk); return; }
        const o = n as Record<string, any>; const t = ([] as string[]).concat(o["@type"] ?? []);
        if (t.some((x) => /BlogPosting|Article|NewsArticle/.test(x)) && o.headline) {
          const url = String(o.url ?? o["@id"] ?? "").replace(/#.*$/, "");
          // Address of the article: ?slug=… (script-built pages) or the file name (static pages like /blogs/my-post.html).
          const slug = url.match(/[?&]slug=([^&#]+)/)?.[1] ?? url.match(/\/([a-z0-9][a-z0-9_-]*)\.html?$/i)?.[1]?.toLowerCase() ?? slugify(String(o.headline));
          posts.set(slug, { slug, title: String(o.headline), excerpt: String(o.description ?? ""), image: typeof o.image === "string" ? o.image : o.image?.url, date: o.datePublished,
            url: /\.html?$/i.test(url) ? url : undefined });
        }
        Object.values(o).forEach(walk); };
      walk(JSON.parse(m[1]));
    } catch { /* not valid JSON */ }
  }
  // 2) The article list inside the site's blog script (e.g. js/blog.js)
  const srcs = new Set<string>(); for (const html of htmls) for (const m of html.matchAll(/<script[^>]+src="([^"]*blog[^"]*\.js[^"]*)"/gi)) srcs.add(new URL(m[1], base + "/").toString());
  for (const src of srcs) {
    const js = await get(src); if (!js) continue;
    for (const m of js.matchAll(/\{\s*slug:\s*"([^"]+)",\s*title:\s*"([^"]+)"((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      const [, slug, title, rest] = m;
      const pick = (k: string) => rest.match(new RegExp(k + ':\\s*"([^"]*)"'))?.[1];
      const cat = rest.match(/category:\s*\{\s*name:\s*"([^"]+)",\s*slug:\s*"([^"]+)"/);
      const fromJs: FoundPost = { slug, title, excerpt: pick("excerpt") ?? "", image: pick("image"), alt: pick("alt"), category: cat ? { name: cat[1], slug: cat[2] } : undefined };
      // The same article can be described twice (structured data + script): combine them, filling any gaps.
      const sameTitle = [...posts.values()].find((p) => p.title.toLowerCase() === title.toLowerCase());
      const prev = posts.get(slug) ?? sameTitle;
      if (prev) posts.delete(prev.slug);
      posts.set(slug, prev ? { ...fromJs, title: prev.title || title, excerpt: prev.excerpt || fromJs.excerpt, image: prev.image || fromJs.image,
        alt: prev.alt || fromJs.alt, category: prev.category || fromJs.category, date: prev.date } : fromJs);
    }
  }
  // Static article pages (one HTML file per article): read their text, summary and picture too.
  const host = new URL(base).host; const list = [...posts.values()].slice(0, 50);
  await Promise.all(list.map(async (p) => {
    if (!p.url) return;
    let u: URL; try { u = new URL(p.url, base + "/"); } catch { return; }
    const page = await get(u.host === host ? u.toString() : base + u.pathname); if (!page) return;
    const art = page.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
    if (art) p.content = art.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").trim();
    p.excerpt ||= decode(page.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "");
    p.image ||= page.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
  }));
  return list;
}

/** /article-<x>.html where <x> is an article of this website in the CMS: a page Git publishing made (also before the tag existed). */
async function isOwnArticlePage(websiteId: string, path: string) {
  const m = /^\/?article-([a-z0-9][a-z0-9-]*)\.html$/i.exec(path); if (!m) return false;
  const [b] = await db.select({ id: schema.blogs.id }).from(schema.blogs).where(and(eq(schema.blogs.websiteId, websiteId), eq(schema.blogs.slug, baseSlug(m[1]))));
  return !!b;
}

/** Copies made by the bug above: articles "article-…-<x>" and pages "article-…-<x>" while article <x> exists. Hidden (soft delete), not erased. */
export async function findCopies(websiteId: string) {
  const blogs = await db.select({ id: schema.blogs.id, slug: schema.blogs.slug, title: schema.blogs.title, content: schema.blogs.content }).from(schema.blogs).where(and(eq(schema.blogs.websiteId, websiteId), isNull(schema.blogs.deletedAt)));
  const real = new Set(blogs.map((b) => b.slug).filter((s) => s === baseSlug(s)));
  // A copy: named "article-…<x>" while article <x> exists, or named "article-…" with a whole published CMS page as its text
  // (back link + "Keep reading" cards), which only the old sync could produce.
  const wholePage = (c: string) => /art__back|All articles/.test(c) && /Keep reading/.test(c);
  const articles = blogs.filter((b) => b.slug !== baseSlug(b.slug) && (real.has(baseSlug(b.slug)) || wholePage(b.content ?? ""))).map(({ content: _c, ...b }) => b);
  const pages = (await db.select({ id: schema.pages.id, slug: schema.pages.slug }).from(schema.pages).where(and(eq(schema.pages.websiteId, websiteId), isNull(schema.pages.deletedAt))))
    .filter((p) => /^article-/.test(p.slug) && real.has(baseSlug(p.slug)));
  return { articles, pages };
}
export async function removeCopies(websiteId: string) {
  const c = await findCopies(websiteId); const now = new Date();
  for (const b of c.articles) await db.update(schema.blogs).set({ deletedAt: now }).where(eq(schema.blogs.id, b.id));
  for (const p of c.pages) await db.update(schema.pages).set({ deletedAt: now }).where(eq(schema.pages.id, p.id));
  return { articles: c.articles.length, pages: c.pages.length };
}

/** Adds articles the website already shows but the CMS does not have yet (as live articles, with their photo). */
export async function importPosts(websiteId: string, base: string, htmls: string[], userId: string | null) {
  const found = await findPosts(base, htmls.filter((h) => !GENERATED.test(h))); let added = 0, filled = 0; const problems: string[] = [];
  const have = new Set((await db.select({ slug: schema.blogs.slug }).from(schema.blogs).where(eq(schema.blogs.websiteId, websiteId))).map((b) => b.slug));
  for (const p of found) { try {
    // An "article-<x>" page whose article <x> is already in the CMS is the CMS's own published page, not a new article.
    if (p.slug !== baseSlug(p.slug) && (have.has(baseSlug(p.slug)) || found.some((q) => q.slug === baseSlug(p.slug)))) continue;
    const [ex] = await db.select().from(schema.blogs).where(and(eq(schema.blogs.websiteId, websiteId), eq(schema.blogs.slug, p.slug)));
    // Already in the CMS: the CMS copy wins; only empty details (category, photo, summary) are filled in.
    if (ex && ex.categoryId && ex.featuredImageId && ex.excerpt && (ex.content || !p.content)) continue;
    let categoryId: string | null = null;
    if (p.category && !ex?.categoryId) {
      const [c] = await db.select().from(schema.categories).where(and(eq(schema.categories.websiteId, websiteId), eq(schema.categories.slug, p.category.slug)));
      categoryId = c?.id ?? (await db.insert(schema.categories).values({ websiteId, name: p.category.name, slug: p.category.slug, color: COLORS[p.category.slug] ?? "" }).returning())[0].id;
    }
    let featuredImageId: string | null = null;
    if (p.image && !ex?.featuredImageId) {
      try {
        const r = await safeFetch(new URL(p.image, base + "/"), { maxBytes: 8_000_000, timeoutMs: 12000 });
        const type = r.ok ? sniffImage(r.buf) : null;   // only real raster pictures (never SVG or HTML pretending to be an image)
        if (type) featuredImageId = (await db.insert(schema.media).values({ websiteId, filename: p.slug.slice(0, 60) + ".jpg", originalName: p.slug.slice(0, 60) + ".jpg",
            mimeType: type, size: r.buf.length, altText: p.alt ?? p.title, folder: "blog", data: r.buf }).returning())[0].id;
      } catch (e) { problems.push(`photo for “${p.title.slice(0, 40)}”: ${(e as Error).message}`); }
    }
    if (ex) {
      const patch = { categoryId: ex.categoryId ?? categoryId, featuredImageId: ex.featuredImageId ?? featuredImageId, excerpt: ex.excerpt || p.excerpt, content: ex.content || (p.content ? cleanHtml(p.content) : "") };
      if (patch.categoryId !== ex.categoryId || patch.featuredImageId !== ex.featuredImageId || patch.excerpt !== ex.excerpt || patch.content !== ex.content) {
        await db.update(schema.blogs).set(patch).where(eq(schema.blogs.id, ex.id)); filled++; }
      continue;
    }
    const when = p.date && !isNaN(+new Date(p.date)) ? new Date(p.date) : new Date();
    await db.insert(schema.blogs).values({ websiteId, title: p.title, slug: p.slug, excerpt: p.excerpt.slice(0, 500), content: p.content ? cleanHtml(p.content) : "", status: "PUBLISHED", publishedAt: when,
      authorId: userId, categoryId, featuredImageId });
    added++;
  } catch (e) { problems.push(`“${p.title.slice(0, 40)}”: ${(e as Error).message}`); } }
  return { found: found.length, added, filled, problems };
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
  let manifest: Manifest | null = null; let source: "manifest" | "scan" = "scan"; const untagged: string[] = []; const htmls: string[] = [home];
  const mf = await get(base + "/cms-manifest.json");
  if (mf) { try { const p = manifestSchema.safeParse(JSON.parse(mf)); if (p.success) { manifest = p.data; source = "manifest"; } } catch { /* not JSON */ } }
  if (!manifest) {
    const pages: ScanPage[] = []; const glob = new Map<string, PageField>(); const plainPages: { page: ScanPage; html: string }[] = [];
    // Files written by Git publishing contain the published edits; the sync must read them as they were before any CMS edit,
    // or the edited words would become the "original" ones and later edits would no longer find their place.
    const originals = new Map((await db.select({ path: schema.gitFiles.path, original: schema.gitFiles.original }).from(schema.gitFiles)
      .where(and(eq(schema.gitFiles.websiteId, websiteId), eq(schema.gitFiles.kind, "page")))).filter((r) => r.original).map((r) => [r.path, r.original!]));
    for (const path of await findPages(base, home)) {
      const file = path === "/" ? "index.html" : path.replace(/^\//, "");
      const html = originals.get(file) ?? (path === "/" ? home : await get(base + path)); if (!html) continue;
      if (GENERATED.test(html) || await isOwnArticlePage(websiteId, path)) continue;   // a page Git publishing made for an article
      if (path !== "/") htmls.push(html);
      // Article pages inside a folder (blogs/x.html) are articles, not pages: their text comes from the CMS article.
      if (/\/[^/]+\/[^/]+$/.test(path) && /<article\b/i.test(html)) continue;
      const r = readPage(path, html); if (pages.some((p) => p.slug === r.page.slug)) continue;
      pages.push(r.page); r.global.forEach((g) => { if (!glob.has(g.key)) glob.set(g.key, g); });
      if (!r.tagged) { untagged.push(r.page.slug); plainPages.push({ page: r.page, html }); }
    }
    autoFields(plainPages, glob);
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
  // Articles the website already shows come in too (only ones the CMS does not have yet).
  if (source === "manifest") for (const p of await findPages(base, home)) { if (/blog|insight|news|article/i.test(p) && !(await isOwnArticlePage(websiteId, p))) { const h = await get(base + p); if (h && !GENERATED.test(h)) htmls.push(h); } }
  const posts = await importPosts(websiteId, base, htmls, userId).catch((e) => ({ found: 0, added: 0, filled: 0, problems: [(e as Error).message] }));
  // Pages that are no longer on the website are hidden (they come back if the page returns).
  const removed = (await db.update(schema.pages).set({ deletedAt: new Date() })
    .where(and(eq(schema.pages.websiteId, websiteId), isNull(schema.pages.deletedAt), notInArray(schema.pages.slug, list.map((p) => p.slug)))).returning({ id: schema.pages.id })).length;
  await db.insert(schema.activityLogs).values({ userId, websiteId, action: "PAGES_IMPORT", entity: "page", entityId: websiteId,
    summary: `Synced from ${base}: ${list.length} pages (${created} new${removed ? `, ${removed} removed` : ""})${posts.added ? `, ${posts.added} articles brought in` : ""}` });
  return { source, created, updated, removed, posts, pages: list.map((p) => ({ slug: p.slug, title: p.title, fields: p.fields.length })), untagged };
}
