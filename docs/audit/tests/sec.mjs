// Security regression tests (run against a local test copy only).
const B = process.env.B || "http://localhost:3001"; const Z = "afa41ce27c4d2f7ac45ca801"; const out = [];
const t = (name, ok, detail = "") => out.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
const post = (path, body, cookie, ct = "application/json", extra = {}) => fetch(B + path, { method: "POST", headers: { cookie: cookie || "", "content-type": ct, ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
async function login(email, pw = "TestPass-123!") { const r = await post("/api/v1/auth/login", { email, password: pw }); return { status: r.status, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; }
// Authentication
let r = await login("nobody-here@test.com"); t("Unknown email gives the same answer as a wrong password", r.status === 401);
r = await login("admin@elanster.com", "wrong-password"); t("Wrong password refused", r.status === 401);
const sa = (await login("admin@elanster.com")).cookie; t("Super admin can sign in", !!sa);
const ad = (await login("zadmin@test.com")).cookie;
// Cookie flags
const raw = (await post("/api/v1/auth/login", { email: "zadmin@test.com", password: "TestPass-123!" })).headers.get("set-cookie") || "";
t("Session cookie is HttpOnly and SameSite", /HttpOnly/i.test(raw) && /SameSite=lax/i.test(raw), raw.replace(/=[^;]+/, "=<token>").slice(0, 90));
// Tampered / forged token
r = await fetch(B + "/api/v1/auth/me", { headers: { cookie: "cms_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxOGM0M2JlMWVhMDliZThhOWEwOWVjYzYifQ.forged" } }); t("Forged session token refused", r.status === 401);
r = await fetch(B + "/api/v1/auth/me", { headers: { cookie: "cms_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxOGM0M2JlMWVhMDliZThhOWEwOWVjYzYifQ." } }); t("alg=none token refused", r.status === 401);
// CSRF defence
r = await post(`/api/v1/admin/categories`, `{"websiteId":"${Z}","name":"csrf"}`, ad, "text/plain"); t("Plain-text (form) request to admin API refused", r.status === 415, String(r.status));
r = await post(`/api/v1/admin/categories`, { websiteId: Z, name: "csrf2" }, ad, "application/json", { "sec-fetch-site": "cross-site" }); t("Cross-site request to admin API refused", r.status === 403, String(r.status));
r = await post(`/api/v1/admin/categories`, `name=x`, ad, "application/x-www-form-urlencoded"); t("Form-encoded request refused", r.status === 415, String(r.status));
// Uploads
const fd = (bytes, type, name) => { const f = new FormData(); f.append("file", new Blob([bytes], { type }), name); f.append("websiteId", Z); return f; };
const up = (f) => fetch(B + "/api/v1/admin/media", { method: "POST", headers: { cookie: ad }, body: f });
r = await up(fd(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml", "x.svg")); t("SVG upload refused", r.status === 400);
r = await up(fd(new TextEncoder().encode("<html><script>alert(1)</script></html>"), "image/png", "evil.png")); t("HTML disguised as PNG refused (bytes checked)", r.status === 400, String(r.status));
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
r = await up(fd(png, "image/png", 'a<b>"c.png')); const pj = r.status === 201 ? await r.json() : null; t("Real PNG accepted", r.status === 201);
t("File name cleaned", pj && !/[<>"]/.test(pj.originalName), pj?.originalName);
r = await fetch(B + "/api/v1/admin/media", { method: "POST", headers: { cookie: "" }, body: fd(png, "image/png", "a.png") }); t("Upload without sign-in refused", r.status === 401);
if (pj) { const m = await fetch(B + "/api/v1/media/" + pj.id); t("Served picture has nosniff + sandbox CSP", m.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(m.headers.get("content-security-policy") || "")); }
// SSRF (local test copy allows private addresses only with ALLOW_PRIVATE_FETCH; the real server refuses them)
// Public API
r = await fetch(B + `/api/v1/websites/we-are-zion/blogs`); t("Public API without key refused", r.status === 401);
r = await fetch(B + `/api/v1/websites/elanster/blogs`, { headers: { "x-api-key": "ek_live_testonekey0000000000000000000000aa" } }); t("Zion key cannot read Elanster", r.status === 403, String(r.status));
r = await fetch(B + `/api/v1/websites/we-are-zion/blogs?limit=50`, { headers: { "x-api-key": "ek_live_testonekey0000000000000000000000aa" } });
const pb = await r.json(); t("Public API returns only published articles", pb.items.every((x) => x.publishedAt));
r = await fetch(B + `/api/v1/websites/we-are-zion/blogs/does-not-exist'%20OR%201=1--`, { headers: { "x-api-key": "ek_live_testonekey0000000000000000000000aa" } }); t("SQL-injection-like slug is harmless (404)", r.status === 404, String(r.status));
// XSS in article content is cleaned
r = await post("/api/v1/admin/blogs", { websiteId: Z, title: "XSS test", content: '<p>hi<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">x</a><iframe src="https://evil"></iframe></p>' }, ad);
const xb = await r.json(); t("Article HTML cleaned (no script, onerror, javascript:, iframe)", r.status === 201 && !/script|onerror|javascript:|iframe/i.test(xb.content), xb.content?.slice(0, 80));
if (xb.id) await fetch(B + "/api/v1/admin/blogs/" + xb.id, { method: "DELETE", headers: { cookie: ad } });
// Mass assignment: editor cannot set status/author fields through save
// Session revocation after password reset
const ed = (await login("zeditor@test.com")).cookie;
const reset = await post("/api/v1/admin/people/zeditoruser1/reset-password", {}, sa); const tmp = (await reset.json()).password;
await new Promise((res) => setTimeout(res, 1200));
r = await fetch(B + "/api/v1/auth/me", { headers: { cookie: ed } }); t("Old sign-in stops working after a password reset", r.status === 401, String(r.status));
const ed2 = (await login("zeditor@test.com", tmp)).cookie; r = await fetch(B + "/api/v1/auth/me", { headers: { cookie: ed2 } }); t("New sign-in with the temporary password works", r.status === 200);
// restore test password
const ok = await fetch(B + "/api/v1/admin/account", { method: "PATCH", headers: { cookie: ed2, "content-type": "application/json" }, body: JSON.stringify({ name: "Eli Editor", email: "zeditor@test.com", currentPassword: tmp, newPassword: "TestPass-123!" }) });
t("Changing own password works and keeps this device signed in", ok.status === 200 && (await fetch(B + "/api/v1/auth/me", { headers: { cookie: (ok.headers.get("set-cookie") || "").split(";")[0] } })).status === 200);
r = await fetch(B + "/api/v1/auth/me", { headers: { cookie: ed2 } }); t("Other devices signed out after a password change", r.status === 401, String(r.status));
// Rate limit
let last = 0; for (let i = 0; i < 10; i++) last = (await login("zadmin@test.com", "bad-" + i)).status; t("Repeated wrong passwords get locked (429)", last === 429, String(last));
// Security headers
r = await fetch(B + "/api/v1/auth/me"); t("Backend sends nosniff / frame / referrer headers", !!r.headers.get("x-content-type-options") && !!r.headers.get("x-frame-options") && !!r.headers.get("referrer-policy"));
t("Backend does not reveal X-Powered-By", !r.headers.get("x-powered-by"));
console.log(out.join("\n")); console.log(`\n${out.filter((x) => x.startsWith("PASS")).length} passed, ${out.filter((x) => x.startsWith("FAIL")).length} failed`);
