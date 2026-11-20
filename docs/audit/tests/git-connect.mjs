// "Connect by GitHub": a normal website (no CMS code in it) is connected by its repository only.
// The CMS reads pages + blog from GitHub, previews from GitHub, and Publish writes back plain files (nothing CMS-specific added).
// Needs: backend on 3101 with GITHUB_API=http://localhost:3300 (fake GitHub), clean site copies in /tmp/gt-elan and /tmp/gt-zion.
import { readFileSync } from "node:fs";
const B = "http://localhost:3101", G = "http://localhost:3300";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("ok  ", m); } else { fail++; console.log("FAIL", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPass-123!" }) }); return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "); }
const call = async (c, m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: c, ...(b instanceof FormData ? {} : { "content-type": "application/json" }) }, body: b ? (b instanceof FormData ? b : JSON.stringify(b)) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; };
const file = async (repo, path) => { const r = await fetch(`${G}/__file?repo=${repo}&path=${encodeURIComponent(path)}`); return r.ok ? r.text() : null; };
const list = async (repo) => (await fetch(`${G}/__list?repo=${repo}`)).json();
async function waitGit(S, id, before) { for (let i = 0; i < 80; i++) { const g = (await call(S, "GET", `/api/v1/admin/websites/${id}/git`)).j; if (g.status !== "RUNNING" && g.at && g.at !== before) return g; await sleep(500); } return (await call(S, "GET", `/api/v1/admin/websites/${id}/git`)).j; }
const CMS_MARKS = /data-cms|cms-config|cms-content|elanster-cms|Elanster CMS/;

const S = await login("admin@elanster.com");
const stamp = Date.now().toString(36);
const ER = `t/elan-${stamp}`, ZR = `t/zion-${stamp}`;
await fetch(G + "/__seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: ER, dir: "/tmp/gt-elan" }) });
await fetch(G + "/__seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: ZR, dir: "/tmp/gt-zion" }) });

// ---- connect with the repository only
let r = await call(S, "POST", "/api/v1/admin/websites", { name: `Git Elan ${stamp}`, gitRepo: ER, gitBranch: "main" });
ok(r.status === 201 && !r.j.sync?.error, "Elanster-style site connected by repo " + (r.j.sync?.error ?? r.status));
const E = r.j.id; const es = r.j.sync;
ok(es?.pages?.length >= 6, `pages read from GitHub: ${es?.pages?.length}`);
ok(es?.blogFolder === "blog" && es?.posts?.added === 8, `blog folder found (blog/) and 8 articles imported: ${es?.blogFolder} ${es?.posts?.added} ${JSON.stringify(es?.posts?.problems ?? [])}`);
r = await call(S, "POST", "/api/v1/admin/websites", { name: `Git Zion ${stamp}`, gitRepo: `https://github.com/${ZR}`, gitBranch: "main" });
ok(r.status === 201 && !r.j.sync?.error, "Zion-style site connected (github.com link accepted) " + (r.j.sync?.error ?? r.status));
const Z = r.j.id; const zs = r.j.sync;
ok(zs?.blogFolder === "blogs" && zs?.posts?.added >= 10, `Zion blog folder blogs/ with articles: ${zs?.blogFolder} ${zs?.posts?.added}`);
ok((await call(S, "POST", "/api/v1/admin/websites", { name: `Bad ${stamp}`, gitRepo: "not a repo" })).status === 422, "a wrong repository name is refused");

// ---- articles came with picture, category and date
const arts = (await call(S, "GET", `/api/v1/admin/blogs?website=${E}&limit=50`)).j.items;
const cyber = arts.find((a) => a.slug.startsWith("the-hidden-cost-of-poor-cybersecurity"));
ok(cyber && cyber.status === "PUBLISHED", "article imported as live");
ok(cyber?.featuredImage?.id || cyber?.featuredImageId, "article picture imported");
ok((cyber?.category?.name ?? "") !== "", "article category imported: " + cyber?.category?.name);

// ---- preview straight from GitHub, no cookie needed, with the editor script and working assets
const pages = (await call(S, "GET", `/api/v1/admin/pages?website=${E}`)).j; const list0 = pages.items ?? pages;
const svc = list0.find((p) => p.slug === "services"); ok(!!svc, "services page listed");
let pg = (await call(S, "GET", `/api/v1/admin/pages/${svc.id}`)).j;
ok(typeof pg.preview === "string" && pg.preview.startsWith("/api/v1/site-files/"), "page has a GitHub preview address");
let pr = await fetch(B + pg.preview); let ph = await pr.text();
ok(pr.status === 200 && /text\/html/.test(pr.headers.get("content-type")), "preview page loads without sign-in");
ok(ph.includes("ELANSTER_PREVIEW") && ph.includes('"slug":"services"'), "preview carries the editor script (only in the preview)");
const cssHref = /href="(css\/styles\.css[^"]*)"/.exec(ph)?.[1];
const base = pg.preview.split("?")[0].replace(/[^/]+$/, "");
pr = await fetch(B + base + cssHref); ok(pr.status === 200 && /text\/css/.test(pr.headers.get("content-type")) && pr.headers.get("access-control-allow-origin") === "*", "preview CSS served from GitHub");
ok((await fetch(B + pg.preview.replace(/site-files\/[^/]+/, "site-files/bad.token"))).status === 403, "a wrong preview token is refused");
ok((await fetch(B + base + "../../../etc/passwd")).status !== 200, "no path tricks");

