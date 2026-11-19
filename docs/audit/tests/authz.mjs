// Authorization test: a We Are Zion editor / website admin / anonymous tries to reach Elanster's resources and admin-only features.
const B = "http://localhost:3101"; const E = "cb1a37d1a0d725cb2ce016d0";
const ids = { blog: "fbcd516d1c10c324283a7aed", page: "47ed15b879f3af77e5b29cf0", media: "9773b153e950bfff3251165e", cat: "c_34b685c44dac", ver: "vmwn1fh0max8rkk", key: "f72fc45790014131b258f908", user: "18c43be1ea09be8a9a09ecc6" };
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPass-123!" }) });
  return (r.headers.get("set-cookie") || "").split(";")[0]; }
const cases = [
  ["GET", `/api/v1/admin/blogs/${ids.blog}`], ["PUT", `/api/v1/admin/blogs/${ids.blog}`, { websiteId: E, title: "hacked" }], ["DELETE", `/api/v1/admin/blogs/${ids.blog}`],
  ["POST", `/api/v1/admin/blogs/${ids.blog}/publish`, { action: "unpublish" }], ["POST", `/api/v1/admin/blogs/${ids.blog}/duplicate`], ["POST", `/api/v1/admin/blogs/${ids.blog}/preview`, { websiteId: E, title: "x" }],
  ["POST", `/api/v1/admin/blogs`, { websiteId: E, title: "x" }],
  ["GET", `/api/v1/admin/pages/${ids.page}`], ["PUT", `/api/v1/admin/pages/${ids.page}`, { draft: {} }], ["POST", `/api/v1/admin/pages/${ids.page}/publish`, { action: "publish" }],
  ["DELETE", `/api/v1/admin/media/${ids.media}`], ["PUT", `/api/v1/admin/media/${ids.media}`, { altText: "x" }],
  ["PATCH", `/api/v1/admin/categories/${ids.cat}`, { name: "x" }], ["DELETE", `/api/v1/admin/categories/${ids.cat}`], ["POST", `/api/v1/admin/categories`, { websiteId: E, name: "x" }],
  ["POST", `/api/v1/admin/versions/${ids.ver}`], ["GET", `/api/v1/admin/versions?entity=blog&id=${ids.blog}`],
  ["GET", `/api/v1/admin/websites/${E}/check`], ["POST", `/api/v1/admin/websites/${E}/sync-pages`], ["GET", `/api/v1/admin/websites/${E}/api-keys`],
  ["POST", `/api/v1/admin/websites/${E}/api-keys`, { label: "x" }], ["DELETE", `/api/v1/admin/websites/${E}/api-keys/${ids.key}`], ["PUT", `/api/v1/admin/websites/${E}`, { active: false }],
  ["DELETE", `/api/v1/admin/websites/${E}`], ["POST", `/api/v1/admin/websites`, { name: "x", domain: "https://x.com" }],
  ["GET", `/api/v1/admin/people`], ["PATCH", `/api/v1/admin/people/${ids.user}`, { role: "EDITOR" }], ["POST", `/api/v1/admin/people/${ids.user}/reset-password`], ["DELETE", `/api/v1/admin/people/${ids.user}`],
  ["GET", `/api/v1/admin/media?website=${E}`], ["GET", `/api/v1/admin/pages?website=${E}`], ["GET", `/api/v1/admin/blogs?website=${E}`], ["GET", `/api/v1/admin/stats?website=${E}`], ["GET", `/api/v1/admin/activity?website=${E}`],
];
for (const who of [null, "zeditor@test.com", "zadmin@test.com"]) {
  const cookie = who ? await login(who) : ""; let bad = [];
  for (const [m, path, body] of cases) {
    const r = await fetch(B + path, { method: m, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    let txt = await r.text(); let leak = false;
    if (r.status === 200 && m === "GET") { try { const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : j.items ?? j.recentPublished ?? j.rows ?? []; leak = JSON.stringify(j).includes(E) || JSON.stringify(j).includes("Elanster"); } catch { } }
    const ok = r.status === 401 || r.status === 403 || r.status === 404 || (r.status === 200 && m === "GET" && !leak && !path.includes(ids.blog) && !path.includes(ids.page));
    if (!ok) bad.push(`${m} ${path} -> ${r.status} ${txt.slice(0, 80)}`);
  }
  console.log((who || "anonymous").padEnd(18), bad.length ? "PROBLEMS:\n  " + bad.join("\n  ") : `all ${cases.length} blocked`);
}
