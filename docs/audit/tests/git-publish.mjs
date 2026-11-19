// Git publishing, end to end, against a fake GitHub (localhost:3300) seeded with copies of the Elanster demo and We Are Zion.
// Run with the backend started with GITHUB_API=http://localhost:3300 GITHUB_TOKEN=test-token.
import { readFileSync } from "node:fs";
const B = "http://localhost:3101", G = "http://localhost:3300";
const E = "cb1a37d1a0d725cb2ce016d0", Z = "afa41ce27c4d2f7ac45ca801";
const ER = "Hensalin/elanster_website-demo", ZR = "Hensalin/wearezions";
let pass = 0, fail = 0; const seen = [];
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPass-123!" }) }); return (r.headers.get("set-cookie") || "").split(";")[0]; }
async function call(cookie, m, path, body) {
  const r = await fetch(B + path, { method: m, headers: { cookie, ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const t = await r.text(); seen.push(t); let j = null; try { j = JSON.parse(t); } catch { /* */ } return { status: r.status, j, t };
}
const file = async (repo, p) => { const r = await fetch(`${G}/__file?repo=${repo}&path=${encodeURIComponent(p)}`); return r.status === 200 ? await r.text() : null; };
const list = async (repo) => (await fetch(`${G}/__list?repo=${repo}`)).json();
const commits = async (repo) => (await fetch(`${G}/__log?repo=${repo}`)).json();
const post = (p, b) => fetch(G + p, { method: "POST", body: JSON.stringify(b) });
async function waitGit(S, id, before) {   // publish runs after the answer: wait until the run has finished
  for (let i = 0; i < 60; i++) { const g = (await call(S, "GET", `/api/v1/admin/websites/${id}/git`)).j; if (g.status !== "RUNNING" && g.at && g.at !== before) return g; await sleep(500); }
  return (await call(S, "GET", `/api/v1/admin/websites/${id}/git`)).j;
}
const gitAt = async (S, id) => (await call(S, "GET", `/api/v1/admin/websites/${id}/git`)).j.at;

await post("/__seed", { repo: ER, dir: "/tmp/el" }); await post("/__seed", { repo: ZR, dir: "/tmp/zt" });
const S = await login("admin@elanster.com"), ED = await login("editor@test.com");

// ---- settings
ok((await call(S, "PUT", `/api/v1/admin/websites/${E}`, { gitRepo: "not a repo" })).status === 422, "bad repo name refused");
ok((await call(S, "PUT", `/api/v1/admin/websites/${E}`, { gitBranch: "../x" })).status === 422, "bad branch refused");
ok((await call(ED, "PUT", `/api/v1/admin/websites/${E}`, { gitRepo: ER })).status === 403, "editor cannot set the repo");
ok((await call(ED, "GET", `/api/v1/admin/websites/${E}/git`)).status === 403, "editor cannot read git status");
ok((await call(ED, "POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" })).status === 403, "editor cannot publish to git");
ok((await call(S, "PUT", `/api/v1/admin/websites/${E}`, { gitRepo: ER, gitBranch: "main" })).status === 200, "repo saved");

// ---- first run: writes the already-published content
const n0 = (await commits(ER)).length;
let r = await call(S, "POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
ok(r.status === 200 && ["OK", "WARN"].includes(r.j.status), "first publish: " + r.j?.status + " " + r.j?.message);
ok((await commits(ER)).length === n0 + 1, "first publish = exactly one commit");
const files = await list(ER);
ok(files.includes("article-final-check-article.html") && files.includes("article-quick-post-from-the-new-editor.html"), "article pages written for live articles");
ok(!files.some((f) => /^article-(slide-over|review-flow|close|draft-saved)/.test(f)), "no pages for drafts");
const art = await file(ER, "article-final-check-article.html");
ok(art.includes('<link rel="canonical" href="https://www.elanster.com/article-final-check-article.html">'), "canonical is the real address");
ok(!/js\/blog\.js/.test(art), "the website script that would overwrite the article is removed");
ok(art.includes('id="articleApp"><a class="art__back"') && art.includes('<div class="art__body">'), "article written into the real design");
ok(art.includes('"@type":"Article"') && /<title>[^<]+\| Elanster<\/title>/.test(art), "Google tags");
ok(art.includes("css/styles.css") && art.includes('class="nav__links"'), "same menu and styles as the website");
{ const menu = (h) => (/<nav class="nav__links"[\s\S]*?<\/nav>/.exec(h) || [""])[0].replace(/\s*(class="is-active"|aria-current="page"|data-cms="[^"]*")/g, "").replace(/\s+/g, " ");
  const want = menu(await file(ER, "index.html")).replace(/href="[^"]*"/g, ""), got = menu(art).replace(/href="[^"]*"/g, "");
  ok(want.replace(/<[^>]+>/g, "|") === got.replace(/<[^>]+>/g, "|"), "article pages get the shared menu edits too"); }
const bl = await file(ER, "blog.html");
ok(bl.includes('id="blogList" data-cms-list="articles"') && !bl.includes('id="blogApp"'), "blog page: list written as real HTML (the website script leaves it alone)");
ok(bl.includes('href="article-final-check-article.html"') && bl.includes('href="article-quick-post-from-the-new-editor.html"'), "blog page: cards link to the real article pages");
ok(!/href="article-(slide-over|review-flow|close|draft-saved)/.test(bl), "blog page: no drafts in the list");
const sm = await file(ER, "sitemap.xml");
ok(sm.includes("<!-- cms:start -->") && sm.includes("https://www.elanster.com/article-final-check-article.html") && sm.includes("https://www.elanster.com/work.html"), "sitemap: our block added, the rest kept");
const idx0 = await file(ER, "index.html"), orig = readFileSync("/tmp/el/index.html", "utf8");
ok(idx0 !== orig && Math.abs(idx0.length - orig.length) < 3000, "home page edits written (small change)");

// ---- repeat: nothing to change
r = await call(S, "POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
ok(r.j.files === 0 && (await commits(ER)).length === n0 + 1, "second run changes nothing and makes no commit");

// ---- page edit → publish → file updated; unpublish → file back to the original, byte for byte
const pages = (await call(S, "GET", `/api/v1/admin/pages?website=${E}`)).j;
const prod = (pages.items ?? pages).find((p) => p.slug === "products");
const pg = (await call(S, "GET", `/api/v1/admin/pages/${prod.id}`)).j;
const field = pg.fields.find((f) => /^h[12]$/.test(f.tag)) ?? pg.fields.find((f) => f.tag !== "image" && !f.tag.startsWith("seo"));
const work0 = await file(ER, "work.html");   // already has the published shared menu/footer edits
let at = await gitAt(S, E);
r = await call(S, "PUT", `/api/v1/admin/pages/${prod.id}`, { draft: { [field.key]: "Git test heading" }, expectedUpdatedAt: pg.updatedAt });
ok(r.status === 200, "draft saved " + r.status + r.t.slice(0, 120));
ok((await file(ER, "work.html")) === work0, "a draft is not written to Git");
r = await call(S, "POST", `/api/v1/admin/pages/${prod.id}/publish`, { action: "publish" });
ok(r.status === 200, "page published");
let g = await waitGit(S, E, at);
ok(g.status === "OK", "git run after publish: " + g.status + " " + g.message);
const work = await file(ER, "work.html");
ok(work.includes(">Git test heading<"), "new heading is in work.html");
ok(work.replace(">Git test heading<", ">" + field.text.replace(/&/g, "&amp;") + "<") === work0, "nothing else in work.html changed");
ok((await commits(ER))[0].includes("publish page products"), "commit message says what happened: " + (await commits(ER))[0]);
at = g.at;
await call(S, "POST", `/api/v1/admin/pages/${prod.id}/publish`, { action: "unpublish" });
g = await waitGit(S, E, at);
ok((await file(ER, "work.html")) === work0, "unpublish takes the page edits out again, byte for byte");

// ---- new article with a picture → page + picture; unpublish → both removed
const fd = new FormData(); fd.append("websiteId", E); fd.append("file", new Blob([readFileSync("/home/claude/gt/t.png")], { type: "image/png" }), "cover.png");
const media = (await call(S, "POST", "/api/v1/admin/media", fd)).j;
ok(!!media?.id, "picture uploaded");
const blog = (await call(S, "POST", "/api/v1/admin/blogs", { websiteId: E, title: "Git Published Article", slug: "git-published-article", excerpt: "Short summary", content: `<p>Hello from Git.</p><p><img src="/api/v1/media/${media.id}" alt="x"></p>`, featuredImageId: media.id, authorName: "Hensalin" })).j;
at = g.at;
r = await call(S, "POST", `/api/v1/admin/blogs/${blog.id}/publish`, { action: "publish" });
ok(r.status === 200, "article published");
g = await waitGit(S, E, at);
const a2 = await file(ER, `article-${blog.slug}.html`);
ok(a2 && a2.includes("<h1>Git Published Article</h1>") && a2.includes("Hello from Git.") && a2.includes("<span>Hensalin</span>"), "new article page written");
ok(a2.includes(`/assets/uploads/${media.id}.png`) && !a2.includes("/api/v1/media/"), "pictures point to the committed copy, not the CMS");
ok((await list(ER)).includes(`assets/uploads/${media.id}.png`), "picture committed");
const bl2 = await file(ER, "blog.html");
ok(bl2.indexOf(`href="article-${blog.slug}.html"`) > -1 && bl2.indexOf(`href="article-${blog.slug}.html"`) < bl2.indexOf('href="article-final-check-article.html"'), "blog page: the new article is the first card");
ok(bl2.includes(`/assets/uploads/${media.id}.png`), "blog page: card picture is the committed copy");
ok((await file(ER, "sitemap.xml")).includes(`article-${blog.slug}.html`), "sitemap lists the new article");
at = g.at;
await call(S, "POST", `/api/v1/admin/blogs/${blog.id}/publish`, { action: "unpublish" });
g = await waitGit(S, E, at);
const after = await list(ER);
ok(!after.includes(`article-${blog.slug}.html`), "unpublished article page removed");
ok(!after.includes(`assets/uploads/${media.id}.png`), "picture no longer used is removed");
ok(!(await file(ER, "sitemap.xml")).includes(`article-${blog.slug}.html`), "sitemap entry removed");
ok(!(await file(ER, "blog.html")).includes(`article-${blog.slug}.html`), "blog page: unpublished article's card removed");
ok(after.includes("work.html") && after.includes("css/styles.css") && after.length > 50, "nothing else deleted");

// ---- someone edits a file directly in Git: the CMS does not overwrite it, until told to
const outside = (await file(ER, "index.html")).replace("</body>", "<!-- edited on GitHub --></body>");
await post("/__outside", { repo: ER, path: "index.html", content: outside });
const home = (pages.items ?? pages).find((p) => p.slug === "home");
const hp = (await call(S, "GET", `/api/v1/admin/pages/${home.id}`)).j;
const hf = hp.fields.find((f) => f.tag === "p") ?? hp.fields.find((f) => !f.tag.startsWith("seo") && f.tag !== "image");
await call(S, "PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...hp.draft, [hf.key]: "Changed after the outside edit" }, expectedUpdatedAt: hp.updatedAt });
at = g.at; await call(S, "POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
g = await waitGit(S, E, at);
ok(g.status === "WARN" && /index\.html: changed in Git outside the CMS/.test(g.message), "outside edit detected: " + g.status + " " + g.message);
ok((await file(ER, "index.html")) === outside, "the outside edit was not overwritten");
r = await call(S, "POST", `/api/v1/admin/websites/${E}/git`, { action: "take_over", file: "index.html" });
const idx2 = await file(ER, "index.html");
ok(r.j.status === "OK" && idx2.includes("<!-- edited on GitHub -->") && idx2.includes("Changed after the outside edit"), "take over keeps the outside edit and adds the CMS change");

// ---- GitHub down: Publish still works in the CMS, the git status says what failed, retry fixes it
await post("/__fail", { on: true });
at = g.at === r.j.at ? r.j.at : (await gitAt(S, E));
const hp2 = (await call(S, "GET", `/api/v1/admin/pages/${home.id}`)).j;
await call(S, "PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...hp2.draft, [hf.key]: "Written while GitHub was down" }, expectedUpdatedAt: hp2.updatedAt });
r = await call(S, "POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
ok(r.status === 200, "publish in the CMS still works when GitHub is down");
g = await waitGit(S, E, at);
ok(g.status === "FAILED" && /GitHub/.test(g.message), "status shows the failure: " + g.message);
await post("/__fail", { on: false });
r = await call(S, "POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
ok(r.j.status === "OK" && (await file(ER, "index.html")).includes("Written while GitHub was down"), "retry writes the change");

// ---- website without markers (We Are Zion copy): texts found by their wording
ok((await call(S, "PUT", `/api/v1/admin/websites/${Z}`, { gitRepo: ZR })).status === 200, "zion repo saved");
r = await call(S, "POST", `/api/v1/admin/websites/${Z}/git`, { action: "publish" });
const zpages = (await call(S, "GET", `/api/v1/admin/pages?website=${Z}`)).j;
const zh = (zpages.items ?? zpages).find((p) => p.slug === "home");
const zp = (await call(S, "GET", `/api/v1/admin/pages/${zh.id}`)).j;
const zf = zp.fields.find((f) => f.tag === "h2") ?? zp.fields.find((f) => f.tag === "p");
const zbefore = await file(ZR, "index.html");
await call(S, "PUT", `/api/v1/admin/pages/${zh.id}`, { draft: { ...zp.draft, [zf.key]: "Zion heading from Git" }, expectedUpdatedAt: zp.updatedAt });
at = await gitAt(S, Z);
await call(S, "POST", `/api/v1/admin/pages/${zh.id}/publish`, { action: "publish" });
g = await waitGit(S, Z, at);
const zafter = await file(ZR, "index.html");
ok(zafter.includes("Zion heading from Git") && g.status !== "FAILED", "markerless page edited: " + g.status + " " + g.message);
ok(Math.abs(zafter.length - zbefore.length) < 400, "only that text changed on the markerless page");

// ---- the token never leaves the server
ok(!seen.some((t) => t.includes("test-token")), "the GitHub token is never in any answer");
console.log(`git-publish: ${pass} passed, ${fail} failed`);
await call(S, "PUT", `/api/v1/admin/websites/${E}`, { gitRepo: "" }); await call(S, "PUT", `/api/v1/admin/websites/${Z}`, { gitRepo: "" });
process.exit(fail ? 1 : 0);
