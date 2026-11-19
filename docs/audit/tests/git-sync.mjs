// After Git publishing has written edits into the website's files, "Sync from website" must still find the texts by their
// original words, so a second edit is written to Git too. (We Are Zion copy, texts without markers.)
import { execSync } from "node:child_process"; import fs from "node:fs";
const B = "http://localhost:3101", G = "http://localhost:3300", Z = "afa41ce27c4d2f7ac45ca801", ZR = "Hensalin/wearezions";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const q = (sql) => execSync(`psql "postgresql:///elanster_cms2?host=/tmp/pgt&port=5440&user=postgres" -Atc "${sql}"`).toString().trim();
const r0 = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@elanster.com", password: "TestPass-123!" }) });
const S = (r0.headers.get("set-cookie") || "").split(";")[0];
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: S, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
const file = async (p) => { const r = await fetch(`${G}/__file?repo=${ZR}&path=${encodeURIComponent(p)}`); return r.status === 200 ? r.text() : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitGit = async (before) => { for (let i = 0; i < 80; i++) { const g = (await call("GET", `/api/v1/admin/websites/${Z}/git`)).j; if (g.status !== "RUNNING" && g.at !== before) return g; await sleep(500); } return null; };
const exportRepo = async () => { execSync("mkdir -p /tmp/zgit && find /tmp/zgit -mindepth 1 -delete"); const l = await (await fetch(`${G}/__list?repo=${ZR}`)).json();
  for (const p of l) { if (/\.zip$/.test(p)) continue; const b = Buffer.from(await (await fetch(`${G}/__file?repo=${ZR}&path=${encodeURIComponent(p)}`)).arrayBuffer()); fs.mkdirSync("/tmp/zgit/" + p.split("/").slice(0, -1).join("/"), { recursive: true }); fs.writeFileSync("/tmp/zgit/" + p, b); } };

await fetch(G + "/__seed", { method: "POST", body: JSON.stringify({ repo: ZR, dir: "/tmp/zt" }) });
const domain0 = q(`select domain from websites where id='${Z}'`);
await call("PUT", `/api/v1/admin/websites/${Z}`, { gitRepo: ZR });
await call("POST", `/api/v1/admin/websites/${Z}/git`, { action: "publish" });
const pages = (await call("GET", `/api/v1/admin/pages?website=${Z}`)).j; const home = (pages.items ?? pages).find((p) => p.slug === "home");
let pg = (await call("GET", `/api/v1/admin/pages/${home.id}`)).j;
const f = pg.fields.find((x) => x.tag === "h2") ?? pg.fields.find((x) => x.tag === "p");
// edit 1
let at = (await call("GET", `/api/v1/admin/websites/${Z}/git`)).j.at;
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...pg.draft, [f.key]: "First Git edit" }, expectedUpdatedAt: pg.updatedAt });
await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" }); await waitGit(at);
ok((await file("index.html")).includes("First Git edit"), "edit 1 is in index.html");
// the live site is now the published files: sync from it
await exportRepo(); execSync("sed -i 's#localhost:3101#localhost:9#g' /tmp/zgit/js/zion.js");
q(`update websites set domain='http://localhost:3207' where id='${Z}'`);
const sy = await call("POST", `/api/v1/admin/websites/${Z}/sync-pages`);
ok(sy.status === 200, "sync from the published site: " + sy.status);
pg = (await call("GET", `/api/v1/admin/pages/${home.id}`)).j;
const f2 = pg.fields.find((x) => x.key === f.key);
ok(!!f2 && f2.text === f.text, "after sync the text keeps its original words (not the edited ones)");
ok(pg.published?.[f.key] === "First Git edit" || pg.draft?.[f.key] === "First Git edit", "after sync the published edit is kept");
ok(!pg.fields.some((x) => x.text === "First Git edit"), "the edited words did not become a new 'original' text");
// edit 2
at = (await call("GET", `/api/v1/admin/websites/${Z}/git`)).j.at;
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...pg.draft, [f.key]: "Second Git edit" }, expectedUpdatedAt: pg.updatedAt });
await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" }); const g = await waitGit(at);
const idx = await file("index.html");
ok(idx.includes("Second Git edit") && !idx.includes("First Git edit"), "edit 2 after a sync is written to Git: " + g?.status + " " + g?.message);
// two publishes at nearly the same time: both end up in Git
at = g.at; pg = (await call("GET", `/api/v1/admin/pages/${home.id}`)).j;
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...pg.draft, [f.key]: "Third edit" }, expectedUpdatedAt: pg.updatedAt });
await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
pg = (await call("GET", `/api/v1/admin/pages/${home.id}`)).j;
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...pg.draft, [f.key]: "Fourth edit" }, expectedUpdatedAt: pg.updatedAt });
await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
for (let i = 0; i < 60 && !(await file("index.html")).includes("Fourth edit"); i++) await sleep(1000);
ok((await file("index.html")).includes("Fourth edit"), "quick second publish is not lost");
// put things back
pg = (await call("GET", `/api/v1/admin/pages/${home.id}`)).j; const d = { ...pg.draft }; delete d[f.key];
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: d, expectedUpdatedAt: pg.updatedAt }); await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
await sleep(4000);
q(`update websites set domain='${domain0}', git_repo='' where id='${Z}'`);
console.log(`git-sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