// ---- edit + publish → plain file written back, nothing CMS-specific added
const f = pg.fields.find((x) => x.tag === "h1" || x.tag === "h2");
r = await call(S, "PUT", `/api/v1/admin/pages/${svc.id}`, { draft: { [f.key]: f.text + " (edited)" }, expectedDraft: pg.draft });
ok(r.status === 200, "draft saved");
let at = (await call(S, "GET", `/api/v1/admin/websites/${E}/git`)).j.at;
r = await call(S, "POST", `/api/v1/admin/pages/${svc.id}/publish`, { action: "publish" }); ok(r.status === 200, "page published");
let g = await waitGit(S, E, at); ok(g.status === "OK", "Git run OK: " + g.message);
let s1 = await file(ER, "services.html"); (await import("node:fs")).writeFileSync("/tmp/s1.html", s1);
ok(s1.includes(" (edited)<"), "edit written to services.html in GitHub");
ok(!CMS_MARKS.test(s1), "services.html has no CMS code or markers");
const orig = readFileSync("/tmp/gt-elan/services.html", "utf8");
ok(s1.length - orig.length === " (edited)".length, `only the edited words changed (size ${orig.length} → ${s1.length})`);
ok(/hero__line-inner[^>]*>[^<]*<\/span><\/span>/.test(s1) && (s1.match(/hero__line"/g) ?? []).length === (orig.match(/hero__line"/g) ?? []).length, "heading design lines kept (animation spans untouched)");

// ---- new article → its own file from the website's article design, card on blog.html, sitemap untouched outside its block
const nb = (await call(S, "POST", "/api/v1/admin/blogs", { websiteId: E, title: "Hello From The New Connection", slug: "hello-from-the-new-connection", excerpt: "A short summary.", content: "<p>Written in the CMS.</p>", authorName: "Hensalin" })).j;
at = g.at; r = await call(S, "POST", `/api/v1/admin/blogs/${nb.id}/publish`, { action: "publish" }); ok(r.status === 200, "new article published");
g = await waitGit(S, E, at); ok(g.status === "OK", "Git run OK: " + g.message);
const a1 = await file(ER, "blog/hello-from-the-new-connection.html");
ok(a1 && a1.includes("Hello From The New Connection") && a1.includes("Written in the CMS.") && a1.includes("art-hero"), "article file made from the website's own article design");
ok(a1 && !CMS_MARKS.test(a1), "article file has no CMS code or markers");
const bl = await file(ER, "blog.html");
ok(bl.includes('href="blog/hello-from-the-new-connection.html"'), "blog page got the new card");
ok(!CMS_MARKS.test(bl), "blog.html has no CMS code or markers");
const files = await list(ER);
ok(!files.some((p) => /cms-(config|content|manifest)/.test(p)), "no CMS files added to the repo");
// unpublish → its file goes away
at = g.at; await call(S, "POST", `/api/v1/admin/blogs/${nb.id}/publish`, { action: "unpublish" });
g = await waitGit(S, E, at); ok(!(await list(ER)).includes("blog/hello-from-the-new-connection.html"), "unpublished article file removed");

// ---- someone changes the code in GitHub → Sync from GitHub reads it, the CMS edit is not lost
const now = await file(ER, "services.html");
await fetch(G + "/__outside", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: ER, path: "services.html", content: now.replace("</main>", "<section><h2>Brand new section from the developer</h2></section></main>") }) });
r = await call(S, "POST", `/api/v1/admin/websites/${E}/sync-pages`); ok(r.status === 200, "Sync from GitHub " + (r.j?.error ?? ""));
pg = (await call(S, "GET", `/api/v1/admin/pages/${svc.id}`)).j;
ok(pg.fields.some((x) => x.text === "Brand new section from the developer"), "the developer's new text appears in the editor");
ok(!(await call(S, "GET", `/api/v1/admin/blogs?website=${E}&limit=50`)).j.items.some((a, i, all) => all.findIndex((b) => b.slug === a.slug) !== i), "sync again: no duplicate articles");
// Zion: an article edit goes into its own file in blogs/
const zarts = (await call(S, "GET", `/api/v1/admin/blogs?website=${Z}&limit=50`)).j.items; const za = zarts.find((a) => a.slug === "the-cross-today") ?? zarts[0];
const zfull = (await call(S, "GET", `/api/v1/admin/blogs/${za.id}`)).j;
r = await call(S, "PUT", `/api/v1/admin/blogs/${za.id}`, { websiteId: Z, title: zfull.title, slug: zfull.slug, excerpt: zfull.excerpt, content: "<p>Edited article body for the test.</p>", categoryId: zfull.categoryId ?? null, featuredImageId: zfull.featuredImageId ?? null, authorName: zfull.authorName ?? "" });
ok(r.status === 200, "Zion article edited " + r.status + " " + (r.j?.error ?? ""));
at = (await call(S, "GET", `/api/v1/admin/websites/${Z}/git`)).j.at;
await call(S, "POST", `/api/v1/admin/blogs/${za.id}/publish`, { action: "publish" });
g = await waitGit(S, Z, at); const zf = await file(ZR, `blogs/${za.slug}.html`); (await import("node:fs")).writeFileSync("/tmp/zf.html", zf ?? "MISSING " + za.slug);
ok(zf && zf.includes("Edited article body for the test.") && !CMS_MARKS.test(zf), `Zion article written in blogs/ without CMS markers (${g.status}: ${g.message})`);

console.log(`\ngit-connect: ${pass} passed, ${fail} failed`);
