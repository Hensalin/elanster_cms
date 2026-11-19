import { chromium } from "playwright";
const B = "http://localhost:3100"; const br = await chromium.launch(); const res = []; const t = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
for (const [email, role] of [["admin@elanster.com", "Super Admin"], ["zadmin@test.com", "Website Admin"], ["zeditor@test.com", "Editor"]]) {
  const ctx = await br.newContext({ viewport: { width: 1600, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 500) errs.push(r.status() + " " + r.url().replace(B, "")); });
  await p.goto(B + "/login"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL(B + "/"); await p.waitForTimeout(2000);
  t(`${role}: dashboard shows role chip`, (await p.locator(".role-chip").textContent()).trim() === role);
  // side band links
  const links = await p.locator("nav a[href^='/'], .rail a[href^='/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  for (const h of links) { await p.goto(B + h); await p.waitForTimeout(1500); const bad = await p.locator("text=Server error").count(); if (bad) errs.push("Server error on " + h); }
  t(`${role}: every menu link opens (${links.join(" ")})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  if (role === "Editor") t("Editor has no Users / Websites admin links", !links.includes("/users"));
  // theme toggle
  await p.goto(B + "/"); await p.waitForTimeout(1500); await p.locator("button", { hasText: "Dark" }).first().click(); await p.waitForTimeout(400);
  const dark = await p.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className); await p.locator("button", { hasText: "Light" }).first().click();
  t(`${role}: theme switch works`, /dark/i.test(dark), dark);
  // command palette
  await p.keyboard.press("Control+k"); await p.waitForTimeout(500); t(`${role}: Ctrl+K search opens`, (await p.locator("[role=dialog] input, .cmdk input, .palette input").count()) > 0);
  await p.keyboard.press("Escape");
  // bell
  await p.click("button.bell"); await p.waitForTimeout(500); t(`${role}: notifications open`, (await p.locator(".note-t, .bell-empty, [role=menu], .notes").count()) > 0); await p.keyboard.press("Escape");
  // keyboard: Tab reaches the first button with a visible focus outline
  await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); const foc = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return e.tagName + " " + (s.outlineStyle !== "none" || s.boxShadow !== "none"); });
  t(`${role}: keyboard focus is visible`, /true/.test(foc), foc);
  // logout
  await p.locator(".avatar-btn").click(); await p.waitForTimeout(300); await p.locator("[role=menuitem]", { hasText: "Sign out" }).click();
  await p.waitForTimeout(1500); const after = await p.evaluate(async () => (await fetch("/api/v1/auth/me")).status);
  t(`${role}: sign out ends the session`, after === 401, String(after));
  await ctx.close();
}
console.log(res.join("\n")); console.log(`\n${res.filter((x) => x.startsWith("PASS")).length} passed, ${res.filter((x) => x.startsWith("FAIL")).length} failed`); await br.close();
