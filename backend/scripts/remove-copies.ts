// Hides the copied articles an older sync made (named "article-…", see GIT-PUBLISHING.md), then writes the website to GitHub
// once so their files are removed there too. Real articles are never touched. Hidden, not erased (they can be brought back).
// Run: npx tsx --env-file=.env.local scripts/remove-copies.ts <website-short-name> [--yes]
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { findCopies, removeCopies } from "../src/lib/sitescan";
import { gitPublish } from "../src/lib/gitpublish";

const out: string[] = []; const log = (...a: unknown[]) => { const l = a.join(" "); console.log(l); out.push(l); };
async function main() {
  const slug = process.argv[2] || "demooo", yes = process.argv.includes("--yes");
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.slug, slug));
  if (!site || site.deletedAt) throw new Error("No website called " + slug);
  log(`Website: ${site.name} (${site.slug})`);
  const c = await findCopies(site.id);
  log(`Copied articles found: ${c.articles.length}`); c.articles.forEach((b) => log("  -", b.slug));
  log(`Copied pages found: ${c.pages.length}`); c.pages.forEach((p) => log("  -", p.slug));
  if (!c.articles.length && !c.pages.length) log("Nothing to remove.");
  else if (!yes) { log("\nNothing was changed. Run again with --yes to hide these."); return; }
  else { const n = await removeCopies(site.id); log(`\nHidden: ${n.articles} article(s), ${n.pages} page(s).`);
    await db.insert(schema.activityLogs).values({ userId: null, websiteId: site.id, action: "REMOVE_COPIES", entity: "website", entityId: site.id, summary: `Hid ${n.articles} copied article(s) and ${n.pages} copied page(s) made by the sync` }); }
  if (!site.gitRepo) { log("Git publishing is off for this website, so GitHub was not changed."); return; }
  log(`\nWriting the website to GitHub (${site.gitRepo})…`);
  const r = await gitPublish(site.id, { why: "remove copied articles" });
  log(`GitHub: ${r.status} — ${r.message}`);
}
main().catch((e) => log("ERROR:", (e as Error).message)).finally(() => { writeFileSync("remove-copies-log.txt", out.join("\n")); process.exit(0); });
