# Stability and recovery report

## Failure tests (local)
| Failure | What happened | Result |
|---|---|---|
| Database stopped | Health check reports the problem with **503** (was 200); public API answers a clean **503** JSON (was a bare 500); sign-in explains the database is unreachable | Fixed and retested |
| Database stopped — live website | The website kept its own text, no JavaScript errors | Pass |
| Database restarted | Everything works again without restarting the CMS | Pass |
| Expired / revoked sign-in | 401, the screen returns to sign-in | Pass |
| Invalid requests | Validation errors return 422 with field messages; wrong content type 415 | Pass |
| Missing records | 404 | Pass |
| Two people editing | 409 with a clear message (was silent overwrite) | Fixed |
| Upload failure / too large / wrong type | Clear 400 messages | Pass |

## Recovery
- **Deploy rollback:** Vercel → Deployments → choose the previous one → "Promote to Production" (instant).
- **Database changes:** `SUPABASE-UPDATE.sql` only adds columns/indexes (safe to repeat, no deletions).
- **Content mistakes:** version history (last 20 versions per item) and the activity log.
- **Backups:** not verified (OPEN-03). Turn on Supabase daily backups (or point-in-time recovery) and test one restore into a spare project. A backup is not trusted until a restore has worked.

## Suggested targets
| Target | Value |
|---|---|
| Availability (CMS) | 99.5 % per month |
| Website availability | Same as Vercel (the website works even if the CMS is down) |
| Recovery Time Objective | 4 hours |
| Recovery Point Objective | 24 hours with daily backups (minutes with point-in-time recovery) |
| Error rate | < 1 % of API requests (watch Vercel logs) |
