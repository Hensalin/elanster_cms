import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getHead, listTree, readFile } from "./github";
import { safeFetch, sniffImage } from "./netguard";
import { type PageField } from "./pagecontent";
import { cleanHtml } from "./sanitize";
import { GENERATED, autoFields, readPage, savePages } from "./sitescan";

/* "Connect by GitHub": the website's own files in its GitHub repo are the source.
   The CMS reads the pages and the blog from the repo (nothing is added to the website's code),
   edits are saved in the CMS, and Publish writes the changed files back to the same repo. */

const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", middot: "·", hellip: "…", copy: "©" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const plain = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const meta = (h: string, attr: string, name: string) => {
  const t = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${name}["'][^>]*>`, "i").exec(h)?.[0]; return t ? decode(/\bcontent=["']([^"']*)["']/i.exec(t)?.[1] ?? "") : "";
};
const SKIP_DIR = /(^|\/)(\.|node_modules\/|vendor\/|_next\/|dist\/assets\/)/;

/** The folder that holds one HTML file per article: the folder the website's own links point into most ("blog", "blogs", "news"…). */
export function findArticleDir(pages: string[], exists: (p: string) => boolean): string | null {
  const count = new Map<string, number>();
  for (const h of pages) for (const m of h.matchAll(/href=["'](?:\.\.\/|\/)?([a-z0-9_-]{1,40})\/([a-z0-9][a-z0-9_-]{0,120})\.html?["']/gi))
    if (exists(`${m[1]}/${m[2]}.html`)) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type FoundArticle = { slug: string; title: string; excerpt: string; content: string; date: Date | null; image: string | null; alt: string; category: string; author: string };
/** Reads one article file: title, summary, text, date, cover picture, category and author. */
export function readArticle(path: string, html: string): FoundArticle | null {
  const slug = /([^/]+)\.html?$/i.exec(path)?.[1]?.toLowerCase(); if (!slug) return null;
  let ld: Record<string, unknown> = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const walk = (n: unknown): void => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) { n.forEach(walk); return; }
      const o = n as Record<string, unknown>; if (/BlogPosting|Article|NewsArticle/.test(String(o["@type"] ?? "")) && !Object.keys(ld).length) ld = o; Object.values(o).forEach(walk); };
    walk(JSON.parse(m[1])); } catch { /* not JSON */ }
  }
  const main = /<main\b[\s\S]*<\/main>/i.exec(html)?.[0] ?? html;
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(main)?.[1];
  const title = (h1 ? plain(h1) : "") || String(ld.headline ?? "") || meta(html, "property", "og:title") || plain(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").split(/\s[|·—–-]\s/)[0];
  if (!title) return null;
  const art = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(main)?.[1] ?? "";
  const content = art.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").trim();
  const dateTxt = String(ld.datePublished ?? "") || meta(html, "property", "article:published_time") || (/<time\b[^>]*datetime=["']([^"']+)["']/i.exec(main)?.[1] ?? "")
    || (/\b([A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]{2,8} \d{4})\b/.exec(plain(main.slice(0, 6000)))?.[1] ?? "");
  const date = dateTxt && !isNaN(+new Date(dateTxt)) ? new Date(dateTxt) : null;
  // cover: og:image, else the first picture between the title and the article text
  const before = h1 && art ? main.slice(main.indexOf(h1), main.indexOf(art)) : "";
  const coverTag = /<img\b[^>]*>/i.exec(before)?.[0] ?? "";
  const image = meta(html, "property", "og:image") || (/\bsrc=["']([^"']+)["']/i.exec(coverTag)?.[1] ?? "") || null;
  const alt = decode(/\balt=["']([^"']*)["']/i.exec(coverTag)?.[1] ?? "");
  const head = art ? main.slice(0, main.indexOf(art)) : main.slice(0, 6000);   // the label sits near the title (before or after it)
  const tagEl = /<(?:span|small|em|a|p)\b[^>]*class=["'][^"']*(?:^|[\s_-])(?:tag|category|cat|badge)(?:$|[\s_"'-])[^"']*["'][^>]*>([^<]{2,40})</i.exec(head.slice(head.search(/<main\b/i) >= 0 ? head.search(/<main\b/i) : 0))?.[1];
  const category = String(ld.articleSection ?? "") || (tagEl ? plain(tagEl) : "");
  const au = ld.author as { name?: string } | string | undefined;
  const author = (typeof au === "string" ? au : au?.name) || (/\bBy\s+([A-Z][^·|<\n]{1,40})/.exec(plain(main.slice(0, 8000)))?.[1]?.trim() ?? "");
  return { slug, title, excerpt: meta(html, "name", "description") || String(ld.description ?? ""), content, date, image, alt, category, author };
}

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const resolve = (from: string, ref: string) => {
  const parts = from.split("/").slice(0, -1);
  for (const p of ref.split("/")) { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); }
  return parts.join("/");
};

