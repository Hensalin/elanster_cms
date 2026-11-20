// Notifications: seen ones leave the bell, new events come back, Super Admin gets reviews, each person only their own.
const B = "http://localhost:3101", Z = "afa41ce27c4d2f7ac45ca801";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPass-123!" }) }); return (r.headers.get("set-cookie") || "").split(";")[0]; }
const call = async (c, m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: c, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
const SA = await login("admin@elanster.com"), ZA = await login("zadmin@test.com"), ZE = await login("zeditor@test.com"), EA = await login("admin@test.com");
const notes = async (c) => (await call(c, "GET", "/api/v1/admin/notifications")).j;
// the editor sends a page for review
const pages = (await call(ZA, "GET", `/api/v1/admin/pages?website=${Z}`)).j; const pg0 = (pages.items ?? pages).find((p) => p.slug === "about") ?? (pages.items ?? pages)[0];
let pg = (await call(ZE, "GET", `/api/v1/admin/pages/${pg0.id}`)).j; const f = pg.fields.find((x) => x.tag === "p");
await call(ZA, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "withdraw" }).catch(() => {});
pg = (await call(ZE, "GET", `/api/v1/admin/pages/${pg0.id}`)).j;
let r = await call(ZE, "PUT", `/api/v1/admin/pages/${pg0.id}`, { draft: { ...pg.draft, [f.key]: "Notification test " + Date.now() }, expectedUpdatedAt: pg.updatedAt });
ok(r.status === 200, "editor saved a draft " + r.status);
r = await call(ZE, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "submit" }); ok(r.status === 200, "editor sent it for review " + r.status);
const id = "pr" + pg0.id;
let n = await notes(ZA); let it = n.items.find((x) => x.id === id);
ok(it && !it.seen && n.unseen >= 1, "website admin: new review notification, unseen");
let s = await notes(SA); ok(s.items.some((x) => x.id === id && !x.seen), "super admin also gets the review notification");
ok(!(await notes(EA)).items.some((x) => x.id === id), "an admin of another website does not get it");
ok(!(await notes(ZE)).items.some((x) => x.id === id), "the editor does not get their own review request");
// seen once → leaves the bell (for this person only)
r = await call(ZA, "POST", "/api/v1/admin/notifications", { keys: [it.key] }); ok(r.status === 200 && r.j.marked === 1, "marked as seen");
n = await notes(ZA); it = n.items.find((x) => x.id === id); ok(it.seen, "website admin: now seen");
ok(!(await notes(SA)).items.find((x) => x.id === id).seen, "super admin: still new for them (seen is per person)");
const unseenBefore = n.unseen;
// a new event on the same item comes back as new
await call(ZE, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "withdraw" });
await new Promise((ok2) => setTimeout(ok2, 1100));
await call(ZE, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "submit" });
n = await notes(ZA); it = n.items.find((x) => x.id === id); ok(it && !it.seen, "sent again → new again");
// mark all
r = await call(ZA, "POST", "/api/v1/admin/notifications", { all: true }); ok(r.status === 200, "mark all");
n = await notes(ZA); ok(n.unseen === 0 && n.items.every((x) => x.seen), "after 'Mark all as read' nothing is new: " + n.unseen);
// admin asks for changes → the editor gets it; saving drafts does not make it new again
await call(ZA, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "request_changes", note: "Please shorten this." });
let e = await notes(ZE); let ch = e.items.find((x) => x.id === "pc" + pg0.id); ok(ch && !ch.seen, "editor: changes requested, new");
await call(ZE, "POST", "/api/v1/admin/notifications", { keys: [ch.key] });
ok((await notes(ZE)).items.find((x) => x.id === "pc" + pg0.id).seen, "editor: seen");
// bad input is refused
ok((await call(ZE, "POST", "/api/v1/admin/notifications", { keys: "x" })).status === 422, "bad input refused");
ok((await fetch(B + "/api/v1/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 401, "not signed in → 401");
// clean up: put the page back
pg = (await call(ZA, "GET", `/api/v1/admin/pages/${pg0.id}`)).j;
await call(ZA, "POST", `/api/v1/admin/pages/${pg0.id}/publish`, { action: "discard" });
console.log(`notifications: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
