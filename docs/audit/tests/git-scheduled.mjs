// A scheduled article reaches Git by itself once its time has passed (no one presses Publish).
import { execSync } from "node:child_process";
const B = "http://localhost:3101", G = "http://localhost:3300", E = "cb1a37d1a0d725cb2ce016d0", ER = "Hensalin/elanster_website-demo";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const q = (s) => execSync(`psql "postgresql:///elanster_cms2?host=/tmp/pgt&port=5440&user=postgres" -Atc "${s}"`).toString().trim();
const r0 = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@elanster.com", password: "TestPass-123!" }) });
const S = (r0.headers.get("set-cookie") || "").split(";")[0];
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: S, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
const list = async () => (await fetch(`${G}/__list?repo=${ER}`)).json();
await fetch(G + "/__seed", { method: "POST", body: JSON.stringify({ repo: ER, dir: "/tmp/el" }) });
await call("PUT", `/api/v1/admin/websites/${E}`, { gitRepo: ER });
await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
const b = (await call("POST", "/api/v1/admin/blogs", { websiteId: E, title: "Scheduled For Git", slug: "scheduled-for-git", excerpt: "x", content: "<p>Scheduled text.</p>" })).j;
const when = new Date(Date.now() + 4000).toISOString();
let r = await call("POST", `/api/v1/admin/blogs/${b.id}/publish`, { action: "schedule", scheduledAt: when });
ok(r.status === 200, "scheduled " + r.status + " " + JSON.stringify(r.j).slice(0, 120));
await new Promise((x) => setTimeout(x, 2500));
await call("GET", "/api/v1/admin/notifications");
ok(!(await list()).includes(`blog/${b.slug}.html`), "not written before its time");
await new Promise((x) => setTimeout(x, 3500));
await call("GET", "/api/v1/admin/notifications");          // any open CMS window does this every minute
let found = false; for (let i = 0; i < 30 && !found; i++) { await new Promise((x) => setTimeout(x, 1000)); found = (await list()).includes(`blog/${b.slug}.html`); }
ok(found, "written to Git once its time passed");
await call("GET", "/api/v1/admin/notifications"); await new Promise((x) => setTimeout(x, 3000));
const n = (await (await fetch(`${G}/__log?repo=${ER}`)).json()).filter((m) => /scheduled article/.test(m)).length;
ok(n === 1, "written once, not again on every check: " + n);
q(`update blogs set deleted_at=now() where id='${b.id}'`); await call("POST", `/api/v1/admin/websites/${E}/git`, { action: "publish" });
await call("PUT", `/api/v1/admin/websites/${E}`, { gitRepo: "" });
console.log(`git-scheduled: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
