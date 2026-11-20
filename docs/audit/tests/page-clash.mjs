// Page editor: no false "someone else saved" warning; a real clash with another person is still caught.
const B = "http://localhost:3101", Z = "afa41ce27c4d2f7ac45ca801";
import { execSync } from "node:child_process";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("ok  ", m); } else { fail++; console.log("FAIL", m); } };
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPass-123!" }) }); return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "); }
const call = async (c, m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: c, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; };
const ZA = await login("zadmin@test.com"), ZE = await login("zeditor@test.com");
const list = (await call(ZA, "GET", `/api/v1/admin/pages?website=${Z}`)).j; const p0 = (list.items ?? list).find((p) => p.slug === "about") ?? (list.items ?? list)[0];
await call(ZA, "POST", `/api/v1/admin/pages/${p0.id}/publish`, { action: "withdraw" });
let pg = (await call(ZA, "GET", `/api/v1/admin/pages/${p0.id}`)).j; const f = pg.fields.find((x) => x.tag === "p");
const opened = pg.updatedAt; let base = pg.draft;
let r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...pg.published, ...base, [f.key]: "Clash test A1" }, expectedUpdatedAt: opened, expectedDraft: base });
ok(r.status === 200, "admin saves " + r.status); base = r.j.draft;
// something else (a sync or a publish) touches the page time
execSync(`psql "postgresql:///elanster_cms2?host=/tmp/pgt&port=5440&user=postgres" -qc "update pages set updated_at = now() + interval '1 minute' where id='${p0.id}'"`);
r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...base, [f.key]: "Clash test A2" }, expectedUpdatedAt: opened, expectedDraft: base });
ok(r.status === 200, "admin saves again after the page time changed: no false warning " + r.status); base = r.j.draft;
r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...base, [f.key]: "Clash test A3" }, expectedUpdatedAt: opened });
ok(r.status === 200, "own repeated saves never clash, even from an old screen " + r.status); base = r.j.draft;
// another person really changes the texts
const e = (await call(ZE, "GET", `/api/v1/admin/pages/${p0.id}`)).j;
r = await call(ZE, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...e.draft, [f.key]: "Clash test EDITOR" }, expectedUpdatedAt: e.updatedAt, expectedDraft: e.draft });
ok(r.status === 200, "editor saves a change " + r.status);
r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...base, [f.key]: "Clash test A4" }, expectedUpdatedAt: opened, expectedDraft: base });
ok(r.status === 409, "admin with an old screen is warned about the editor's change " + r.status);
r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...base, [f.key]: "Clash test A4" }, expectedUpdatedAt: opened });
ok(r.status === 409, "older screens (time only) are also warned " + r.status);
pg = (await call(ZA, "GET", `/api/v1/admin/pages/${p0.id}`)).j;
ok(pg.draft[f.key] === "Clash test EDITOR", "the editor's text was not overwritten");
r = await call(ZA, "PUT", `/api/v1/admin/pages/${p0.id}`, { draft: { ...pg.draft, [f.key]: "Clash test A5" }, expectedUpdatedAt: pg.updatedAt, expectedDraft: pg.draft });
ok(r.status === 200, "after reloading, the admin can save " + r.status);
// tidy up: put the page text back
r = await call(ZA, "POST", `/api/v1/admin/pages/${p0.id}/publish`, { action: "discard" });
console.log(`\n${pass} passed, ${fail} failed`);
