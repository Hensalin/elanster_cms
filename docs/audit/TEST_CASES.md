# Test cases and results

All scripts are in `tests/`; the combined output is in `evidence/regression.txt`. They run against a local test copy (ports 3100/3101 dev, 3001/3110 production build); test passwords and keys in them are test-only.

| Area | Script | Cases | Passed | Failed |
|---|---|---|---|---|
| Backend API (existing Postman collection) | `backend/postman/*.json` (newman) | 88 assertions / 51 requests | 88 | 0 |
| Security (auth, tokens, CSRF, uploads, XSS, injection, rate limit, headers, session revocation) | `tests/sec.mjs` | 27 | 27 | 0 |
| Access control: 34 admin actions on another website, as anonymous / editor / website admin | `tests/authz.mjs` | 102 | 102 | 0 |
| Access control: editor's forbidden actions on own website | `tests/editor-own.mjs` | 15 | 15 | 0 |
| User management (sign up, approve, switch off, temp password, delete) | `tests/users.mjs` | 15 | 15 | 0 |
| Concurrent editing | `tests/concurrency.mjs` | 6 | 6 | 0 |
| Page review workflow (editor → admin → changes → approve) | `tests/ui-flow.mjs` | 13 checkpoints | 13 | 0 |
| Suggested changes to a live article | `tests/ui-sug.mjs` | 7 checkpoints | 7 | 0 |
| Blog CMS end to end (draft → publish → public → edit → unpublish → delete) | `tests/ui-blog-e2e.mjs` | 19 | 19 | 0 |
| Screens, menus, theme, search, bell, keyboard focus, sign out — 3 roles | `tests/ui-nav.mjs` | 22 | 22 | 0 |
| Accessibility (axe-core WCAG 2.2 AA) — 6 CMS screens + 4 website pages | `tests/ui-axe.mjs` | 10 pages | 9 | 1 (website home, minor) |
| Content Security Policy on the production build — 7 screens | `tests/ui-csp.mjs` | 1 | 1 | 0 |
| Responsive: 6 CMS screens + 8 website pages × 9 widths | `tests/ui-resp.mjs` | 126 | 126 | 0 |
| Website texts found and replaced (16 pages) | `tests/ui-cov.mjs` | 516 texts | 514 | 2 (live countdowns, by design) |
| Website: new-article canonical, Elanster demo, blog list | `tests/ui-canon.mjs`, `ui-blog2.mjs` | 3 | 3 | 0 |
| Load: 3 endpoints × 10/50/100 users | `tests/load.mjs` | 9 scenarios | 9 (0 errors) | 0 |
| Database outage | manual script | 4 | 4 | 0 |

**Total: 983 checks · 980 passed · 3 known non-passes** (2 countdown texts the website rewrites itself every second, 1 minor website accessibility item). None of the non-passes are in the CMS.

Blocked / not run: OWASP ZAP active scan (tool not available in the test environment), real email, MFA (not built), backup restore (no Supabase access), load on real Vercel/Supabase (not allowed against production), Instagram reels server (`server/` folder, not deployed).

---

## Round 2 — 19 Nov 2026, evening

| Suite | What it covers | Result |
|---|---|---|
| Click test, Super Admin (`tests/click/crawl.py super`) | 14 screens; 484 buttons/links/tabs found, 282 distinct ones clicked; failing server answers, script errors, dangerous actions without a question, buttons that do nothing | Findings → R2-07, R2-08 |
| Click test, Website Admin, after fixes (`crawl2.py site-admin`) | 14 screens; 435 found, 255 clicked, plus buttons inside opened windows | Findings → R2-11; rest environment |
| Click test, Editor, after fixes (`crawl2.py editor`) | 14 screens; 427 found, 206 clicked; 279 controls inside windows | No failing answers left except R2-11 (fixed); window "timeouts" checked by hand: the buttons work (tester limitation) |
| `verify.py` | The fixed buttons, directly | 8/8 |
| `notifications.mjs` | Seen/unseen per person, new event = new, mark all, roles, bad input, signed out | 16/16 |
| `git-publish.mjs` | Pages, articles in `blog/`, pictures, sitemap, unpublish, outside edits, GitHub down, We Are Zion article files | 76/76 |
| `git-copies.mjs` | Sync never brings generated pages back; cleanup | 22/22 |
| `git-sync.mjs` | Edit → sync → edit again; two quick publishes | 7/7 |
| `git-scheduled.mjs` | Scheduled article reaches Git once its time passes, once | 4/4 |
| `git-only-browser.py` | Visitors fetch nothing from the CMS; editor preview still works | 12/12 (earlier today) |
| `git-blog-folder-browser.py` | Demo article pages in `blog/`, links, styles | passed (earlier today) |
| Phone layout + bell | 5 screens × 10 widths; bell window at 5 widths | 50/50, 5/5 |
| We Are Zion links (`zlinks.py`) | Every internal link, picture, script, style on 28 pages | 1,581 checked, 0 broken |
| We Are Zion buttons (`zclick.py`) | Every button on 28 pages, desktop + phone; script errors; sideways scrolling; phone menu; forms | 0 errors, 0 sideways scrolling; the one "no effect" button (Bible plans "All") is already selected |
| Regression | Postman 88/88 · security 27/27 · access 102 + 15 · users 15/15 · conflicts 6/6 · text editing 44/44 · navigation 22/22 · article end-to-end 19/19 · editor suggestions flow complete | All passed |
| Production builds | Backend and frontend | Both compile |
