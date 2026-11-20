import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";
import type { Article } from "./articlepage";
import { withAssets } from "./articlepage";

/* Websites whose articles are real files in a folder (We Are Zion: blogs/<slug>.html). The same rules as the website
   script (public/cms-content.js), done once on the server so the files themselves are right:
   - an article file gets the CMS title, meta line, cover picture and text;
   - article lists (blog page, "Latest", "Keep reading") follow the CMS, newest first. */

const isEl = (n: AnyNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";
const at = (n: AnyNode) => n as unknown as { startIndex: number | null; endIndex: number | null };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: unknown) => esc(s).replace(/"/g, "&quot;");
const text = (n: AnyNode): string => n.type === "text" ? (n as unknown as { data: string }).data : isEl(n) ? n.children.map(text).join("") : "";
const parse = (h: string) => parseDocument(h, { withStartIndices: true, withEndIndices: true, decodeEntities: true });
type Edit = { start: number; end: number; text: string };
function apply(html: string, edits: Edit[]) {
  let out = html, last = Infinity;
  for (const e of edits.sort((a, b) => b.start - a.start)) { if (e.end > last) continue; out = out.slice(0, e.start) + e.text + out.slice(e.end); last = e.start; }
  return out;
}
function all(n: AnyNode, ok: (e: Element) => boolean, out: Element[] = []): Element[] {
  if (isEl(n)) { if (ok(n)) out.push(n); n.children.forEach((c) => all(c, ok, out)); }
  else if ("children" in (n as object)) (n as unknown as { children: AnyNode[] }).children.forEach((c) => all(c, ok, out));
  return out;
}
const inside = (e: Element, names: string[]) => { for (let p = e.parent as Element | null; p && isEl(p); p = p.parent as Element | null) if (names.includes(p.name)) return true; return false; };
/** The range of an element's inside (between its start tag and end tag). */
function innerRange(html: string, e: Element) {
  const s = at(e).startIndex!, end = at(e).endIndex!;
  const open = html.indexOf(">", s) + 1, close = html.lastIndexOf("</", end);
  return { start: open, end: close > open ? close : open };
}
const openTag = (html: string, e: Element) => { const s = at(e).startIndex!; return { start: s, end: html.indexOf(">", s) + 1 }; };
function setAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(["'])[\\s\\S]*?\\2`, "i");
  return re.test(tag) ? tag.replace(re, (_m, pre: string) => `${pre}"${escAttr(value)}"`) : tag.replace(/\s*\/?>$/, (m) => ` ${name}="${escAttr(value)}"${m}`);
}
const dropAttr = (tag: string, name: string) => tag.replace(new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, "gi"), "");

export const fmtDate = (d: Date | string | null) => { if (!d) return ""; const x = new Date(d); return isNaN(+x) ? "" : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };
const minutes = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));

