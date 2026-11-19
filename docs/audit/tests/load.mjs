// Controlled load test on the local test copy (production build). Measures response times at 10, 50 and 100 users at once.
const B = "http://localhost:3001", KEY = "ek_live_testonekey0000000000000000000000aa";
const login = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@elanster.com", password: "TestPass-123!" }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const targets = {
  "Public: page texts (what every visitor loads)": [B + "/api/v1/websites/we-are-zion/pages/home", { "x-api-key": KEY }],
  "Public: article list": [B + "/api/v1/websites/we-are-zion/blogs?limit=20", { "x-api-key": KEY }],
  "Admin: dashboard numbers": [B + "/api/v1/admin/stats", { cookie }],
};
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
for (const [name, [url, headers]] of Object.entries(targets)) {
  for (const users of [10, 50, 100]) {
    const per = users === 100 ? 3 : 5; const times = []; let errors = 0; const t0 = performance.now();
    await Promise.all(Array.from({ length: users }, async () => { for (let i = 0; i < per; i++) { const s = performance.now();
      try { const r = await fetch(url, { headers }); await r.arrayBuffer(); if (!r.ok) errors++; } catch { errors++; } times.push(performance.now() - s); } }));
    const secs = (performance.now() - t0) / 1000; times.sort((a, b) => a - b);
    console.log(`${name.padEnd(46)} ${String(users).padStart(3)} users  ${String(times.length).padStart(4)} req  ${(times.length / secs).toFixed(0).padStart(4)} req/s  median ${pct(times, .5).toFixed(0).padStart(5)} ms  p95 ${pct(times, .95).toFixed(0).padStart(5)} ms  errors ${errors}`);
  }
}
