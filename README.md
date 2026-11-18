# Elanster CMS

One central CMS for all your websites (Elanster, We Are Zion, Indzara, future sites).
Admin dashboard + backend API + PostgreSQL database. Websites fetch published content over a secure API.

## What is built (Phases 1–5 core)
- Login, sessions, roles: **Super Admin**, **Website Admin**, **Editor** (checked on the server, not just hidden buttons)
- Websites: add, enable/disable, one API key per website
- Blogs: list (search, filters, pagination), editor (rich text, slug, excerpt, tags, category, SEO fields),
  save draft, preview link, publish, schedule, unpublish, update live article, duplicate, delete (soft)
- Public API: published content only, one website per key
- Dashboard with real counts, recent updates, activity log

## Coming next
Pages and Page Sections, Media Library (featured image upload), Users & Roles screen, Categories screen, Settings, SEO overview.

## Easiest way on Windows
Install Node.js 22 and PostgreSQL 16, then **double-click `setup.bat`**. It creates the database, your `.env`, the tables and your admin user, then starts the CMS. Next time just double-click `start.bat`.

## Set up on Windows by hand
1. Install **Node.js 22+** and **PostgreSQL 16** (remember the password you choose for the `postgres` user).
2. Create the database: open "SQL Shell (psql)" and run: `CREATE DATABASE elanster_cms;`
3. In this folder: copy `.env.example` to `.env` and fill in `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_PASSWORD`.
4. Run:
   ```
   npm install
   npm run db:migrate     # creates the tables
   npm run db:seed        # creates the Super Admin and your 3 websites
   npm run dev            # open http://localhost:3000
   ```
5. Sign in with the email and password from `.env`. Go to **Websites → API keys** to create a key for each website.

## How a website uses it
```
GET /api/v1/websites/<site-short-name>/blogs?page=1&limit=10     (header: X-API-Key: <key>)
GET /api/v1/websites/<site-short-name>/blogs/<slug>
```
See `examples/website-blog-example.html`. A key can only read its own website's **published** articles.
Responses are cached for 30 seconds by CDNs, so a publish appears on the website within about 30 seconds.

## Security notes
- Passwords are hashed (bcrypt). The session cookie is httpOnly. API keys are stored only as hashes.
- Article HTML is cleaned on save (scripts, event handlers, iframes removed).
- Set a strong `SESSION_SECRET` and use HTTPS in production. Do not commit `.env`.
