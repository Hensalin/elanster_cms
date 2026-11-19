# Deployment security checklist

Before / after each release:
- [ ] Run `FINISH-SETUP.bat` (installs, updates the database, uploads). Check Vercel "Ready" for **elanster-cms** and **frontend**.
- [ ] Vercel environment variables set on **elanster-cms**: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` (or `DATABASE_URL`), `SESSION_SECRET` (32+ random characters), `FRONTEND_URL`. On **frontend**: `BACKEND_URL`.
- [ ] `ALLOW_PRIVATE_FETCH` is **not** set in production (it is for local tests only).
- [ ] `/api/v1/health` returns 200 with `canConnect: true` and no missing tables.
- [ ] No `.env` / `.env.local` files in Git (`git status` before committing).
- [ ] We Are Zion: `vercel.json` and `.vercelignore` from `we-are-zion-security-fixes.zip` uploaded; `/server/server.js` returns 404.
- [ ] If the CMS address changes, add it to `frame-ancestors` in the website's `vercel.json`.

Once:
- [ ] Rotate the Supabase database password and the Vercel token that were shared in chats; update Vercel variables.
- [ ] Change the temporary Super Admin password.
- [ ] Turn on Supabase backups and test a restore.
- [ ] Delete the unused Vercel project `elanster-cms-admin`.
- [ ] Give every person the lowest role they need; remove people who left.
- [ ] Consider MFA for Super Admins.
