import sanitizeHtml from "sanitize-html";

/** Clean editor HTML before saving: removes scripts, event handlers, javascript: links, iframes, styles. */
export const cleanHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "blockquote",
      "ul", "ol", "li", "a", "img", "figure", "figcaption", "code", "pre", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"], img: ["src", "alt", "title", "width", "height", "style"],
      p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], th: ["colspan", "rowspan", "style"], td: ["colspan", "rowspan", "style"], "*": [],
    },
    // Only harmless layout styles survive (alignment and image size); everything else is removed.
    allowedStyles: {
      "*": { "text-align": [/^(left|center|right|justify)$/] },
      img: { display: [/^block$/], margin: [/^[0-9a-z\s.%-]{1,40}$/], width: [/^\d{1,3}(\.\d+)?%$/, /^\d{2,4}px$/], height: [/^auto$/], "text-align": [/^(left|center|right|justify)$/] },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      h1: "h2",
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, ...(attribs.href?.startsWith("http") ? { rel: "noopener noreferrer" } : {}) } }),
    },
  });
