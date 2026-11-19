// Merges duplicate copies of a website into ONE website, then turns the copies off.
// Keeps one copy of every article and page (live ones first, then the newest), moves categories,
// tags and images along, and adds cover photos to the three original articles if they have none.
// Nothing is permanently deleted: duplicates get deleted_at set, copies are only turned off.
// Run: node --env-file=.env.local scripts/merge-websites.mjs <target-slug> <source-slug,source-slug,...>
import { randomBytes } from "node:crypto";
import pg from "pg";

const [target, sourcesArg] = process.argv.slice(2);
if (!target || !sourcesArg) { console.error("Usage: merge-websites.mjs <target-slug> <source1,source2,...>"); process.exit(1); }
const sources = sourcesArg.split(",").map((s) => s.trim()).filter((s) => s && s !== target);
const newId = () => randomBytes(12).toString("hex");
const url = process.env.DATABASE_URL || undefined;
const local = /localhost|127\.0\.0\.1|host=\//.test(url ?? "");
const db = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });

const COVERS = {
  "why-most-ai-products-fail-after-launch-and-what-production-ready-actually-means": ["https://images.unsplash.com/photo-1746286720965-cccf57e56c68?auto=format&fit=crop&w=1200&h=750&q=70", "Laptop showing an AI code editor"],
  "how-much-does-it-cost-to-build-an-ai-product-a-real-breakdown": ["https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&w=1200&h=750&q=70", "Stacks of coins on a table"],
  "vibe-coding-technical-debt-what-happens-to-your-codebase-at-month-six": ["https://images.unsplash.com/photo-1763568258244-9d5aa9c3ce45?auto=format&fit=crop&w=1200&h=750&q=70", "Laptop screen with code and an orange glow"],
};
const rank = { PUBLISHED: 3, SCHEDULED: 2, IN_REVIEW: 1, DRAFT: 0, UNPUBLISHED: 0 };
const better = (a, b) => (rank[b.status] - rank[a.status]) || (+new Date(b.updated_at) - +new Date(a.updated_at));

