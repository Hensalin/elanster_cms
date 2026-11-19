import { chromium } from "playwright";
const B = "http://localhost:3100"; const W = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const br = await chromium.launch(); const ctx = await br.newContext(); const p = await ctx.newPage();
await p.goto(B + "/login"); await p.fill("input[type=email]", "zadmin@test.com"); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL(B + "/");
const screens = { dashboard: "/", content: "/content", "page editor": "/pages/1ddcae6f0ebc2f729377166a", "article editor": "/content?open=blogs:fa50908b3e6b883208c9afa0", account: "/account", activity: "/activity" };
const rows = [];
for (const [name, path] of Object.entries(screens)) { const line = [name.padEnd(15)];
  for (const w of W) { await p.setViewportSize({ width: w, height: 860 }); await p.goto(B + path); await p.waitForTimeout(1800);
    const o = await p.evaluate(() => { const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
      const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > iw + 2 && r.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 2).map((e) => e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0]);
      return { over: sw - iw, wide }; });
    line.push(o.over > 2 ? `${w}:+${o.over}px(${o.wide.join(",")})` : `${w}:ok`);
    if ([375, 768].includes(w)) await p.screenshot({ path: `/home/claude/audit/resp/cms-${name.replace(" ", "-")}-${w}.png` }); }
  rows.push(line.join("  ")); }
console.log(rows.join("\n"));
// Public website pages
const sp = await (await br.newContext()).newPage(); const pages = ["index.html", "about.html", "blog.html", "blogs/ad-went.html", "contact.html", "give.html", "events.html", "church-life.html"]; const rr = [];
for (const pg of pages) { const line = [pg.padEnd(20)];
  for (const w of W) { await sp.setViewportSize({ width: w, height: 860 }); await sp.goto("http://localhost:3204/" + pg); await sp.waitForTimeout(1200);
    const over = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); line.push(over > 2 ? `${w}:+${over}` : `${w}:ok`); }
  rr.push(line.join(" ")); }
console.log("\nWEBSITE\n" + rr.join("\n")); await br.close();
