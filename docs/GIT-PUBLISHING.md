# Git publishing

When it is turned on for a website, **Publish** in the CMS also writes the result into the website's real files on GitHub,
and Vercel rebuilds the website. The website then works even if the CMS is down, and Google sees real article pages.

## What the CMS writes (and nothing else)
- The website's own pages (`index.html`, `work.html`, …): only the edited words, picture addresses and the Google title/description change.
- Articles, in the way the website itself keeps them:
  - **Elanster demo** (one article design filled by a script): one page per live article, `blog/<address>.html`, made from `article.html`
    (links, styles and pictures fixed for the folder). Files at the older address `article-<address>.html` (made before the blog folder)
    are removed by the next publish. Home page links to `article.html?slug=<address>` of live articles point to the real file.
  - **We Are Zion** (each article is its own file in `blogs/`): the article's own file is updated; a new article gets a new file in `blogs/`
    in the same design. When an article is unpublished, a file the CMS made is removed and a file the website already had goes back exactly as it was.
  - Article lists on the pages (blog page, "Latest", "Keep reading") are rebuilt newest first.
- Pictures uploaded in the CMS: `assets/uploads/<id>.png` (or .jpg, .webp …).
- The article list on the blog page (`blog.html`): the cards are written as real HTML, newest first, so the list works without the CMS.
- A block between `<!-- cms:start -->` and `<!-- cms:end -->` in `sitemap.xml`.

Each publish is **one commit**. Unpublishing takes the edits out again (the file goes back to its original), and removes article pages and pictures the CMS made.

## Safety
- The CMS never force-pushes. If the branch moved meanwhile it tries again once, on top of the new commit.
- If someone edits a page file directly on GitHub, the CMS **does not overwrite it**. The Git window shows "changed in Git outside the CMS";
  choose **Take over** to let the CMS write it again (the outside edit is kept, the CMS edits are added).
- If GitHub is down or the token is wrong, Publish still works in the CMS (the script on the website shows the change). The Git window shows
  what failed; press **Publish to Git now** to retry.
- The token stays on the server. It is never shown, stored in the database, or written to a log.

## Set it up (once)
1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
   - Repository access: **Only select repositories** → the website repo (e.g. `Hensalin/elanster_website-demo`).
   - Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
   - Expiration: 90 days (put a reminder to renew it).
2. Vercel → project **elanster-cms** → Settings → Environment Variables → add `GITHUB_TOKEN` = the token → Redeploy.
3. In the CMS: Websites → the branch icon on the website's row → repository `owner/name`, branch `main` → **Save** → **Publish to Git now**.
4. Check the commit on GitHub and wait for Vercel to say Ready.

## Test
`docs/audit/tests/git-publish.mjs` runs 73 checks against a fake GitHub (see the file header).

## Sync from website and Git publishing
- Pages and article files written by Git publishing carry `<meta name="generator" content="Elanster CMS">`. Sync never reads them back
  as pages or articles (before this, every sync brought the CMS's own `article-….html` pages in again as new "article-…" articles).
- Sync reads a page from its untouched original (kept by the CMS) instead of the live file, so the edited words never become the "original" ones.
- Copies made before this fix: the Git window shows how many were found and has **Remove the copies** (hidden, not erased; their files are removed from GitHub).

## Speed and reliability
- Text files go straight into the commit; only pictures are uploaded separately (in parallel).
- If a publish happens while another one is still writing, it waits for it and then runs once more, so no change is left out.

Tests: `git-publish.mjs` (73), `git-copies.mjs` (22), `git-sync.mjs` (7).

## Content only from Git
With Git publishing on, every page the CMS writes gets `<meta name="elanster-cms" content="git">`, and the CMS scripts in it
(`cms-config.js`, `cms-content.js`, `cms.js`) load **only in the CMS editor's preview**. Visitors get the files exactly as they are in Git:
the demo pages make no request to the CMS at all; on We Are Zion the one-line loader in `js/zion.js` still downloads `cms.js`,
which sees the tag and stops at once (no content is fetched).
- The editor preview finds texts by their original words and by their published words (the files now hold the published ones).
- Turning Git publishing off (empty repository, Save) writes the pages once more without the tag, so the website updates live again.
- After Publish, the website changes when Vercel finishes (about 1 minute).

Browser test: `git-only-setup.mjs` + `git-only-browser.py` (12 checks).
