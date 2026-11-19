// Reads a website and syncs its pages and articles into the CMS, printing every step (also saved to sync-log.txt).
// Run: npx tsx --env-file=.env.local scripts/sync-site.ts <website-short-name>
import { writeFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../src/db";
import { findPosts, syncPages } from "../src/lib/sitescan";

const out: string[] = []; const log = (...a: unknown[]) => { const l = a.map((x) => typeof x === "string" ? x : JSON.stringify(x, null, 1)).join(" "); console.log(l); out.push(l); };
async function main() {
  const slug = process.argv[2] || "demooo";
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.slug, slug));
  if (!site) throw new Error("No website " + slug);
  log(`Website: ${site.name} (${site.slug}) at ${site.domain}`);
  const base = site.domain.replace(/\/$/, "");
  const home = await (await fetch(base + "/")).text(); const blog = await (await fetch(base + "/blog.html")).text().catch(() => "");
  const found = await findPosts(base, [home, blog]);
  log(`Articles found on the website: ${found.length}`); found.forEach((p) => log(" -", p.slug.slice(0, 50), "| category:", p.category?.name ?? "NONE", "| image:", p.image ? "yes" : "NONE"));
  const r = await syncPages(site.id, null);
  log(`Sync: ${r.pages.length} pages (${r.created} new, ${r.updated} refreshed, ${r.removed} removed); articles: ${JSON.stringify(r.posts)}`);
  const rows = await db.select({ title: schema.blogs.title, cat: schema.blogs.categoryId, img: schema.blogs.featuredImageId, ex: schema.blogs.excerpt })
    .from(schema.blogs).where(and(eq(schema.blogs.websiteId, site.id), isNull(schema.blogs.deletedAt)));
  log("Articles in the CMS now:"); rows.forEach((b) => log(" -", b.title.slice(0, 50), "| category:", b.cat ? "set" : "NONE", "| photo:", b.img ? "set" : "NONE", "| summary:", b.ex ? "set" : "NONE"));
}
main().catch((e) => log("ERROR:", (e as Error).stack ?? String(e))).finally(() => { writeFileSync("sync-log.txt", out.join("\n")); process.exit(0); });
