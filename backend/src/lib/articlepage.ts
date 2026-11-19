import type { publicBlog } from "./public";

/* Builds a real article page (HTML file) for a website whose article page is an empty shell filled by the website's own script
   (article.html + js/blog.js, as on the Elanster demo). The shell is the website's own file, so the design, menu and footer
   are exactly the website's. The article's words are written into it, plus its Google tags. */

export type Article = ReturnType<typeof publicBlog>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const articlePath = (slug: string) => `article-${slug}.html`;
export const validSlug = (s: string) => /^[a-z0-9][a-z0-9-]{0,100}$/.test(s);
const MEDIA = /(?:https?:\/\/[^"'\s)]*?)?\/api\/v1\/media\/([A-Za-z0-9_-]+)/g;
export const mediaIds = (s: string) => [...s.matchAll(MEDIA)].map((m) => m[1]);

const FALLBACK_CATS = ["ai-strategy", "ai-economics", "ai-engineering"];
const TAGMAP: Record<string, string> = { "ai-strategy": "orange", "ai-economics": "blue", "ai-engineering": "lime" };
const fmt = (d: Date | string | null) => { if (!d) return ""; const x = new Date(d); return isNaN(+x) ? "" : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
const mins = (html: string) => { const w = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length; return w > 120 ? `${Math.max(1, Math.round(w / 200))} min read` : ""; };

/** Replaces each CMS picture address with the committed copy's path. */
export function withAssets(s: string, asset: (id: string) => string | null) {
  return s.replace(MEDIA, (m, id: string) => asset(id) ?? m);
}

const cat = (x: Article) => x.category ?? { name: "Insights", slug: "insights" };
function cards(all: Article[], asset: (id: string) => string | null) {
  const cats: string[] = []; [...all.map((x) => cat(x).slug), ...FALLBACK_CATS].forEach((c) => { if (!cats.includes(c)) cats.push(c); });
  const img = (x: Article) => { const u = x.featuredImage?.url; return u ? withAssets(u, asset) : ""; };
  const post = (x: Article) => {
    const t = TAGMAP[cat(x).slug] ?? ["orange", "blue", "lime"][Math.max(0, cats.indexOf(cat(x).slug)) % 3], i = img(x);
    return `<a class="post" href="${articlePath(x.slug)}">${i ? `<img class="post__photo" src="${esc(i)}" alt="${esc(x.featuredImage?.alt || x.title)}" loading="lazy" width="800" height="480">` : ""}` +
      `<span class="post__tag post__tag--${t}">${esc(cat(x).name)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p><span class="post__link">Read article &rarr;</span></a>`;
  };
  return { cats, img, post };
}

const LIST_RE = /<div\b([^>]*?)\sid="(?:blogApp|blogList)"([^>]*)>([\s\S]*?)<\/div>/;
/** True when the page has the website's article list area (blog.html on the Elanster demo). */
export const hasArticleList = (html: string) => LIST_RE.test(html);
/** Writes the article cards (newest first) into the list area. The area gets another id so the website's own script leaves it alone
    (that script would otherwise replace the cards, and show only its built-in articles when the CMS cannot be reached). */
export function renderList(html: string, all: Article[], asset: (id: string) => string | null) {
  const { post } = cards(all, asset);
  const inner = all.length ? all.map(post).join("") : "<p>No articles yet.</p>";
  return html.replace(LIST_RE, (_m, a: string, b: string) => { const clean = (x: string) => x.replace(/\s+data-cms-list="[^"]*"/g, ""); return `<div${clean(a)} id="blogList" data-cms-list="articles"${clean(b)}>${inner}</div>`; });
}

export function renderArticle(shell: string, a: Article, all: Article[], opts: { siteUrl: string; asset: (id: string) => string | null }): string {
  const rootRe = /<div class="art__wrap" id="articleApp">[\s\S]*?<\/div>/;
  if (!rootRe.test(shell)) throw new Error("The website's article.html does not have the expected article area (id=\"articleApp\")");
  const { cats, img, post } = cards(all, opts.asset);
  const badge = (x: Article) => `<span class="bl-badge bl-badge--${Math.max(0, cats.indexOf(cat(x).slug)) % 4}">${esc(cat(x).name)}</span>`;
  const content = withAssets("content" in a && a.content ? a.content : "", opts.asset);
  const body = content || '<p class="art__note">The full article is being prepared and will be published here soon.</p>';
  const metaParts = [fmt(a.publishedAt), mins(content), a.author ?? ""].filter(Boolean);
  const meta = metaParts.length ? `<div class="bl-meta">${metaParts.map((x) => `<span>${esc(x)}</span>`).join("<span>·</span>")}</div>` : "";
  const more = all.filter((p) => p.slug !== a.slug).slice(0, 3);
  const cover = img(a);
  const inner = `<a class="art__back" href="blog.html">&larr; All articles</a>${badge(a)}<h1>${esc(a.title)}</h1><p class="art__lede">${esc(a.excerpt)}</p>${meta}` +
    (cover ? `<img class="art__cover" src="${esc(cover)}" alt="${esc(a.featuredImage?.alt || a.title)}">` : "") + `<div class="art__body">${body}</div>` +
    (more.length ? `<div class="art__more"><h2>Keep reading</h2><div class="insights__grid">${more.map(post).join("")}</div></div>` : "");
  let out = shell.replace(rootRe, () => `<div class="art__wrap" id="articleApp">${inner}</div>`);

  // The website's own script would fill the area again (and show "not found" without ?slug=); the page is complete, so it is not needed here.
  out = out.replace(/\s*<script\b[^>]*\bsrc="js\/blog\.js[^"]*"[^>]*><\/script>/i, "");

  // Google tags
  const title = `${a.seo.title || a.title} | ${(/<title[^>]*>[^|<]*\|\s*([^<]*)<\/title>/i.exec(shell)?.[1] ?? "").trim() || "Website"}`;
  const desc = a.seo.description || a.excerpt || "";
  const url = opts.siteUrl ? `${opts.siteUrl}/${articlePath(a.slug)}` : "";
  const ogImg = cover ? (/^https?:/.test(cover) ? cover : opts.siteUrl ? `${opts.siteUrl}/${cover.replace(/^\//, "")}` : "") : "";
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  out = out.replace(/(<meta\b[^>]*\bname="description"[^>]*\scontent=")[^"]*(")/i, (_m, a1, a2) => `${a1}${esc(desc)}${a2}`);
  const head: string[] = [];
  if (url) head.push(`<link rel="canonical" href="${esc(a.seo.canonicalUrl || url)}">`);
  head.push(`<meta property="og:type" content="article">`, `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`);
  if (url) head.push(`<meta property="og:url" content="${esc(url)}">`);
  if (ogImg) head.push(`<meta property="og:image" content="${esc(ogImg)}">`);
  head.push(`<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:description" content="${esc(desc)}">`);
  if (ogImg) head.push(`<meta name="twitter:image" content="${esc(ogImg)}">`);
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: desc, ...(url ? { url } : {}), ...(ogImg ? { image: [ogImg] } : {}),
    ...(a.publishedAt ? { datePublished: new Date(a.publishedAt).toISOString() } : {}), ...(a.updatedAt ? { dateModified: new Date(a.updatedAt).toISOString() } : {}),
    author: a.author ? { "@type": "Person", name: a.author } : { "@type": "Organization", name: "Website" }, ...(cat(a).name ? { articleSection: cat(a).name } : {}) };
  head.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  // The shell's own og/twitter/canonical tags (if any) are replaced by the ones above.
  out = out.replace(/\s*<link\b[^>]*rel="canonical"[^>]*>/gi, "").replace(/\s*<meta\b[^>]*(?:property="og:|name="twitter:)[^>]*>/gi, "");
  out = out.replace(/<\/head>/i, () => `  ${head.join("\n  ")}\n</head>`);
  return out;
}
