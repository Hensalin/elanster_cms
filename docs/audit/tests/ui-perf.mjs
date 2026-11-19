import { chromium } from "playwright";
const br = await chromium.launch();
async function measure(url, label, setup) {
  const ctx = await br.newContext({ viewport: { width: 1366, height: 800 } }); const p = await ctx.newPage(); if (setup) await setup(p);
  await p.addInitScript(() => { window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(3500);
  const m = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; const res = performance.getEntriesByType("resource");
    const js = res.filter((r) => /\.js/.test(r.name)).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);
    return { ttfb: Math.round(n.responseStart), load: Math.round(n.loadEventEnd), lcp: Math.round(window.__lcp), cls: window.__cls.toFixed(3), js: Math.round(js / 1024), requests: res.length }; });
  console.log(label.padEnd(30), JSON.stringify(m)); await ctx.close();
}
const login = async (p) => { await p.goto("http://localhost:3110/login"); await p.fill("input[type=email]", "zadmin@test.com"); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL("http://localhost:3110/"); };
await measure("http://localhost:3110/login", "CMS login (production build)");
await measure("http://localhost:3110/", "CMS dashboard (production)", login);
await measure("http://localhost:3204/index.html", "Website home (test copy)");
await measure("http://localhost:3204/blog.html", "Website blog (test copy)");
await br.close();
