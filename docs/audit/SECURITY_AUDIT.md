# Security audit

Method: code review of all 42 API routes and the auth library, automated tests (`tests/sec.mjs`, `authz.mjs`, `editor-own.mjs`, `users.mjs`), `npm audit`, a secret scan of the full git history of both repositories, header checks of the live website. Guidance: OWASP Top 10 (2021), OWASP API Security Top 10, ASVS level 1–2 items. No destructive tests; nothing was run against production except read-only checks of public website files.

## Findings by area
| Area | Result |
|---|---|
| Passwords | bcrypt (cost 12). Minimum 10 characters. Same answer for unknown email and wrong password; same answer for duplicate sign-ups (no account discovery). ✔ |
| Sign-in token | Signed JWT (HS256) in an HttpOnly, SameSite=Lax, Secure cookie, 8 h. Forged and `alg=none` tokens refused. **Fixed:** tokens are now invalidated by a password change or reset (SEC-01). |
| Brute force | 8 wrong tries lock an email for 15 min, 30 tries per address per 15 min, sign-ups 5 per hour. **Fixed:** account-page password checks limited (SEC-08), failed sign-ins logged (SEC-07), trusted client address (SEC-09). |
| Access control | Every admin route signs in the user, re-reads them from the database (switched-off users are out at once), and checks the role for the item's website. 102/102 cross-website attempts and 15/15 editor-only restrictions blocked. Super-Admin-only routes enforced. ✔ |
| Injection | All queries are parameterised (Drizzle ORM / tagged SQL). Injection-like input returns 404. ✔ |
| XSS | Article HTML cleaned with sanitize-html (no script, event handlers, javascript: links, iframes). Page texts are inserted as plain text on websites. **Fixed:** CSP for the CMS (SEC-06); media served sandboxed (SEC-04). |
| CSRF | SameSite cookies plus **new** JSON-only and cross-site refusal on admin changes (SEC-05). |
| SSRF | **Fixed** (SEC-03): all server downloads of user-given addresses pass `lib/netguard.ts`. Residual: DNS rebinding window (OPEN-07). |
| File uploads | **Fixed** (SEC-02): real type from file bytes, raster images only, 3.5 MB cap, names cleaned, never executed, served with `nosniff` and sandbox CSP. |
| API keys | Read-only, one website each, stored as SHA-256 hashes, revocable; a key cannot read another website (403). Visible in the website code by design. |
| CORS | Public website API: `*` for GET only (read-only, key required). Admin API: same-origin through the frontend. ✔ |
| Headers | HSTS, nosniff, Referrer-Policy, frame protection, Permissions-Policy, CSP (frontend production). `X-Powered-By` removed. |
| Secrets | No secrets in either git history (scan of all commits). `.env.local` ignored. Example file now uses placeholders (SEC-11). The We Are Zion repo contains the website's read-only key by design. **Action for you:** rotate the database password and Vercel token that were pasted in earlier chats (OPEN-04). |
| Dependencies | `npm audit` (production): 0 vulnerabilities in both apps. Dev-only: 4 moderate (drizzle-kit/esbuild). |
| Logging | Sign-ins, failed sign-ins, every content, user, website and key change are in the activity log with person and time; passwords and tokens are never logged. |
| We Are Zion website | Internal files publicly downloadable (SEC-12, MEDIUM) and missing headers (SEC-13) — fixes in `we-are-zion-security-fixes.zip`. |

## Not done (be aware)
- No automated scanner (OWASP ZAP) was run; findings come from code review and targeted tests.
- No MFA (OPEN-01). Recommended before adding more admins.
- Penetration testing of Vercel/Supabase infrastructure was out of scope.
