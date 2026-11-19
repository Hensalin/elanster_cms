import { chromium } from "playwright";
const B = "http://localhost:3100", PAGE = "1ddcae6f0ebc2f729377166a", ELAN = "ee6625d643d7a4e89f89cac8"; const br = await chromium.launch(); const log = (...a) => console.log(...a);
async function login(email) {
  const ctx = await br.newContext({ viewport: { width: 1600, height: 950 } }); const p = await ctx.newPage(); p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message)); p.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 500) p.errs.push(r.status() + " " + r.url()); });
  await p.goto(B + "/login"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn");
  await p.waitForURL(B + "/", { timeout: 20000 }); await p.waitForTimeout(1500); return { ctx, p };
}
const btns = async (p) => (await p.locator(".head-actions button, .head-actions a").allTextContents()).map((t) => t.trim()).join(" | ");
const field = (p, text) => p.locator(".pe textarea").filter({ hasText: text }).first();
// 1. Editor edits, saves, sends for review
let { ctx, p } = await login("zeditor@test.com");
await p.goto(B + "/pages/" + PAGE); await p.waitForSelector(".pe textarea"); await p.waitForTimeout(1500);
log("EDITOR buttons:", await btns(p));
await p.locator(".pe textarea").nth(0).fill("We Are Zion Church | Edit " + Date.now());
const h = p.locator("textarea", { hasText: "Real people. Real message. Real Saviour." }); await h.first().scrollIntoViewIfNeeded().catch(()=>{});
log("EDITOR after typing:", await btns(p), "| header:", await p.locator(".head p").textContent());
await p.click("text=Save draft"); await p.waitForTimeout(1500);
await p.click("text=Send for review"); await p.waitForTimeout(2000);
log("EDITOR after send:", await btns(p), "| badge:", await p.locator(".head h1 .badge").textContent(), "| readonly:", await p.locator(".pe textarea").first().getAttribute("readonly"));
await p.screenshot({ path: "/home/claude/qa/editor-waiting.png" });
const api = await p.evaluate(async (id) => (await fetch("/api/v1/admin/pages/" + id + "/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish" }) })).status, PAGE);
const save = await p.evaluate(async (id) => (await fetch("/api/v1/admin/pages/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: {} }) })).status, PAGE);
const other = await p.evaluate(async (id) => (await fetch("/api/v1/admin/pages/" + id)).status, ELAN);
log("EDITOR direct publish API:", api, "| save while waiting:", save, "| open Elanster page:", other);
await p.goto(B + "/"); await p.waitForTimeout(2500); await p.screenshot({ path: "/home/claude/qa/editor-dash.png" });
log("EDITOR dash sent-for-review:", (await p.locator(".card", { hasText: "Sent for review" }).locator(".row b").allTextContents()).join(" ; "), "| errors:", p.errs);
await ctx.close();
// 2. Website admin requests changes
({ ctx, p } = await login("zadmin@test.com"));
await p.waitForTimeout(1500); log("ADMIN bell:", await p.locator(".bell-n").textContent().catch(() => "0"));
await p.click("button.bell"); await p.waitForTimeout(800); log("ADMIN notes:", (await p.locator(".note-t b").allTextContents()).join(" || "));
await p.screenshot({ path: "/home/claude/qa/admin-dash.png" });
log("ADMIN needs review card:", (await p.locator(".card", { hasText: "Needs your review" }).locator(".row b").allTextContents()).join(" ; "));
await p.goto(B + "/pages/" + PAGE); await p.waitForSelector(".pe textarea"); await p.waitForTimeout(1500);
log("ADMIN buttons:", await btns(p), "| banner:", (await p.locator(".note-banner").first().textContent()).slice(0, 90));
await p.click("text=Request changes"); await p.fill(".modal textarea", "Please keep the church name first."); await p.click("text=Send back"); await p.waitForTimeout(1500);
const other2 = await p.evaluate(async (id) => (await fetch("/api/v1/admin/pages/" + id)).status, ELAN);
log("ADMIN after request:", await btns(p), "| open Elanster page:", other2, "| errors:", p.errs);
await ctx.close();
// 3. Editor sees note, edits again, resends
({ ctx, p } = await login("zeditor@test.com"));
log("EDITOR banners:", (await p.locator(".note-banner").allTextContents()).join(" || ").slice(0, 160));
await p.goto(B + "/pages/" + PAGE); await p.waitForSelector(".pe textarea"); await p.waitForTimeout(1500);
await p.locator(".pe textarea").nth(0).fill("We Are Zion Church | Chennai | " + Date.now()); await p.click("text=Send for review"); await p.waitForTimeout(2000);
log("EDITOR resend:", await p.locator(".head h1 .badge").textContent());
await ctx.close();
// 4. Admin approves & publishes
({ ctx, p } = await login("zadmin@test.com"));
await p.goto(B + "/pages/" + PAGE); await p.waitForSelector(".pe textarea"); await p.waitForTimeout(1500);
await p.screenshot({ path: "/home/claude/qa/admin-review.png" });
await p.click("text=Approve & publish"); await p.waitForTimeout(2500);
log("ADMIN after publish:", await p.locator(".head h1 .badge").textContent(), await btns(p));
await ctx.close();
// 5. Editor gets "live" note
({ ctx, p } = await login("zeditor@test.com"));
await p.click("button.bell"); await p.waitForTimeout(800); log("EDITOR notes:", (await p.locator(".note-t b").allTextContents()).join(" || "));
await ctx.close(); await br.close();
