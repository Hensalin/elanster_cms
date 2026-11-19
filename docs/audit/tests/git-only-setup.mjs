// Prepares: both websites published to the fake GitHub, exported to /tmp/elgit (3206) and /tmp/zgit (3207); a Zion home edit published.
import { execSync } from "node:child_process"; import fs from "node:fs";
const B = "http://localhost:3101", G = "http://localhost:3300";
const sites = [["cb1a37d1a0d725cb2ce016d0", "Hensalin/elanster_website-demo", "/tmp/el", "/tmp/elgit"], ["afa41ce27c4d2f7ac45ca801", "Hensalin/wearezions", "/tmp/zt", "/tmp/zgit"]];
const r0 = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@elanster.com", password: "TestPass-123!" }) });
const S = (r0.headers.get("set-cookie") || "").split(";")[0];
const call = async (m, p, b) => (await fetch(B + p, { method: m, headers: { cookie: S, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined })).json();
const Z = sites[1][0];
const pages = await call("GET", `/api/v1/admin/pages?website=${Z}`); const home = (pages.items ?? pages).find((p) => p.slug === "home");
let pg = await call("GET", `/api/v1/admin/pages/${home.id}`); const f = pg.fields.find((x) => x.tag === "h2");
await call("PUT", `/api/v1/admin/pages/${home.id}`, { draft: { ...pg.draft, [f.key]: "Zion published words" }, expectedUpdatedAt: pg.updatedAt });
await call("POST", `/api/v1/admin/pages/${home.id}/publish`, { action: "publish" });
for (const [id, repo, src, out] of sites) {
  await fetch(G + "/__seed", { method: "POST", body: JSON.stringify({ repo, dir: src }) });
  await call("PUT", `/api/v1/admin/websites/${id}`, { gitRepo: repo });
  const r = await call("POST", `/api/v1/admin/websites/${id}/git`, { action: "publish" }); console.log(repo, r.status, r.files);
  execSync(`mkdir -p ${out} && find ${out} -mindepth 1 -delete`);
  for (const p of await (await fetch(`${G}/__list?repo=${repo}`)).json()) { if (/\.zip$/.test(p)) continue;
    const b = Buffer.from(await (await fetch(`${G}/__file?repo=${repo}&path=${encodeURIComponent(p)}`)).arrayBuffer());
    fs.mkdirSync(out + "/" + p.split("/").slice(0, -1).join("/"), { recursive: true }); fs.writeFileSync(out + "/" + p, b); }
}
execSync(`sed -i 's#url: *"[^"]*"#url: "http://localhost:3101"#' /tmp/elgit/js/cms-config.js`);
fs.writeFileSync("/home/claude/gt/gitonly.json", JSON.stringify({ key: f.key, original: f.text }));
