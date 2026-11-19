import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3204/blogs/water-all-around.html?article=raya-and-the-last-dragon"); await p.waitForTimeout(4000);
const r = await p.evaluate(() => ({ canonical: document.querySelector('link[rel=canonical]')?.href, blogPostingLd: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /BlogPosting/.test(s.textContent)), h1: document.querySelector("h1").textContent.trim() }));
console.log((r.canonical.includes("?article=raya") && !r.blogPostingLd ? "PASS" : "FAIL") + "  New article page has its own address as canonical and no wrong article data", JSON.stringify(r), errs);
await b.close();
