import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(e.message));
for (const u of ["blog.html", "blogs/ad-went.html", "index.html"]) {
  await p.goto("http://localhost:3204/" + u); await p.waitForTimeout(4000);
  console.log(u, await p.evaluate(() => ({ big: [...document.querySelectorAll(".zcard--big")].map(a => a.getAttribute("href") + " | " + a.querySelector("h3").textContent + " | " + a.querySelector("img").getAttribute("src").slice(0, 50)),
    list: [...document.querySelectorAll(".zcards > a")].slice(0, 4).map(a => a.getAttribute("href") + " | " + a.querySelector("h3").textContent + " | " + (a.querySelector("img")?.getAttribute("src") || "").slice(0, 45) + " | " + getComputedStyle(a).opacity), n: document.querySelectorAll(".zcards > a").length })));
}
console.log("errors", errs); await b.close();
