import { createHash } from "node:crypto";
import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";

/* Finds every visible piece of text on a page that has no data-cms markers.
   The website script (public/cms-content.js) finds the same texts again by their wording, so both must agree:
   a text is the full wording of the outermost element that holds it, the key is a hash of that wording. */

// Elements that always count as one text when they hold text and no block inside (the original set; keeps old keys).
const MAIN = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "figcaption", "blockquote", "dt", "dd", "label", "summary"]);
// Elements that count only when they hold text directly (not just through children), e.g. <div><b>Jesus</b><span>Lord…</span></div>.
const EXTRA = new Set(["span", "b", "strong", "em", "small", "div", "td", "th", "cite", "q", "mark", "u", "s", "sup", "sub"]);
const BLOCK = new Set(["div", "section", "article", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "img", "figure",
  "table", "tr", "tbody", "thead", "form", "header", "footer", "nav", "main", "aside", "picture", "video", "iframe", "input", "select",
  "textarea", "blockquote", "dl", "dt", "dd", "summary", "details", "label", "td", "th"]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template", "textarea", "select", "option", "head", "iframe", "video", "audio", "canvas", "code", "pre", "object"]);
const AREAS = new Set(["section", "header", "footer", "nav", "main", "aside", "article", "form"]);

export type FoundText = { tag: string; text: string; section: string };

const LETTER = /\p{L}/u;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** Real words only: no empty strings, symbols, bare numbers or timers like "02:15" / "2d 18h". */
export const worth = (t: string) => t.length >= 2 && t.length <= 2000 && /\p{L}{2,}/u.test(t) && !/^[\d\s:.,/hmsd+-]+$/i.test(t);
export const textHash = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 8);

const isEl = (n: AnyNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";
function textOf(n: AnyNode): string {
  if (n.type === "text") return (n as unknown as { data: string }).data;
  // Child elements without letters (counters like <sup>19</sup>, arrows, icons) are not part of the wording.
  if (isEl(n)) return n.name === "br" ? " " : SKIP.has(n.name) ? " " : n.children.map((c) => { const t = textOf(c); return isEl(c) && c.name !== "br" && !LETTER.test(t) ? "" : t; }).join("");
  return "";
}
const hidden = (e: Element) => e.attribs.hidden !== undefined || e.attribs["aria-hidden"] === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(e.attribs.style ?? "");
const hasBlockInside = (e: Element): boolean => e.children.some((c) => isEl(c) && (BLOCK.has(c.name) || hasBlockInside(c)));
const ownText = (e: Element) => e.children.some((c) => c.type === "text" && norm((c as unknown as { data: string }).data) !== "");

function findFirst(e: Element, ok: (x: Element) => boolean): Element | null {
  for (const c of e.children) { if (!isEl(c) || SKIP.has(c.name)) continue; if (ok(c)) return c; const f = findFirst(c, ok); if (f) return f; }
  return null;
}
// "th-form" → "Form", "heroWords" → "Hero words": short code prefixes are dropped.
const words = (s: string) => { const w = s.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().split(/\s+/); return (w.length > 1 && w[0].length <= 2 ? w.slice(1) : w).join(" "); };
function areaName(e: Element): string {
  const named: Record<string, string> = { nav: "Menu", header: "Header", footer: "Footer", aside: "Side panel", form: "Form" };
  const label = e.attribs["aria-label"];
  if (e.name === "nav") return /mobile/i.test(label ?? "") ? "Mobile menu" : /social/i.test(label ?? "") ? "Social links" : /foot/i.test(label ?? "") ? "Footer menu" : "Menu";
  if (label) return label.length < 30 ? label.replace(/^\w/, (c) => c.toUpperCase()) : named[e.name] ?? "Section";
  const id = e.attribs.id; if (id && !/^\d/.test(id)) return words(id).replace(/^\w/, (c) => c.toUpperCase());
  if (named[e.name]) return named[e.name];
  // Otherwise the section's first heading, shortened: "Real people. Real message…" → a name people recognise.
  const h = findFirst(e, (x) => /^h[1-6]$/.test(x.name));
  if (h) { const t = norm(textOf(h)); if (worth(t)) return t.length <= 32 ? t : t.split(" ").slice(0, 4).join(" ") + "…"; }
  const cls = (e.attribs.class ?? "").split(/\s+/).find((c) => c && !/^(is|has|js|u|container|wrap|section|reveal|mask)$/.test(c));
  if (cls) return words(cls.split("__")[0]).replace(/^\w/, (c) => c.toUpperCase());
  return "Page";
}

export function findTexts(html: string): FoundText[] {
  const doc = parseDocument(html, { decodeEntities: true });
  const out: FoundText[] = [];
  const walk = (n: AnyNode, area: string) => {
    if (!isEl(n)) return;
    if (SKIP.has(n.name) || hidden(n)) return;
    const here = AREAS.has(n.name) ? areaName(n) : area;
    const counts = !hasBlockInside(n) && (MAIN.has(n.name) || (EXTRA.has(n.name) && ownText(n)));
    if (counts) {
      const text = norm(textOf(n));
      if (worth(text)) { out.push({ tag: n.name, text, section: here }); return; }
    }
    n.children.forEach((c) => walk(c, here));
  };
  const body = doc.children.find((c) => isEl(c) && c.name === "html");
  (body && isEl(body) ? body.children : doc.children).forEach((c) => walk(c, "Page"));
  return out;
}

/** A plain word for the kind of text, shown above the field in the editor. */
export const kindOf = (tag: string) => /^h[1-6]$/.test(tag) ? "Heading" : tag === "a" ? "Link" : tag === "button" ? "Button"
  : tag === "li" ? "List item" : tag === "label" ? "Label" : tag === "blockquote" || tag === "q" ? "Quote" : tag === "figcaption" ? "Caption" : "Text";

export type FoundImage = { src: string; alt: string; section: string };
/** Every visible picture on the page (<img src>), so it can be replaced from the CMS. The key is a hash of its original address. */
export function findImages(html: string): FoundImage[] {
  const doc = parseDocument(html, { decodeEntities: true });
  const out: FoundImage[] = []; const seen = new Set<string>();
  const walk = (n: AnyNode, area: string) => {
    if (!isEl(n) || SKIP.has(n.name) || hidden(n) || n.name === "head") return;
    const here = AREAS.has(n.name) ? areaName(n) : area;
    if (n.name === "img") {
      const src = (n.attribs.src || n.attribs["data-src"] || "").trim();
      if (src && !src.startsWith("data:") && !seen.has(src)) { seen.add(src); out.push({ src, alt: (n.attribs.alt ?? "").trim(), section: here }); }
      return;
    }
    n.children.forEach((c) => walk(c, here));
  };
  doc.children.forEach((c) => walk(c, "Page"));
  return out;
}
