import { chromium } from "playwright";
const B = "http://localhost:3100", API = "http://localhost:3101", KEY = "ek_live_testonekey0000000000000000000000aa"; const res = []; const t = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1600, height: 950 } })).newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(e.message)); p.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 500) errs.push(r.status() + " " + r.url()); });
await p.goto(B + "/login"); await p.fill("input[type=email]", "zadmin@test.com"); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL(B + "/");
const title = "E2E test article " + Date.now();
await p.goto(B + "/content?new=1"); await p.waitForTimeout(2500);
await p.locator(".qe-title").fill(title);
await p.locator("#an").fill("Guest Writer");
await p.locator(".ProseMirror").click(); await p.keyboard.type("First paragraph of the test article."); await p.keyboard.press("Enter"); await p.keyboard.type("Second paragraph with more words.");
await p.locator("#x").fill("A short summary for the card.");
await p.locator("#tg").fill("testing, e2e"); await p.keyboard.press("Enter");
await p.locator("#st").fill("E2E Google title"); await p.locator("#md").fill("E2E Google description");
await p.keyboard.press("Control+s"); await p.waitForTimeout(2500);
const status1 = await p.locator(".qe-bar-l .badge").textContent(); t("Draft saved with Ctrl+S", /Draft/i.test(status1), status1);
let pub = await fetch(`${API}/api/v1/websites/we-are-zion/blogs?limit=50`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
t("Draft is NOT visible on the public API", !pub.items.some((x) => x.title === title));
await p.reload(); await p.waitForTimeout(2500); t("No data loss after refresh (list shows it)", (await p.locator("button.row-title", { hasText: title }).count()) === 1);
await p.locator("button.row-title", { hasText: title }).click(); await p.waitForTimeout(2500);
t("Fields kept after refresh", (await p.locator("#an").inputValue()) === "Guest Writer" && (await p.locator("#x").inputValue()) === "A short summary for the card." && (await p.locator("#st").inputValue()) === "E2E Google title");
await p.locator(".qe-bar-r button", { hasText: "Publish" }).click(); await p.waitForTimeout(2500);
pub = await fetch(`${API}/api/v1/websites/we-are-zion/blogs?limit=50`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
const item = pub.items.find((x) => x.title === title); t("Published article appears on the public API", !!item);
if (item) {
  t("Correct slug", item.slug.startsWith("e2e-test-article"), item.slug); t("Correct author", item.author === "Guest Writer", item.author);
  t("Has publication date", !!item.publishedAt); t("Tags saved", item.tags.map((x) => x.name).sort().join(",") === "e2e,testing", item.tags.map((x) => x.name).join(","));
  t("SEO title and description", item.seo.title === "E2E Google title" && item.seo.description === "E2E Google description");
  t("Summary for the card", item.excerpt === "A short summary for the card.");
  const full = await fetch(`${API}/api/v1/websites/we-are-zion/blogs/${item.slug}`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
  t("Article text published as clean HTML", /<p>First paragraph of the test article.<\/p>/.test(full.content), full.content.slice(0, 70));
  t("Only one copy (no duplicates)", pub.items.filter((x) => x.title === title).length === 1);
  // Edit -> update
  await p.locator(".qe-title").fill(title + " (updated)"); await p.waitForTimeout(300);
  await p.locator(".qe-bar-r button", { hasText: "Update live article" }).click(); await p.waitForTimeout(2500);
  const upd = await fetch(`${API}/api/v1/websites/we-are-zion/blogs/${item.slug}`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
  t("Update reaches the public API, same address", upd.title === title + " (updated)", upd.title);
  // Live website shows it
  const lp = await br.newPage(); await lp.goto("http://localhost:3204/blog.html"); await lp.waitForTimeout(4000);
  t("New article is the Latest card on the website", (await lp.locator(".zcard--big h3").textContent()).includes("(updated)"));
  await lp.locator(".zcard--big").click(); await lp.waitForTimeout(4000);
  t("Article opens with its own text on the website", (await lp.locator("article").textContent()).includes("Second paragraph with more words.") && (await lp.locator("h1").first().textContent()).includes("(updated)"));
  await lp.close();
  // Unpublish -> gone; then delete
  p.once("dialog", (d) => d.accept()); await p.locator(".qe-bar-r button", { hasText: "Unpublish" }).click(); await p.waitForTimeout(2000);
  const gone = await fetch(`${API}/api/v1/websites/we-are-zion/blogs/${item.slug}`, { headers: { "x-api-key": KEY } }); t("Unpublished article is gone from the public API", gone.status === 404, String(gone.status));
  const id = await p.evaluate(async (s) => (await (await fetch("/api/v1/admin/blogs?limit=50&q=" + encodeURIComponent(s))).json()).items[0]?.id, title);
  if (id) { const d = await p.evaluate(async (i) => (await fetch("/api/v1/admin/blogs/" + i, { method: "DELETE" })).status, id); t("Delete works", d === 200); }
}
t("No browser or server errors", errs.length === 0, errs.slice(0, 2).join(" | "));
console.log(res.join("\n")); console.log(`\n${res.filter((x) => x.startsWith("PASS")).length} passed, ${res.filter((x) => x.startsWith("FAIL")).length} failed`); await br.close();
