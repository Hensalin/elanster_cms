import { chromium } from "playwright"; import fs from "fs";
const axe = fs.readFileSync("/opt/node-tools/node_modules/axe-core/axe.min.js", "utf8");
const B = "http://localhost:3100"; const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const run = async (label) => { await p.addScriptTag({ content: axe }); const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes[0]?.target?.join(" ").slice(0, 60) })));
  console.log(label.padEnd(26), r.length ? r.map((v) => `${v.impact}:${v.id}(${v.n}) e.g. ${v.t}`).join("\n" + " ".repeat(27)) : "no violations"); return r; };
const all = {};
await p.goto(B + "/login"); await p.waitForTimeout(1200); all.login = await run("CMS login");
await p.fill("input[type=email]", "zadmin@test.com"); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL(B + "/"); await p.waitForTimeout(3500);
all.dash = await run("CMS dashboard");
for (const [l, path] of [["CMS content", "/content"], ["CMS page editor", "/pages/1ddcae6f0ebc2f729377166a"], ["CMS article editor", "/content?open=blogs:fa50908b3e6b883208c9afa0"], ["CMS account", "/account"]]) { await p.goto(B + path); await p.waitForTimeout(3000); all[l] = await run(l); }
for (const pg of ["index.html", "blog.html", "blogs/ad-went.html", "contact.html"]) { await p.goto("http://localhost:3204/" + pg); await p.waitForTimeout(2500); all[pg] = await run("Website " + pg); }
fs.writeFileSync("/home/claude/audit/axe.json", JSON.stringify(all, null, 1)); await br.close();
