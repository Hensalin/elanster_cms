import { createHmac, timingSafeEqual } from "node:crypto";

/* The page editor's preview shows the website's own files straight from GitHub (no script in the website).
   Its address carries a short-lived signed token, so the preview frame needs no sign-in cookie
   (the frame runs sandboxed, without access to the CMS's cookies). */
const secret = () => process.env.SESSION_SECRET || "dev-secret-change-me";
const b64 = (b: Buffer) => b.toString("base64url");

export function previewToken(websiteId: string, hours = 12) {
  const exp = Math.floor(Date.now() / 1000) + hours * 3600;
  const body = `${websiteId}.${exp}`;
  return `${b64(Buffer.from(body))}.${b64(createHmac("sha256", secret()).update(body).digest()).slice(0, 32)}`;
}
export function readPreviewToken(token: string): string | null {
  const [a, sig] = token.split("."); if (!a || !sig) return null;
  let body: string; try { body = Buffer.from(a, "base64url").toString("utf8"); } catch { return null; }
  const want = b64(createHmac("sha256", secret()).update(body).digest()).slice(0, 32);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const [id, exp] = body.split("."); if (!id || !exp || +exp < Date.now() / 1000) return null;
  return id;
}

export const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", txt: "text/plain; charset=utf-8", xml: "application/xml",
};

/** Root addresses ("/css/a.css") in a preview file point at the website's own root, not the CMS. */
export function rebaseRoot(text: string, base: string, css = false) {
  const fix = (v: string) => (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/api/v1/media/") ? base + v.slice(1) : v);
  if (css) return text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q: string, v: string) => `url(${q}${fix(v.trim())}${q})`);
  return text.replace(/(\s(?:src|href|data-src|poster|action)\s*=\s*)(["'])([^"']*)\2/gi, (m, a: string, q: string, v: string) => `${a}${q}${fix(v.trim())}${q}`)
    .replace(/(\ssrcset\s*=\s*)(["'])([^"']*)\2/gi, (m, a: string, q: string, v: string) => `${a}${q}${v.split(",").map((p) => p.trim().replace(/^\S+/, (u) => fix(u))).join(", ")}${q}`)
    .replace(/url\(\s*(["']?)(\/[^"')]+)\1\s*\)/g, (m, q: string, v: string) => `url(${q}${fix(v)}${q})`);
}
