# Performance and load test report

## Load (local production build, one process, `tests/load.mjs`)
```
Public: page texts (what every visitor loads)   10 users    50 req   222 req/s  median    36 ms  p95    82 ms  errors 0
Public: page texts (what every visitor loads)   50 users   250 req   275 req/s  median   161 ms  p95   359 ms  errors 0
Public: page texts (what every visitor loads)  100 users   300 req   349 req/s  median   270 ms  p95   450 ms  errors 0
Public: article list                            10 users    50 req   237 req/s  median    36 ms  p95    68 ms  errors 0
Public: article list                            50 users   250 req   236 req/s  median   205 ms  p95   250 ms  errors 0
Public: article list                           100 users   300 req   261 req/s  median   360 ms  p95   454 ms  errors 0
Admin: dashboard numbers                        10 users    50 req   124 req/s  median    78 ms  p95    99 ms  errors 0
Admin: dashboard numbers                        50 users   250 req   134 req/s  median   366 ms  p95   400 ms  errors 0
Admin: dashboard numbers                       100 users   300 req   132 req/s  median   744 ms  p95   880 ms  errors 0
```

0 errors at 10, 50 and 100 simultaneous users. On Vercel each function scales out, so real throughput is higher; these numbers are a floor for one instance. A real-environment load test was **not** run (not allowed against production).

## Page speed (`tests/ui-perf.mjs`, local)
```
CMS login (production build)   {"ttfb":26,"load":126,"lcp":92,"cls":"0.000","js":144,"requests":12}
CMS dashboard (production)     {"ttfb":9,"load":39,"lcp":92,"cls":"0.000","js":311,"requests":33}
Website home (test copy)       {"ttfb":3,"load":996,"lcp":588,"cls":"0.001","js":100,"requests":45}
Website blog (test copy)       {"ttfb":3,"load":762,"lcp":420,"cls":"0.000","js":100,"requests":45}
```

- CMS login: largest content in ~0.1 s, layout shift 0.
- CMS dashboard: ~311 KB of JavaScript (editor libraries load only when needed), layout shift 0.
- Website (test copy, outside pictures blocked): largest content 0.4–0.6 s, layout shift ≤ 0.001.

Core Web Vitals on the real site (with real pictures and network) were not measured; check them in Vercel Speed Insights or PageSpeed Insights.
