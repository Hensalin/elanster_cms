# QA audit report — Elanster CMS and the We Are Zion website

Date: 19 November 2026 · Auditor: Claude (AI), on a private test copy · Nothing was pushed or deployed.

## 1. What was audited
| Part | What it is | Where |
|---|---|---|
| CMS frontend | Admin / editor screens (Next.js 16, React 19) | `frontend/` |
| CMS backend | 42 API routes, sign-in, roles, public website API (Next.js 16, Drizzle ORM) | `backend/` |
| Database | Postgres (Supabase in production; a local Postgres 16 copy for tests) | `backend/src/db/schema.ts` |
| Website connector | `cms.js` + `cms-content.js` loaded by the websites | `backend/public/` |
| We Are Zion website | 16 pages + 12 article pages, static HTML on Vercel | github.com/Hensalin/wearezions |

How it was tested: production builds and development servers of the CMS against a copy of the database, copies of both websites, a robot browser (Playwright) signing in as Super Admin, Website Admin and Editor, API test scripts, the existing Postman collection, axe-core for accessibility, `npm audit`, a git secret scan, and read-only checks of the live We Are Zion site.

## 2. Inventory
- **Screens (CMS):** login, sign up, dashboard, content (blog + pages), article editor, page editor with live preview, websites (keys, connection check), users, activity log, categories, media, my account — 14 routes.
- **API:** 33 admin routes (sign-in required), 5 public website routes (API key), 4 auth/health routes.
- **Roles:** Super Admin, Website Admin (per website), Editor (per website).
- **Workflows:** sign up → approval; draft → send for review → request changes / approve & publish (articles, pages, suggested changes to live articles); website add → sync → key → connection check; media upload/import; version history; activity log.
- **Database entities:** users, websites, website_users, blogs, blog_categories, tags, blog_tags, pages, page_sections, media, api_keys, content_versions, activity_logs, publishing_history, rate_limits.

## 3. Results in short
- **Security:** 27/27 security tests pass after fixes; 102/102 cross-website access attempts blocked; 15/15 editor-only restrictions enforced on the server. 11 security issues fixed (see `SECURITY_AUDIT.md`), 2 website fixes ready for upload, 5 security items still open that need a decision or your accounts.
- **Functionality:** blog end-to-end 19/19, page review workflow and suggested-changes workflow complete, user management 15/15, every menu and common control for 3 roles 22/22, Postman 88/88 assertions.
- **Stability:** database outage handled cleanly (website keeps its text, health reports 503); concurrent edits no longer overwrite each other.
- **Scale:** 100 simultaneous users on one local server: 0 errors, public API p95 ≈ 450 ms.
- **Mobile:** all CMS screens and website pages checked at 9 widths (320–1920 px); the CMS mobile layout was broken and is fixed.
- **Accessibility:** CMS 0 axe violations on 6 key screens (was 100+ nodes); website 1 minor issue left.
- **Build:** both production builds pass; TypeScript passes.

Full numbers: `FINAL_COMPLETION_REPORT.md`. All issues: `BUG_TRACKER.md`.

---

## Round 2 — 19 Nov 2026, evening

**Scope:** every button, link and tab on all 14 CMS screens for the three roles; the notification bell; the Git publishing workflow added today (sync, publish, scheduled, cleanup, blog folder, content only from Git); the We Are Zion website (28 pages, desktop and phone).

**Method:** an automatic click tester (Playwright) signed in as Super Admin, Website Admin and Editor, opened each screen and clicked each distinct control, recording what happened. Requests from Delete/Remove/Unpublish/Turn off and similar were blocked so no test data was lost. Findings were then checked by hand; anything the tester could not see (new tabs, file pickers, the browser's own form messages) was checked separately.

**Result:** 14 verified bugs (1 critical, 4 high, 6 medium, 3 low), all fixed and retested — see `BUG_TRACKER.md` R2-01 … R2-14. No failing server answers remain that come from the CMS itself. The We Are Zion website had no broken links, no script errors and no sideways scrolling.

**Limits:** the click tester cannot judge whether a result is *correct* (only that something happened without errors); workflows are covered by the dedicated tests listed in `TEST_CASES.md`. The Super Admin click test ran before the fixes; the fixes it touches were verified with `verify.py`. Tests ran on a local copy with a fake GitHub, not on the live CMS, live database or real GitHub.
