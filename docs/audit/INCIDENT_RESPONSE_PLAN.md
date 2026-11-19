# Incident response plan

| Situation | Do this first (minutes) | Then |
|---|---|---|
| A password may be stolen | Super Admin → Users → **Temporary password** for that person (signs them out everywhere) or switch them off | Check the activity log for changes; restore versions |
| Super Admin password stolen | Run `RESET-PASSWORD.bat`; change `SESSION_SECRET` in Vercel and redeploy (signs everyone out) | Review users and keys |
| Website shows wrong/defaced content | Unpublish the page/article, or switch the website off in Websites (the site shows its own HTML text) | Restore a version; check who changed it |
| API key leaked or misused | Websites → key icon → **Revoke**; create a new key; update the website script | — |
| Database secret leaked | Rotate the password in Supabase; update Vercel variables; redeploy | Check Supabase logs |
| CMS down | Websites keep working with their own text. Check Vercel deployment and `/api/v1/health` | Roll back the deployment if a release caused it |
| Database lost or corrupted | Stop editing; restore the latest Supabase backup | Re-run `npm run db:update` |

Keep a short record: what happened, when, what was done, what will prevent it next time.
