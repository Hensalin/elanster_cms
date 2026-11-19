// An Editor on their OWN website must not be able to publish, unpublish, delete live content, approve, or manage the website.
const B = "http://localhost:3101"; const Z = "afa41ce27c4d2f7ac45ca801", BLOG = "fa50908b3e6b883208c9afa0", PAGE = "1ddcae6f0ebc2f729377166a";
const r0 = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "zeditor@test.com", password: "TestPass-123!" }) });
const cookie = (r0.headers.get("set-cookie") || "").split(";")[0];
const cases = [
  ["POST", `/api/v1/admin/blogs/${BLOG}/publish`, { action: "unpublish" }], ["POST", `/api/v1/admin/blogs/${BLOG}/publish`, { action: "publish" }],
  ["POST", `/api/v1/admin/blogs/${BLOG}/publish`, { action: "schedule", scheduledAt: "2030-01-01T00:00:00.000Z" }],
  ["POST", `/api/v1/admin/blogs/${BLOG}/publish`, { action: "approve_changes" }], ["POST", `/api/v1/admin/blogs/${BLOG}/publish`, { action: "reject_changes", note: "x" }],
  ["DELETE", `/api/v1/admin/blogs/${BLOG}`],
  ["POST", `/api/v1/admin/pages/${PAGE}/publish`, { action: "publish" }], ["POST", `/api/v1/admin/pages/${PAGE}/publish`, { action: "unpublish" }],
  ["POST", `/api/v1/admin/pages/${PAGE}/publish`, { action: "request_changes", note: "x" }],
  ["POST", `/api/v1/admin/websites/${Z}/sync-pages`], ["POST", `/api/v1/admin/websites/${Z}/api-keys`, { label: "x" }], ["PUT", `/api/v1/admin/websites/${Z}`, { active: false }],
  ["GET", `/api/v1/admin/people`], ["PATCH", `/api/v1/admin/people/zeditoruser1`, { role: "SUPER_ADMIN" }], ["PATCH", `/api/v1/admin/people/zeditoruser1`, { sites: [{ websiteId: "cb1a37d1a0d725cb2ce016d0", role: "WEBSITE_ADMIN" }] }],
];
const bad = [];
for (const [m, path, body] of cases) { const r = await fetch(B + path, { method: m, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!(r.status === 403 || r.status === 409 || r.status === 401)) bad.push(`${m} ${path} ${body ? JSON.stringify(body).slice(0, 40) : ""} -> ${r.status} ${t.slice(0, 80)}`); }
console.log(bad.length ? "PROBLEMS:\n  " + bad.join("\n  ") : `editor blocked on all ${cases.length} admin actions on own website`);
