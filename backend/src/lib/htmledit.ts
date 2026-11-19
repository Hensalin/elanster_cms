import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";
import { textHash, worth } from "./pagetexts";

/* Writes published CMS edits into a page's real HTML. It finds texts exactly like the sync does (pagetexts.ts):
   the same elements, the same keys. Only the words (and picture addresses / Google title+description) change; the layout,
   classes, scripts and every other byte of the file stay as they were. */

const MAIN = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "figcaption", "blockquote", "dt", "dd", "label", "summary"]);
const EXTRA = new Set(["span", "b", "strong", "em", "small", "div", "td", "th", "cite", "q", "mark", "u", "s", "sup", "sub"]);
const BLOCK = new Set(["div", "section", "article", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "img", "figure",
  "table", "tr", "tbody", "thead", "form", "header", "footer", "nav", "main", "aside", "picture", "video", "iframe", "input", "select",
  "textarea", "blockquote", "dl", "dt", "dd", "summary", "details", "label", "td", "th"]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template", "textarea", "select", "option", "head", "iframe", "video", "audio", "canvas", "code", "pre", "object"]);
const LETTER = /\p{L}/u;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const isEl = (n: AnyNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";
const data = (n: AnyNode) => (n as unknown as { data: string }).data;
const idx = (n: AnyNode) => n as unknown as { startIndex: number | null; endIndex: number | null };

function textOf(n: AnyNode): string {
  if (n.type === "text") return data(n);
  if (isEl(n)) return n.name === "br" ? " " : SKIP.has(n.name) ? " " : n.children.map((c) => { const t = textOf(c); return isEl(c) && c.name !== "br" && !LETTER.test(t) ? "" : t; }).join("");
  return "";
}
const hidden = (e: Element) => e.attribs.hidden !== undefined || e.attribs["aria-hidden"] === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(e.attribs.style ?? "");
const hasBlockInside = (e: Element): boolean => e.children.some((c) => isEl(c) && (BLOCK.has(c.name) || hasBlockInside(c)));
const ownText = (e: Element) => e.children.some((c) => c.type === "text" && norm(data(c)) !== "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

type Edit = { start: number; end: number; text: string };

/** The part of an element's inside that holds its words becomes `value`; icons and counters (children without letters) stay. */
function setText(html: string, e: Element, value: string, out: Edit[]) {
  const words = e.children.filter((c) => (c.type === "text" && LETTER.test(data(c))) || (isEl(c) && c.name !== "br" && LETTER.test(textOf(c))));
  if (!words.length) return false;
  words.forEach((c, i) => {
    const { startIndex: a, endIndex: b } = idx(c);
    if (a == null || b == null) return;
    if (i > 0) { out.push({ start: a, end: b + 1, text: "" }); return; }
    const raw = html.slice(a, b + 1);
    const lead = c.type === "text" ? /^\s*/.exec(raw)![0] : "";
    const last = words[words.length - 1], lastRaw = (() => { const { startIndex: x, endIndex: y } = idx(last); return x == null || y == null ? "" : html.slice(x, y + 1); })();
    const trail = last.type === "text" ? /\s*$/.exec(lastRaw)![0] : "";
    out.push({ start: a, end: b + 1, text: lead + esc(value) + trail });
  });
  // The first word-child's range ends where it ends; later ones are emptied. (Neighbouring ranges never overlap.)
  return true;
}

function setImg(html: string, e: Element, from: string, to: string, out: Edit[]) {
  const { startIndex: a, endIndex: b } = idx(e);
  if (a == null || b == null) return false;
  const tag = html.slice(a, (e.children.length ? idx(e.children[0]).startIndex ?? b + 1 : b + 1));
  const end = tag.indexOf(">") + 1; if (!end) return false;
  let start = tag.slice(0, end), changed = false;
  start = start.replace(/(\s(?:data-)?src\s*=\s*)(["'])([\s\S]*?)\2/gi, (m, pre: string, q: string, v: string) => {
    if (unesc(v.trim()) !== from) return m; changed = true; return pre + q + escAttr(to) + q;
  });
  if (!changed) return false;
  start = start.replace(/\s(?:data-)?srcset\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out.push({ start: a, end: a + end, text: start });
  return true;
}

const metaAttr = (html: string, attr: string, name: string) => {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${name}["'][^>]*>`, "i");
  const m = re.exec(html); if (!m) return null;
  const c = /\scontent\s*=\s*(["'])([\s\S]*?)\1/i.exec(m[0]); if (!c) return null;
  return { index: m.index, tag: m[0], q: c[1], value: unesc(c[2]), cStart: m.index + c.index + (c[0].indexOf(c[1]) + 1), cEnd: m.index + c.index + c[0].length - 1 };
};

export type Applied = { html: string; changed: number };

/** `values`: key → new text/picture address (published edits of the page plus the shared "Header & footer" ones).
    `asset(url)`: turns a CMS picture address into the path of the committed copy (or returns it unchanged). */
export function applyEdits(html: string, slug: string, values: Record<string, string>, asset: (url: string) => string,
  originals: Record<string, string> = {}): Applied {
  // Texts that have no marker and no matching key are also found by their original wording, like the website script does
  // (e.g. the menu on a page the CMS never read, such as the article design).
  const byText = new Map<string, string>(), bySrc = new Map<string, string>();
  for (const [k, o] of Object.entries(originals)) {
    if (!(k in values) || /\.seo\./.test(k)) continue;
    if (/\.img\./.test(k) || /^(https?:|\/|\.\.?\/|[\w-]+\/)[^\s]*\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(o)) { if (values[k] !== o) bySrc.set(o.trim(), values[k]); }
    else if (norm(values[k]) !== norm(o)) byText.set(norm(o), values[k]);
  }
  const doc = parseDocument(html, { decodeEntities: true, withStartIndices: true, withEndIndices: true });
  const edits: Edit[] = []; let fields = 0;
  const pick = (kind: string, hash: string) => { const a = `${slug}.${kind}.${hash}`, b = `global.${kind}.${hash}`; return a in values ? values[a] : b in values ? values[b] : undefined; };
  const walk = (n: AnyNode) => {
    if (!isEl(n) || SKIP.has(n.name) || hidden(n)) return;
    const mk = n.attribs["data-cms"], mi = n.attribs["data-cms-img"];
    if (n.name === "img") {
      const src = (n.attribs.src || n.attribs["data-src"] || "").trim();
      const v = mi && mi in values ? values[mi] : src ? pick("img", textHash(src)) ?? bySrc.get(src) : undefined;
      if (v !== undefined && src && v !== src && setImg(html, n, src, asset(v), edits)) fields++;
      return;
    }
    if (mk) {
      if (mk in values) { if (norm(values[mk]) !== norm(textOf(n)) && setText(html, n, values[mk], edits)) fields++; return; }
      const v = byText.get(norm(textOf(n)));
      if (v !== undefined && setText(html, n, v, edits)) fields++;
      return;
    }
    const counts = !hasBlockInside(n) && (MAIN.has(n.name) || (EXTRA.has(n.name) && ownText(n)));
    if (counts) {
      const text = norm(textOf(n));
      if (worth(text)) {
        const v = pick(n.name, textHash(text)) ?? byText.get(text);
        if (v !== undefined && norm(v) !== text && setText(html, n, v, edits)) fields++;
        return;
      }
    }
    n.children.forEach(walk);
  };
  const root = doc.children.find((c) => isEl(c) && c.name === "html");
  (root && isEl(root) ? root.children : doc.children).forEach(walk);

  // Google title + description (and the social-card copies that carry the same words).
  let out = html;
  const metaEdits: Edit[] = [];
  const t = values[`${slug}.seo.title`], d = values[`${slug}.seo.description`];
  if (t !== undefined) {
    const m = /(<title[^>]*>)([\s\S]*?)(<\/title>)/i.exec(html);
    if (m && norm(unesc(m[2])) !== norm(t)) {
      const was = norm(unesc(m[2]));
      fields++; metaEdits.push({ start: m.index + m[1].length, end: m.index + m[1].length + m[2].length, text: esc(t) });
      for (const [a, n] of [["property", "og:title"], ["name", "twitter:title"]] as const) { const x = metaAttr(html, a, n); if (x && norm(x.value) === was) metaEdits.push({ start: x.cStart, end: x.cEnd, text: escAttr(t) }); }
    }
  }
  if (d !== undefined) {
    const x = metaAttr(html, "name", "description");
    if (x && norm(x.value) !== norm(d)) {
      const was = norm(x.value); fields++; metaEdits.push({ start: x.cStart, end: x.cEnd, text: escAttr(d) });
      for (const [a, n] of [["property", "og:description"], ["name", "twitter:description"]] as const) { const y = metaAttr(html, a, n); if (y && norm(y.value) === was) metaEdits.push({ start: y.cStart, end: y.cEnd, text: escAttr(d) }); }
    }
  }
  const all = [...edits, ...metaEdits].sort((a, b) => b.start - a.start);
  let last = Infinity;
  for (const e of all) {
    if (e.end > last) continue;                // overlapping edits are skipped, never half-applied
    out = out.slice(0, e.start) + e.text + out.slice(e.end); last = e.start;
  }
  return { html: out, changed: fields };
}
