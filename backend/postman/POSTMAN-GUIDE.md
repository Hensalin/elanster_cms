# Testing the Elanster CMS backend with Postman

The file `Elanster-CMS.postman_collection.json` tests every part of the CMS backend: sign in, websites, categories, images, blog articles (create → review → publish → public website API → unpublish → delete), website pages (edit → publish → check the website gets it → undo), users, activity log and security (wrong password, no API key, signed-out access).

It has **51 requests and 88 automatic checks**. Each check shows green (pass) or red (fail).

## 1. Import
Postman → **Import** → choose `Elanster-CMS.postman_collection.json`.

## 2. Set the variables
Click the collection name → **Variables** tab → fill in the **Current value** column:

| Variable | What to put |
|---|---|
| `baseUrl` | `https://elanster-cms-five.vercel.app` (already filled) |
| `email` | your CMS sign-in email |
| `password` | your CMS password (stays on your computer only) |
| `siteSlug` | `main-elansyer` (already filled) |
| `apiKey` | leave empty — the run creates a read-only key. Or paste the key from your website's `js/cms-config.js` |

Click **Save**.

## 3. Run everything
Click the collection → **Run** → **Run Elanster CMS — full backend test**.
All 88 checks should be green. If one is red, click it to see the reason.

## What the run changes
- Creates a test article, a test category and a test image, then **deletes them** at the end.
- The **Website pages** folder changes one text on your live website for a few seconds, checks the website receives it, then puts the old text back. If you don't want that, untick folder **6. Website pages** in the Runner.
- If `apiKey` is empty, it adds one read-only API key named "Postman test" (you can delete it in Websites).

## Run from the command line (optional)
```
npm install -g newman
newman run Elanster-CMS.postman_collection.json --env-var email=YOUR_EMAIL --env-var password=YOUR_PASSWORD
```

## Main endpoints (for reference)
| Area | Method & path |
|---|---|
| Health | `GET /api/v1/health` |
| Sign in / out / me | `POST /api/v1/auth/login` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/me` |
| Dashboard | `GET /api/v1/admin/stats` |
| Websites | `GET /api/v1/admin/websites` · `POST /api/v1/admin/websites/{id}/api-keys` |
| Categories | `GET/POST /api/v1/admin/categories` · `PATCH/DELETE /api/v1/admin/categories/{id}` |
| Images | `GET /api/v1/admin/media` · `POST /api/v1/admin/media` (upload) · `POST /api/v1/admin/media/from-url` · `DELETE /api/v1/admin/media/{id}` · public `GET /api/v1/media/{id}` |
| Articles | `GET/POST /api/v1/admin/blogs` · `GET/PUT/DELETE /api/v1/admin/blogs/{id}` · `POST /api/v1/admin/blogs/{id}/publish` with `action`: publish, unpublish, submit, request_changes (+note), schedule (+scheduledAt) |
| Pages | `GET /api/v1/admin/pages` · `GET/PUT /api/v1/admin/pages/{id}` · `POST /api/v1/admin/pages/{id}/publish` with `action`: publish, unpublish, discard |
| Versions | `GET /api/v1/admin/versions?entity=blog|page&id=…` · `POST /api/v1/admin/versions/{id}` (restore) |
| Users & log | `GET /api/v1/admin/people` · `PATCH /api/v1/admin/people/{id}` · `GET /api/v1/admin/activity` (`&format=csv`) · `PATCH /api/v1/admin/account` |
| Public website API (needs `X-API-Key`) | `GET /api/v1/websites/{site}/blogs` · `GET /api/v1/websites/{site}/blogs/{slug}` · `GET /api/v1/websites/{site}/pages/{slug}` |
