// The sync must never bring Git publishing's own article pages back in as new articles ("article-article-…").
// Needs: backend on 3101 with the fake GitHub (3300), and a static server on 3206 serving /tmp/elgit (refreshed by this script).
import { execSync } from "node:child_process";
const B = "http://localhost:3101", G = "http://localhost:3300", E = "cb1a37d1a0d725cb2ce016d0", ER = "Hensalin/elanster_website-demo";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const PG = `psql "postgresql:///elanster_cms2?host=/tmp/pgt&port=5440&user=postgres" -Atc`;
const q = (sql) => execSync(`${PG} "${sql}"`).toString().trim();
const r0 = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@elanster.com", password: "TestPass-123!" }) });
const S = (r0.headers.get("set-cookie") || "").split(";")[0];
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: S, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
const exportRepo = async () => { execSync("mkdir -p /tmp/elgit && find /tmp/elgit -mindepth 1 -delete"); const l = await (await fetch(`${G}/__list?repo=${ER}`)).json();
  for (const p of l) { const b = Buffer.from(await (await fetch(`${G}/__file?repo=${ER}&path=${encodeURIComponent(p)}`)).arrayBuffer()); execSync(`mkdir -p "/tmp/elgit/${p.split("/").slice(0, -1).join("/") || "."}"`); (await import("node:fs")).writeFileSync("/tmp/elgit/" + p, b); } };
const copies = () => Number(q(`select count(*) from blogs where website_id='${E}' and deleted_at is null and slug like 'article-%'`));
const copyPages = () => Number(q(`select count(*) from pages where website_id='${E}' and deleted_at is null and slug like 'article-%'`));
const realArticles = () => Number(q(`select count(*) from blogs where website_id='${E}' and deleted_at is null and slug not like 'article-%'`));

await fetch(G + "/__seed", { method: "POST", body: JSON.stringify({ repo: ER, dir: "/tmp/el" }) });
const domain0 = q(`select domain from websites where id='${E}'`);
await call("PUT", `/api/v1/admin/websites/${E}`, { gitRepo: ER });
let r = await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
ok(r.j.status === "OK", "publish: " + r.j.status);
await exportRepo();
ok(execSync("grep -l 'name=\"generator\" content=\"Elanster CMS\"' /tmp/elgit/article-*.html | wc -l").toString().trim() !== "0", "generated article pages carry the CMS tag");
// Serve the published website and sync from it, twice. (A first sync brings in the site's own built-in articles, if the CMS lacks any.)
q(`update websites set domain='http://localhost:3206' where id='${E}'`);
await call("POST", `/api/v1/admin/websites/${E}/sync-pages`); await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" }); await exportRepo();
const real0 = realArticles();
for (let i = 1; i <= 2; i++) {
  r = await call("POST", `/api/v1/admin/websites/${E}/sync-pages`);
  ok(r.status === 200, `sync ${i}: ${r.status} ${JSON.stringify(r.j).slice(0, 160)}`);
  ok(copies() === 0, `sync ${i}: no "article-…" copies of articles (${copies()})`);
  ok(copyPages() === 0, `sync ${i}: no "article-…" pages (${copyPages()})`);
  ok(realArticles() === real0, `sync ${i}: real articles unchanged (${realArticles()} vs ${real0})`);
  r = await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
  ok(r.j.files === 0, `sync ${i}: the next publish has nothing new to write (${r.j.files})`);
  await exportRepo();
}
// Old generated pages without the tag (written before this fix) are recognised too.
execSync("sed -i '/name=\"generator\" content=\"Elanster CMS\"/d' /tmp/elgit/article-*.html");
r = await call("POST", `/api/v1/admin/websites/${E}/sync-pages`);
ok(copies() === 0 && copyPages() === 0, `sync with untagged old pages: no copies (${copies()}, ${copyPages()})`);

// Cleaning up copies made before the fix
const first = q(`select slug from blogs where website_id='${E}' and deleted_at is null and status='PUBLISHED' and slug not like 'article-%' limit 1`);
q(`insert into blogs (id, website_id, title, slug, excerpt, content, status, published_at) values ('copyA00000000000000000aa','${E}','Copy A','article-${first}','x','<p>x</p>','PUBLISHED', now()), ('copyB00000000000000000bb','${E}','Copy B','article-article-${first}','x','<p>x</p>','PUBLISHED', now()), ('keepC00000000000000000cc','${E}','A real one','article-writing-tips','x','<p>x</p>','PUBLISHED', now()), ('copyD00000000000000000dd','${E}','Orphan copy','article-gone-post','x','<p><a href=\"blog.html\">← All articles</a></p><h2>Keep reading</h2>','PUBLISHED', now())`);
q(`insert into pages (id, website_id, title, slug, status, content) values ('copyP00000000000000000pp','${E}','x','article-${first}','DRAFT','{}')`);
r = await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
ok(r.j.files > 0, "the copies were written to Git (as the bug did)");
r = await call("GET", `/api/v1/admin/websites/${E}/git`);
ok(r.j.copies.articles === 3 && r.j.copies.pages === 1, "copies found: " + JSON.stringify(r.j.copies));
const ed = await (async () => { const x = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "editor@test.com", password: "TestPass-123!" }) }); return (x.headers.get("set-cookie") || "").split(";")[0]; })();
ok((await fetch(B + `/api/v1/admin/websites/${E}/git`, { method: "POST", headers: { cookie: ed, "content-type": "application/json" }, body: JSON.stringify({ action: "remove_copies" }) })).status === 403, "an editor cannot remove copies");
r = await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "remove_copies" });
ok(r.j.removed.articles === 3 && r.j.removed.pages === 1, "removed: " + JSON.stringify(r.j.removed));
ok(q(`select count(*) from blogs where id='keepC00000000000000000cc' and deleted_at is null`) === "1", "an article whose name only starts with 'article-' is kept");
ok(q(`select count(*) from blogs where id in ('copyA00000000000000000aa','copyB00000000000000000bb') and deleted_at is not null`) === "2", "copies are hidden, not erased");
const files = await (await fetch(`${G}/__list?repo=${ER}`)).json();
ok(!files.some((f) => f.startsWith(`article-article-${first}`) || f === `article-article-article-${first}.html`), "their files are gone from GitHub");
ok(files.includes(`article-${first}.html`), "the real article's page is still there");
ok(r.j.copies.articles === 0, "nothing left to clean");

q(`delete from blogs where id in ('copyA00000000000000000aa','copyB00000000000000000bb','keepC00000000000000000cc','copyD00000000000000000dd'); delete from pages where id='copyP00000000000000000pp'`);
q(`update websites set domain='${domain0}', git_repo='' where id='${E}'`);
console.log(`git-copies: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
