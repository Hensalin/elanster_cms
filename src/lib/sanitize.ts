import sanitizeHtml from "sanitize-html";

/** Clean editor HTML before saving: removes scripts, event handlers, javascript: links, iframes, styles. */
export const cleanHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "blockquote",
      "ul", "ol", "li", "a", "img", "figure", "figcaption", "code", "pre", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title", "width", "height"], "*": [] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      h1: "h2",
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, ...(attribs.href?.startsWith("http") ? { rel: "noopener noreferrer" } : {}) } }),
    },
  });