try {
  await db.connect();
  const sites = (await db.query("SELECT id, slug, name FROM websites WHERE slug = ANY($1) AND deleted_at IS NULL", [[target, ...sources]])).rows;
  const T = sites.find((s) => s.slug === target);
  if (!T) throw new Error(`No website with short name "${target}"`);
  const all = sites.map((s) => s.id);
  console.log(`Keeping "${T.name}" (${T.slug}). Merging from: ${sites.filter((s) => s.id !== T.id).map((s) => s.slug).join(", ") || "nothing"}`);
  await db.query("BEGIN");

  // Categories and tags: make sure the target has every one (matched by short name).
  const catMap = new Map(), tagMap = new Map();
  for (const [table, map] of [["blog_categories", catMap], ["blog_tags", tagMap]]) {
    const rows = (await db.query(`SELECT * FROM ${table} WHERE website_id = ANY($1)`, [all])).rows;
    for (const r of rows.filter((r) => r.website_id === T.id)) map.set(r.id, r.id);
    for (const r of rows.filter((r) => r.website_id !== T.id)) {
      let t = rows.find((x) => x.website_id === T.id && x.slug === r.slug);
      if (!t) {
        t = { ...r, id: newId(), website_id: T.id };
        const cols = Object.keys(t); await db.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")})`, cols.map((c) => t[c]));
        rows.push(t);
      }
      map.set(r.id, t.id);
    }
  }

  // Articles and pages: one copy per address (slug).
  const moved = { blogs: 0, pages: 0, hidden: 0 };
  for (const table of ["blogs", "pages"]) {
    const rows = (await db.query(`SELECT * FROM ${table} WHERE website_id = ANY($1) AND deleted_at IS NULL`, [all])).rows;
    const groups = new Map(); for (const r of rows) groups.set(r.slug, [...(groups.get(r.slug) ?? []), r]);
    for (const [slug, list] of groups) {
      list.sort(better); const [win, ...lose] = list;
      for (const l of lose) {   // hide the extra copies (renamed so the address stays free)
        await db.query(`UPDATE ${table} SET deleted_at = now(), slug = $2 WHERE id = $1`, [l.id, `${slug}--copy-${l.id.slice(0, 6)}`]); moved.hidden++;
      }
      if (win.website_id !== T.id) {
        const clash = (await db.query(`SELECT id FROM ${table} WHERE website_id = $1 AND slug = $2`, [T.id, slug])).rows;
        for (const c of clash) await db.query(`UPDATE ${table} SET deleted_at = COALESCE(deleted_at, now()), slug = $2 WHERE id = $1`, [c.id, `${slug}--old-${c.id.slice(0, 6)}`]);
        if (table === "blogs") await db.query("UPDATE blogs SET website_id = $2, category_id = $3 WHERE id = $1", [win.id, T.id, win.category_id ? catMap.get(win.category_id) ?? null : null]);
        else await db.query("UPDATE pages SET website_id = $2 WHERE id = $1", [win.id, T.id]);
        moved[table]++;
      } else if (table === "blogs" && win.category_id && catMap.get(win.category_id) !== win.category_id) {
        await db.query("UPDATE blogs SET category_id = $2 WHERE id = $1", [win.id, catMap.get(win.category_id) ?? null]);
      }
      const imgs = [win.featured_image_id, win.og_image_id].filter(Boolean);
      if (imgs.length) await db.query("UPDATE media SET website_id = $2 WHERE id = ANY($1)", [imgs, T.id]);
      if (table === "blogs") {
        const links = (await db.query("SELECT tag_id FROM blog_tag_links WHERE blog_id = $1", [win.id])).rows;
        for (const { tag_id } of links) { const nt = tagMap.get(tag_id); if (nt && nt !== tag_id) {
          await db.query("DELETE FROM blog_tag_links WHERE blog_id = $1 AND tag_id = $2", [win.id, tag_id]);
          await db.query("INSERT INTO blog_tag_links (blog_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [win.id, nt]); } }
      }
    }
  }

  // Remove the other websites from the CMS (soft delete: hidden everywhere, can be restored in the database).
  await db.query("UPDATE websites SET active = false, deleted_at = now() WHERE id = ANY($1) AND id <> $2", [all, T.id]);
  await db.query("UPDATE websites SET active = true WHERE id = $1", [T.id]);
  await db.query("COMMIT");
  console.log(`Moved ${moved.blogs} articles and ${moved.pages} pages, hid ${moved.hidden} duplicate copies, removed ${all.length - 1} other websites.`);

  // Cover photos for the three original articles (only if they have none).
  const need = (await db.query("SELECT id, slug, title FROM blogs WHERE website_id = $1 AND deleted_at IS NULL AND featured_image_id IS NULL AND slug = ANY($2)", [T.id, Object.keys(COVERS)])).rows;
  for (const b of need) {
    try {
      const [src, alt] = COVERS[b.slug]; const r = await fetch(src); if (!r.ok) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer()); const id = newId();
      await db.query("INSERT INTO media (id, website_id, filename, original_name, mime_type, size, width, height, alt_text, folder, data) VALUES ($1,$2,$3,$4,$5,$6,1200,750,$7,'blog',$8)",
        [id, T.id, b.slug.slice(0, 60) + ".jpg", b.slug.slice(0, 60) + ".jpg", r.headers.get("content-type") || "image/jpeg", buf.length, alt, buf]);
      await db.query("UPDATE blogs SET featured_image_id = $2 WHERE id = $1", [b.id, id]);
      console.log("Added cover photo:", b.title);
    } catch (e) { console.log("Could not add the photo for", b.title, "-", e.message); }
  }
  const sum = (await db.query("SELECT status, count(*)::int n FROM blogs WHERE website_id = $1 AND deleted_at IS NULL GROUP BY status", [T.id])).rows;
  const pgs = (await db.query("SELECT count(*)::int n FROM pages WHERE website_id = $1 AND deleted_at IS NULL", [T.id])).rows[0].n;
  console.log(`"${T.name}" now has: ${sum.map((s) => `${s.n} ${s.status.toLowerCase()}`).join(", ") || "no articles"}; ${pgs} pages.`);
  console.log("Done.");
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Stopped, nothing was changed:", e.message); process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
