// Two people edit the same article / page: the second save must not silently overwrite the first.
const B = "http://localhost:3101"; const res = []; const t = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const j = (path, method, body, cookie) => fetch(B + path, { method, headers: { cookie: cookie || "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const login = async (email) => ((await j("/api/v1/auth/login", "POST", { email, password: "TestPass-123!" })).headers.get("set-cookie") || "").split(";")[0];
const a = await login("zadmin@test.com"), s = await login("admin@elanster.com"); const Z = "afa41ce27c4d2f7ac45ca801";
const b = await (await j("/api/v1/admin/blogs", "POST", { websiteId: Z, title: "Concurrency test" }, a)).json();
const opened = b.updatedAt;
let r = await j(`/api/v1/admin/blogs/${b.id}`, "PUT", { websiteId: Z, title: "Saved by person 1", expectedUpdatedAt: opened }, a); const one = await r.json(); t("First save works", r.status === 200);
r = await j(`/api/v1/admin/blogs/${b.id}`, "PUT", { websiteId: Z, title: "Saved by person 2 (old screen)", expectedUpdatedAt: opened }, s); t("Second save from an old screen is refused (409)", r.status === 409, String(r.status));
r = await j(`/api/v1/admin/blogs/${b.id}`, "PUT", { websiteId: Z, title: "Saved by person 1 again", expectedUpdatedAt: one.updatedAt }, a); t("Saving again from the up-to-date screen works", r.status === 200);
await j(`/api/v1/admin/blogs/${b.id}`, "DELETE", null, a);
const pg = await (await j("/api/v1/admin/pages/1ddcae6f0ebc2f729377166a", "GET", null, a)).json();
r = await j(`/api/v1/admin/pages/${pg.id}`, "PUT", { draft: pg.draft, expectedUpdatedAt: pg.updatedAt }, a); const p1 = await r.json(); t("Page save works", r.status === 200 && !!p1.updatedAt);
r = await j(`/api/v1/admin/pages/${pg.id}`, "PUT", { draft: pg.draft, expectedUpdatedAt: pg.updatedAt }, s); t("Page save from an old screen is refused (409)", r.status === 409, String(r.status));
r = await j(`/api/v1/admin/pages/${pg.id}`, "PUT", { draft: pg.draft }, s); t("Older clients without the check still work", r.status === 200);
console.log(res.join("\n")); console.log(`\n${res.filter((x) => x.startsWith("PASS")).length} passed, ${res.filter((x) => x.startsWith("FAIL")).length} failed`);
