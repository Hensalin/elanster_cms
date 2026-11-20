import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readFile } from "@/lib/github";
import { PREVIEW_JS } from "@/lib/previewjs";
import { TYPES, readPreviewToken, rebaseRoot } from "@/lib/sitefiles";

export const maxDuration = 30;
// A short memory of files already fetched, so one preview does not ask GitHub for the same file again and again.
const cache = new Map<string, { at: number; buf: Buffer | null }>();

/** The website's own files, read from its GitHub repo, for the page editor's preview frame. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await params;
  const id = readPreviewToken(token);
  if (!id) return new Response("Preview link expired. Reload the editor.", { status: 403 });
  const file = path.map(decodeURIComponent).join("/");
  if (!file || file.split("/").some((p) => p === ".." || p.startsWith(".")) || file.length > 300) return new Response("Not found", { status: 404 });
  const [site] = await db.select({ repo: schema.websites.gitRepo, branch: schema.websites.gitBranch }).from(schema.websites).where(eq(schema.websites.id, id));
  if (!site?.repo) return new Response("Not found", { status: 404 });
  const key = `${site.repo}@${site.branch}:${file}`; const hit = cache.get(key);
  let buf: Buffer | null;
  if (hit && Date.now() - hit.at < 60_000) buf = hit.buf;
  else { try { buf = await readFile(site.repo, file, site.branch); } catch { return new Response("Could not read the file from GitHub", { status: 502 }); }
    cache.set(key, { at: Date.now(), buf }); if (cache.size > 400) cache.delete(cache.keys().next().value!); }
  if (!buf) return new Response("Not found", { status: 404 });
  const ext = (/\.([a-z0-9]+)$/i.exec(file)?.[1] ?? "").toLowerCase();
  const base = `/api/v1/site-files/${token}/`;
  const headers: Record<string, string> = { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=60",
    "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
  if (ext === "html" || ext === "htm") {
    const slug = new URL(req.url).searchParams.get("slug") ?? "";
    let html = rebaseRoot(buf.toString("utf8"), base);
    const inject = `<script>window.ELANSTER_PREVIEW=${JSON.stringify({ slug })};</script><script>${PREVIEW_JS.replace(/<\/script/gi, "<\\/script")}</script>`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => inject + "</body>") : html + inject;
    return new Response(html, { headers });
  }
  if (ext === "css") return new Response(rebaseRoot(buf.toString("utf8"), base, true), { headers });
  return new Response(new Uint8Array(buf), { headers });
}
