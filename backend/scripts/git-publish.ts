// Writes a website to its GitHub repository now and lists every file written (also saved to git-publish-log.txt).
// Run: npx tsx --env-file=.env.local scripts/git-publish.ts <website-short-name>
import { writeFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../src/db";
import { gitPublish } from "../src/lib/gitpublish";
import { getHead, readFile } from "../src/lib/github";

const out: string[] = []; const log = (...a: unknown[]) => { const l = a.join(" "); console.log(l); out.push(l); };
async function main() {
  const slug = process.argv[2] || "demooo";
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.slug, slug));
  if (!site || site.deletedAt) throw new Error("No website called " + slug);
  log(`Website: ${site.name} (${site.slug}) → ${site.gitRepo || "(Git publishing is off)"} [${site.gitBranch}]`);
  if (!site.gitRepo) return;
  const live = await db.select({ slug: schema.blogs.slug, status: schema.blogs.status }).from(schema.blogs).where(and(eq(schema.blogs.websiteId, site.id), isNull(schema.blogs.deletedAt)));
  log(`Articles in the CMS: ${live.length} (${live.filter((b) => b.status === "PUBLISHED").length} published)`);
  const shell = await getHead(site.gitRepo, site.gitBranch || "main").then((h) => readFile(site.gitRepo, "article.html", h.commit)).catch((e) => { log("Could not read article.html:", (e as Error).message); return null; });
  log(`article.html in the repo: ${shell ? (shell.toString().includes('id="articleApp"') ? "yes (article design)" : "yes, but without the article area") : "no"}`);
  const r = await gitPublish(site.id, { why: "publish now" });
  log(`\nResult: ${r.status} — ${r.message}`);
  if (r.mode) log(`Way: ${r.mode}`);
  if (r.written?.length) { log(`Files written (${r.written.length}):`); r.written.forEach((f) => log("  -", f)); }
  if (r.warnings?.length) { log("Warnings:"); r.warnings.forEach((w) => log("  !", w)); }
}
main().catch((e) => log("ERROR:", (e as Error).message)).finally(() => { writeFileSync("git-publish-log.txt", out.join("\n")); process.exit(0); });
