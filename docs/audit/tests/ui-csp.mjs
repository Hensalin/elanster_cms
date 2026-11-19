import { chromium } from "playwright";
const B = "http://localhost:3110"; const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1600, height: 950 } })).newPage(); const msgs = [];
p.on("console", (m) => { if (m.type() === "error" || /Content Security Policy|Refused/i.test(m.text())) msgs.push(m.text().slice(0, 160)); }); p.on("pageerror", (e) => msgs.push("PAGEERROR " + e.message));
await p.goto(B + "/login"); await p.fill("input[type=email]", "admin@elanster.com"); await p.fill("input[type=password]", "TestPass-123!"); await p.click("form button.btn"); await p.waitForURL(B + "/"); await p.waitForTimeout(2500);
for (const path of ["/content", "/websites", "/users", "/activity", "/account", "/pages/1ddcae6f0ebc2f729377166a", "/content?open=blogs:fa50908b3e6b883208c9afa0"]) { await p.goto(B + path); await p.waitForTimeout(3500); }
console.log("problems:", [...new Set(msgs)].filter((m) => !/static\.wixstatic|googleusercontent|ERR_|Failed to load resource/.test(m)).slice(0, 12)); await br.close();
