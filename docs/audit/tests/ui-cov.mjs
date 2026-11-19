import { chromium } from "playwright"; import fs from "fs";
const rows = Object.fromEntries(fs.readFileSync("/tmp/zkeys.txt","utf8").trim().split("\n").map(l => { const i = l.indexOf("|"); return [l.slice(0,i), JSON.parse(l.slice(i+1) || "[]")]; }));
const files = { home: "index.html" }; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = [];
p.on("pageerror", e => errs.push(e.message));
let tot = 0, ok = 0;
for (const slug of Object.keys(rows).filter(s => s !== "_global").sort()) {
  await p.goto(`http://localhost:3204/${files[slug] || slug + ".html"}`); await p.waitForTimeout(4000);
  const want = [...rows[slug], ...rows._global];
  const res = await p.evaluate((want) => { const got = new Set([...document.querySelectorAll("[data-cms]")].filter(e => /✓$/.test(e.textContent.trim())).map(e => e.getAttribute("data-cms"))); const half = [...document.querySelectorAll("[data-cms]")].filter(e => !/✓$/.test(e.textContent.trim())).map(e => e.getAttribute("data-cms") + ":" + e.textContent.trim().slice(0,40)); return { got: want.filter(k => got.has(k)), half }; }, want);
  const pageKeys = rows[slug]; const gotPage = pageKeys.filter(k => res.got.includes(k));
  tot += pageKeys.length; ok += gotPage.length;
  console.log(slug.padEnd(22), `page texts ${gotPage.length}/${pageKeys.length}`, `shared ${res.got.length - gotPage.length}/${rows._global.length}`, res.half.length ? "HALF:" + res.half.slice(0,3).join(" ; ") : "");
  if (gotPage.length < pageKeys.length) console.log("   missing:", pageKeys.filter(k => !res.got.includes(k)).slice(0,6).join(", "));
}
console.log("TOTAL page texts shown", ok, "/", tot, "errors:", errs.slice(0,5)); await b.close();