/** Reads the website from its GitHub repo into the CMS: pages (with their texts and pictures) and blog articles.
    Safe to repeat: edits already made are kept; files a person changed in GitHub are read again as they are now. */
export async function syncFromGit(websiteId: string, userId: string | null) {
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, websiteId));
  if (!site) throw new Error("Website not found");
  if (!site.gitRepo) throw new Error("This website has no GitHub repository yet.");
  const repo = site.gitRepo, head = await getHead(repo, site.gitBranch || "main");
  const files = await listTree(repo, head.tree);
  const blob = new Map(files.map((f) => [f.path, f]));
  const htmlPaths = files.filter((f) => /\.html?$/i.test(f.path) && !SKIP_DIR.test(f.path) && f.size < 3_000_000).map((f) => f.path).slice(0, 120);
  if (!htmlPaths.length) throw new Error(`No .html files were found in ${repo}. Is this the website's repository?`);

  const text = new Map<string, string>();
  for (let i = 0; i < htmlPaths.length; i += 8)
    await Promise.all(htmlPaths.slice(i, i + 8).map(async (p) => { const b = await readFile(repo, p, head.commit); if (b) text.set(p, b.toString("utf8")); }));

  const rows = await db.select().from(schema.gitFiles).where(eq(schema.gitFiles.websiteId, websiteId));
  const st = new Map(rows.map((r) => [r.path, r]));
  const roots = htmlPaths.filter((p) => !p.includes("/"));
  const dir = findArticleDir(roots.map((p) => text.get(p) ?? ""), (p) => blob.has(p));
  const isArticle = (p: string) => !!dir && p.startsWith(dir + "/") && p.split("/").length === 2;

  // ---- pages
  const pages: ReturnType<typeof readPage>["page"][] = []; const glob = new Map<string, PageField>(); const plainPages: { page: ReturnType<typeof readPage>["page"]; html: string }[] = [];
  for (const path of htmlPaths) {
    if (isArticle(path)) continue;
    const now = text.get(path); if (!now) continue;
    if (GENERATED.test(now) && !st.get(path)?.original) continue;   // a page the CMS made itself (e.g. an old article page)
    const rec = st.get(path), sha = blob.get(path)!.sha;
    // The CMS's own published version still in GitHub: read the original words it was made from.
    // Changed in GitHub by a person (or new): what is in GitHub now becomes the original.
    let html = now;
    if (rec?.kind === "page" && rec.original && rec.lastSha === sha) html = rec.original;
    else if (!rec || rec.kind === "page") {
      if (rec) await db.update(schema.gitFiles).set({ original: now, lastSha: sha, updatedAt: new Date() }).where(and(eq(schema.gitFiles.websiteId, websiteId), eq(schema.gitFiles.path, path)));
      else await db.insert(schema.gitFiles).values({ websiteId, path, kind: "page", original: now, lastSha: sha });
    }
    const r = readPage("/" + path, html); if (pages.some((p) => p.slug === r.page.slug)) continue;
    pages.push(r.page); r.global.forEach((g) => { if (!glob.has(g.key)) glob.set(g.key, g); });
    if (!r.tagged) plainPages.push({ page: r.page, html });
  }
  autoFields(plainPages, glob);
  if (!pages.length) throw new Error("No pages were found in the repository.");
  const list = [...pages, ...(glob.size ? [{ slug: "_global", title: "Header & footer", file: null, fields: [...glob.values()] }] : [])];
  const { created, updated } = await savePages(websiteId, list);
  const removed = (await db.update(schema.pages).set({ deletedAt: new Date() })
    .where(and(eq(schema.pages.websiteId, websiteId), isNull(schema.pages.deletedAt), notInArray(schema.pages.slug, list.map((p) => p.slug)))).returning({ id: schema.pages.id })).length;

  // ---- blog: one article per file in the article folder (articles the CMS already has are left as they are)
  let added = 0; const problems: string[] = [];
  if (dir) {
    const have = new Set((await db.select({ slug: schema.blogs.slug }).from(schema.blogs).where(eq(schema.blogs.websiteId, websiteId))).map((b) => b.slug));
    for (const path of htmlPaths.filter(isArticle)) {
      const h = text.get(path); if (!h) continue;
      const a = readArticle(path, h); if (!a || have.has(a.slug)) continue;
      if (GENERATED.test(h)) continue;   // the CMS's own page for an article it no longer has
      try {
        let categoryId: string | null = null;
        if (a.category) {
          const cs = slugify(a.category);
          const [c] = await db.select().from(schema.categories).where(and(eq(schema.categories.websiteId, websiteId), eq(schema.categories.slug, cs)));
          categoryId = c?.id ?? (await db.insert(schema.categories).values({ websiteId, name: a.category, slug: cs }).returning())[0].id;
        }
        let featuredImageId: string | null = null;
        if (a.image) {
          try {
            let buf: Buffer | null = null;
            if (/^https?:\/\//i.test(a.image)) { const r = await safeFetch(a.image, { maxBytes: 8_000_000, timeoutMs: 12000 }); buf = r.ok ? r.buf : null; }
            else { const p = a.image.startsWith("/") ? a.image.slice(1) : resolve(path, a.image); buf = await readFile(repo, p.split("?")[0], head.commit); }
            const type = buf ? sniffImage(buf) : null;
            if (buf && type) featuredImageId = (await db.insert(schema.media).values({ websiteId, filename: a.slug.slice(0, 60) + ".jpg", originalName: a.slug.slice(0, 60) + ".jpg",
              mimeType: type, size: buf.length, altText: a.alt || a.title, folder: "blog", data: buf }).returning())[0].id;
          } catch (e) { problems.push(`picture for “${a.title.slice(0, 40)}”: ${(e as Error).message}`); }
        }
        await db.insert(schema.blogs).values({ websiteId, title: a.title.slice(0, 300), slug: a.slug, excerpt: a.excerpt.slice(0, 500), content: a.content ? cleanHtml(a.content) : "",
          status: "PUBLISHED", publishedAt: a.date ?? new Date(), authorId: userId, authorName: a.author.slice(0, 80), categoryId, featuredImageId });
        // The CMS now writes this file on Publish (from the website's own article design), and removes it if the article is unpublished.
        const rec = st.get(path);
        if (!rec) await db.insert(schema.gitFiles).values({ websiteId, path, kind: "article", original: null, lastSha: blob.get(path)!.sha });
        added++; have.add(a.slug);
      } catch (e) { problems.push(`“${a.title.slice(0, 40)}”: ${(e as Error).message}`); }
    }
  }
  await db.update(schema.websites).set({ gitStatus: "OK", gitMessage: `Read from ${repo}: ${list.length} pages${dir ? `, blog folder ${dir}/` : ""}${added ? `, ${added} articles` : ""}.`, gitAt: new Date() })
    .where(and(eq(schema.websites.id, websiteId), eq(schema.websites.gitStatus, ""))).catch(() => {});
  await db.insert(schema.activityLogs).values({ userId, websiteId, action: "PAGES_IMPORT", entity: "page", entityId: websiteId,
    summary: `Synced from GitHub ${repo}: ${list.length} pages (${created} new${removed ? `, ${removed} removed` : ""})${added ? `, ${added} articles brought in` : ""}` });
  return { source: "git" as const, repo, created, updated, removed, blogFolder: dir, posts: { found: dir ? htmlPaths.filter(isArticle).length : 0, added, filled: 0, problems },
    pages: list.map((p) => ({ slug: p.slug, title: p.title, fields: p.fields.length })), untagged: plainPages.map((p) => p.page.slug) };
}
