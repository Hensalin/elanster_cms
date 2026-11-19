# Penetration test report (safe, authorised, local)

Environment: local test copy of the CMS (production build on port 3001, development build on 3101) and a copy of the We Are Zion website. No production system was attacked. The only production checks were HTTP HEAD requests for public files of the website.

| # | Test | Method | Result |
|---|---|---|---|
| 1 | Forged token | Cookie with a fake signature | Refused (401) |
| 2 | `alg=none` token | Unsigned JWT | Refused (401) |
| 3 | Account discovery | Unknown email vs wrong password; duplicate sign-up | Same answers |
| 4 | Brute force | 10 wrong passwords | Locked (429) |
| 5 | Horizontal access (IDOR/BOLA) | 34 actions on another website's article, page, media, category, versions, keys, website, people — as 3 identities | 102/102 blocked |
| 6 | Vertical access | Editor: publish, unpublish, schedule, approve, delete live, sync, keys, website settings, people, self-promotion | 15/15 blocked |
| 7 | CSRF | text/plain and form-encoded bodies; `Sec-Fetch-Site: cross-site` | 415 / 415 / 403 |
| 8 | Stored XSS | `<script>`, `onerror`, `javascript:`, `<iframe>` in an article | All removed |
| 9 | Malicious upload | SVG with script; HTML renamed to `.png` | Refused (400) |
| 10 | SQL injection | `' OR 1=1--` in a public slug | 404, no error |
| 11 | Session revocation | Old cookie after password reset / change | Refused (401) after fix — **was accepted before (SEC-01)** |
| 12 | Cross-website key | We Are Zion key on Elanster | 403 |
| 13 | Drafts leakage | Public API list | Only published items |
| 14 | Exposed files (live website) | HEAD `/server/server.js`, `/server/.env.example`, zip, tools | **200 — exposed (SEC-12)**, fix ready |
| 15 | Security headers | CMS backend, CMS frontend (production), live website | CMS complete after fix; website missing (SEC-13), fix ready |

Not executed: automated active scanning (OWASP ZAP), infrastructure tests, social engineering, denial-of-service.
