// Run from backend/:  npx tsx ../docs/audit/tests/tagged-in-heading.ts
// Tagged parts inside a heading (the Elanster hero: <h1><span><span data-cms="…">) must get their edits on publish.
import { applyEdits } from "../../../backend/src/lib/htmledit";
let pass = 0, fail = 0; const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const html = `<html><body><h1 class="hero"><span class="l"><span data-cms="home.top.1">Engineered to last.</span></span> <span class="l"><span data-cms="home.top.2">Designed to lead.</span></span></h1>
<h3><span data-cms="home.c.4" data-cms-wrap>Strategy call</span> <small data-cms="home.c.5">Start</small></h3><h2 data-cms="home.c.2">Plain heading</h2><p>Untagged paragraph text here.</p></body></html>`;
const r = applyEdits(html, "home", { "home.top.1": "Built to last.", "home.c.4": "Discovery call", "home.c.2": "New heading" }, (u) => u);
ok(r.html.includes(">Built to last.<"), "tagged span inside h1 is written");
ok(r.html.includes(">Designed to lead.<"), "the other part of the h1 is kept");
ok(r.html.includes(">Discovery call<") && r.html.includes(">Start<"), "tagged span inside h3 is written, its neighbour kept");
ok(r.html.includes(">New heading<"), "a tagged heading itself still works");
ok(r.html.includes("Untagged paragraph text here."), "untagged text untouched");
ok(r.changed === 3, "exactly three edits counted: " + r.changed);
console.log(`tagged-in-heading: ${pass} passed, ${fail} failed`);
