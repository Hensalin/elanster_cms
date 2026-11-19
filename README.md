# Elanster CMS

Two separate apps in one repository:

| Folder | What it is | Vercel project | Needs |
|---|---|---|---|
| `backend/` | API server: database, sign-in, roles, articles, pages, images, versions, public website API, article preview. **Test it with Postman** (`backend/postman`). | existing **elanster-cms** → `elanster-cms-five.vercel.app`, Root Directory = `backend` | `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `SESSION_SECRET`, optional `FRONTEND_URL` |
| `frontend/` | Admin screens (dashboard, content, editors, users). Holds no secrets and never touches the database: every `/api/...` call is passed to the backend. | new project, Root Directory = `frontend` | `BACKEND_URL=https://elanster-cms-five.vercel.app` |

The website (`js/cms-config.js`) keeps using the backend address — nothing to change there.

## Run on your computer
```
cd backend  && npm install && npm run dev     # http://localhost:3001  (needs backend/.env, see .env.example)
cd frontend && npm install && npm run dev     # http://localhost:3000  (BACKEND_URL defaults to http://localhost:3001)
```

## Database changes
Run `backend/SUPABASE-UPDATE.sql` once in Supabase → SQL Editor (safe to run again).

## Backend API tests
Import `backend/postman/Elanster-CMS.postman_collection.json` into Postman — see `backend/postman/POSTMAN-GUIDE.md`.