/** "blogs/water.html" → "water"; "article.html?article=x" → "x"; a link without a folder is not an article card. */
export function cardSlug(href: string): string | null {
  const q = /[?&]article=([^&#]+)/.exec(href); if (q) return decodeURIComponent(q[1]);
  const m = /(?:^|\/)([^/?#]+?)\.html?(?:[?#]|$)/.exec(href);
  return m && /\//.test(href) && !/^(https?:)?\/\//.test(href) ? m[1] : null;
}
/** The folder that holds the article files, found from the article links on the website's pages ("blogs"). */
export function articleDir(pages: string[], slugs: Set<string>): string | null {
  const count = new Map<string, number>();
  for (const h of pages) for (const m of h.matchAll(/href="(?:\.\.\/|\/)?([a-z0-9_-]{1,40})\/([a-z0-9][a-z0-9-]{0,100})\.html"/gi)) if (slugs.has(m[2])) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type Asset = (id: string) => string | null;

function fillCard(card: string, x: Article, isNew: boolean, href: string, asset: Asset, authorWas = ""): string {
  const d = parse(card); const root = d.children.find(isEl); if (!root) return card;
  const edits: Edit[] = [];
  const h = all(root, (e) => /^h[1-4]$/.test(e.name))[0];
  if (h && x.title) edits.push({ ...innerRange(card, h), text: esc(x.title) });
  const p = all(root, (e) => e.name === "p")[0];
  if (p && x.excerpt) edits.push({ ...innerRange(card, p), text: esc(x.excerpt) });
  const img = all(root, (e) => e.name === "img")[0];
  const url = x.featuredImage?.url ? withAssets(x.featuredImage.url, asset) : "";
  // the category label on the card (e.g. <span class="post__tag">AI Strategy</span>)
  const cat = x.category?.name;
  const tagEl = all(root, (e) => ["span", "small", "em"].includes(e.name) && /(?:^|[\s_-])(tag|category|cat|badge)(?:$|[\s_-])/i.test(e.attribs.class ?? "") && !e.children.some(isEl))[0];
  if (cat && tagEl) edits.push({ ...innerRange(card, tagEl), text: esc(cat) });
  if (img && url) { const t = openTag(card, img); let tag = card.slice(t.start, t.end); tag = setAttr(dropAttr(dropAttr(tag, "srcset"), "data-srcset"), "src", url); tag = setAttr(tag, "alt", x.featuredImage?.alt || x.title); edits.push({ ...t, text: tag }); }
  if (isNew) {
    const t = openTag(card, root); edits.push({ ...t, text: setAttr(card.slice(t.start, t.end), "href", href) });
    for (const n of all(root, (e) => ["span", "small", "time"].includes(e.name) && !all(e, (c) => c !== e && !["i", "svg"].includes(c.name) && isEl(c)).length)) {
      const tx = text(n).trim();
      if (/\b(19|20)\d\d\b/.test(tx)) edits.push({ ...innerRange(card, n), text: esc([fmtDate(x.publishedAt), /min read/i.test(tx) ? `${minutes(x.content ?? "")} min read` : ""].filter(Boolean).join(" · ")) });
      else if (/^By\s/i.test(tx)) {
        const who = x.author || authorWas; const r = innerRange(card, n);
        const icons = all(n, (c) => c !== n && ["i", "svg"].includes(c.name)).map((c) => card.slice(at(c).startIndex!, at(c).endIndex! + 1)).join("");
        edits.push({ ...r, text: who ? esc(`By ${who}`) + (icons ? " " + icons : "") : "" });
      }
    }
  }
  return apply(card, edits);
}

/** Rebuilds every article list on a page, newest first, like the website script. `here` = the article being read (left out). */
export function rebuildLists(html: string, arts: Article[], here: string | null, asset: Asset): string {
  const doc = parse(html);
  const cards = all(doc as unknown as AnyNode, (e) => e.name === "a" && !!e.attribs.href && !!cardSlug(e.attribs.href) && all(e, (c) => /^h[1-4]$/.test(c.name)).length > 0 && !inside(e, ["header", "nav", "footer"]));
  if (!cards.length) return html;
  const bySlug = new Map(arts.map((a) => [a.slug, a]));
  const page = new Map<string, string>(); for (const c of cards) { const s = cardSlug(c.attribs.href)!; if (!page.has(s)) page.set(s, c.attribs.href.replace(/[?#].*$/, "")); }
  if (![...page.keys()].some((s) => bySlug.has(s))) return html;   // not this website's articles
  const queue = arts.filter((a) => a.slug !== here);
  // The author shown on an existing card, for articles whose CMS author is empty (imported articles keep their writer).
  const authorOf = new Map<string, string>();
  for (const c of cards) for (const n of all(c, (e) => ["span", "small", "p"].includes(e.name))) { const m = /^By\s+(.+)$/i.exec(text(n).trim()); if (m) { authorOf.set(cardSlug(c.attribs.href)!, m[1].trim()); break; } }
  const groups: Element[] = []; for (const c of cards) { const g = c.parent as Element; if (!groups.includes(g)) groups.push(g); }
  const used = new Set<string>(); const edits: Edit[] = [];
  for (const g of groups) {
    const kids = g.children; const own = kids.filter((c) => cards.includes(c as Element)) as Element[];
    const first = kids.indexOf(own[0]), last = kids.indexOf(own[own.length - 1]);
    // Only a clean run of cards (with spaces between) is rebuilt; anything else in between would be lost, so it is left as it is.
    if (kids.slice(first, last + 1).some((c) => !cards.includes(c as Element) && !(c.type === "text" && !text(c).trim()) && c.type !== "comment")) continue;
    const full = own.length >= page.size - 2;
    const free = queue.filter((a) => !used.has(a.slug)); const want = full ? free : free.slice(0, own.length);
    const pool = new Map(own.map((c) => [cardSlug(c.attribs.href)!, c]));
    const tpl = own[0], tplHtml = html.slice(at(tpl).startIndex!, at(tpl).endIndex! + 1), tplHref = tpl.attribs.href.replace(/[?#].*$/, "");
    const sep = (() => { const t = kids[first + 1]; return t && t.type === "text" ? text(t) : ""; })();
    const out = want.map((a) => {
      used.add(a.slug);
      const c = pool.get(a.slug);
      const src = c ? html.slice(at(c).startIndex!, at(c).endIndex! + 1) : tplHtml;
      const href = page.get(a.slug) && /\.html?$/.test(page.get(a.slug)!) && cardSlug(page.get(a.slug)!) === a.slug ? page.get(a.slug)! : tplHref.replace(/[^/?#]+\.html?$/, `${a.slug}.html`);
      return fillCard(src, a, !c, href, asset, authorOf.get(a.slug) ?? "");
    });
    edits.push({ start: at(own[0]).startIndex!, end: at(own[own.length - 1]).endIndex! + 1, text: out.join(sep) });
  }
  return apply(html, edits);
}

/** Puts a CMS article into an article file of the website (its own file, or a copy of another article's file for a new one). */
export function renderInFile(html: string, a: Article, opts: { url: string; asset: Asset; siteName?: string; keepUrl?: boolean }): string {
  const doc = parse(html);
  const main = all(doc as unknown as AnyNode, (e) => e.name === "main")[0] ?? (doc as unknown as AnyNode);
  const body = all(main, (e) => e.name === "article" || e.attribs["data-cms-article"] !== undefined)[0];
  if (!body) throw new Error("this article file has no <article> area");
  const h = all(main, (e) => e.name === "h1")[0];
  const edits: Edit[] = [];
  const content = withAssets(a.content ?? "", opts.asset);
  if (content) edits.push({ ...innerRange(html, body), text: content });
  if (h && a.title) edits.push({ ...innerRange(html, h), text: esc(a.title) });
  // the date / reading time / author line under the title
  const parent = h?.parent as Element | undefined;
  const meta = parent ? (parent.children.slice(parent.children.indexOf(h!) + 1).find(isEl) as Element | undefined) : undefined;
  if (meta && /\b(19|20)\d\d\b|min read/i.test(text(meta)) && !meta.children.some(isEl)) {
    const was = /By\s+([^·|]+)/i.exec(text(meta))?.[1]?.trim() ?? "";
    edits.push({ ...innerRange(html, meta), text: esc([fmtDate(a.publishedAt), `${minutes(a.content ?? "")} min read`, (a.author || was) ? `By ${a.author || was}` : ""].filter(Boolean).join(" · ")) });
  }
  // cover: the first picture between the title and the article text
  const url = a.featuredImage?.url ? withAssets(a.featuredImage.url, opts.asset) : "";
  if (h && url) {
    const from = at(h).endIndex!, to = at(body).startIndex!;
    const cover = all(main, (e) => e.name === "img").find((i) => at(i).startIndex! > from && at(i).startIndex! < to);
    if (cover) { const t = openTag(html, cover); let tag = html.slice(t.start, t.end); tag = setAttr(dropAttr(dropAttr(tag, "srcset"), "data-srcset"), "src", url); tag = setAttr(tag, "alt", a.featuredImage?.alt || a.title); edits.push({ ...t, text: tag }); }
  }
  // the category label next to the title (e.g. <span class="post__tag">Insights</span>)
  if (h && a.category?.name) {
    const tagEl = all(main, (e) => ["span", "small", "em", "p"].includes(e.name) && /(?:^|[\s_-])(tag|category|cat|badge)(?:$|[\s_-])/i.test(e.attribs.class ?? "") && !e.children.some(isEl)
      && at(e).startIndex! < at(body).startIndex! && !inside(e, ["header", "nav", "footer", "a"]))[0];
    if (tagEl) edits.push({ ...innerRange(html, tagEl), text: esc(a.category.name) });
  }
  let out = apply(html, edits);
  // Google tags: title, description, social cards, address, structured data
  const title = a.seo.title || a.title, desc = a.seo.description || a.excerpt || "";
  const site = (/<title[^>]*>[^<]*?[|·—–-]\s*([^<|·—–-]+)<\/title>/i.exec(html)?.[1] ?? opts.siteName ?? "").trim();
  const full = site && !title.includes(site) ? `${title} | ${site}` : title;
  const metaSet = (h0: string, attr: string, name: string, val: string) => {
    if (!val) return h0;
    const re = new RegExp(`(<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${name}["'][^>]*\\bcontent\\s*=\\s*)(["'])[\\s\\S]*?\\2`, "i");
    const re2 = new RegExp(`(<meta\\b[^>]*\\bcontent\\s*=\\s*)(["'])[\\s\\S]*?\\2([^>]*\\b${attr}\\s*=\\s*["']${name}["'])`, "i");
    if (re.test(h0)) return h0.replace(re, (_m, p: string) => `${p}"${escAttr(val)}"`);
    if (re2.test(h0)) return h0.replace(re2, (_m, p: string, _q: string, r: string) => `${p}"${escAttr(val)}"${r}`);
    return h0.replace(/<\/head>/i, () => `  <meta ${attr}="${name}" content="${escAttr(val)}">\n</head>`);
  };
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, () => `<title>${esc(full)}</title>`);
  out = metaSet(out, "name", "description", desc);
  out = metaSet(out, "property", "og:title", full); out = metaSet(out, "property", "og:description", desc);
  out = metaSet(out, "name", "twitter:title", full); out = metaSet(out, "name", "twitter:description", desc);
  if (opts.url && !opts.keepUrl) {
    out = metaSet(out, "property", "og:url", opts.url);
    out = /<link\b[^>]*rel=["']canonical["']/i.test(out) ? out.replace(/(<link\b[^>]*rel=["']canonical["'][^>]*href=)(["'])[^"']*\2/i, (_m, p: string) => `${p}"${escAttr(a.seo.canonicalUrl || opts.url)}"`)
      : out.replace(/<\/head>/i, () => `  <link rel="canonical" href="${escAttr(a.seo.canonicalUrl || opts.url)}">\n</head>`);
  }
  if (url && /^https?:/.test(url)) { out = metaSet(out, "property", "og:image", url); out = metaSet(out, "name", "twitter:image", url); }
  const ld: Record<string, unknown> = { "@type": "BlogPosting", headline: a.title, description: desc, ...(opts.url ? { url: opts.url, mainEntityOfPage: opts.url } : {}),
    ...(url && /^https?:/.test(url) ? { image: [url] } : {}), ...(a.publishedAt ? { datePublished: new Date(a.publishedAt).toISOString() } : {}),
    ...(a.updatedAt ? { dateModified: new Date(a.updatedAt).toISOString() } : {}), ...(a.author ? { author: { "@type": "Person", name: a.author } } : {}) };
  const ART = new Set(["BlogPosting", "Article", "NewsArticle"]);
  let merged = false;
  out = out.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (m, o: string, j: string, c: string) => {
    let data: unknown; try { data = JSON.parse(j); } catch { return m; }
    const fix = (x: Record<string, unknown>) => { merged = true; return { ...x, ...ld, ...(x.author && !a.author ? { author: x.author } : {}) }; };
    if (data && typeof data === "object" && ART.has(String((data as Record<string, unknown>)["@type"]))) data = fix(data as Record<string, unknown>);
    else if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>)["@graph"]))
      (data as Record<string, unknown>)["@graph"] = ((data as Record<string, unknown>)["@graph"] as Record<string, unknown>[]).map((x) => (x && ART.has(String(x["@type"])) ? fix(x) : x));
    else return m;
    return o + JSON.stringify(data).replace(/</g, "\\u003c") + c;
  });
  // No CMS tag is added: the CMS knows the files it wrote from its own records (git_files), so the website stays plain.
  if (merged) return out;
  return out.replace(/<\/head>/i, () => `  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...ld }).replace(/</g, "\\u003c")}</script>\n</head>`);
}
