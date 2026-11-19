# Git publishing

When it is turned on for a website, **Publish** in the CMS also writes the result into the website's real files on GitHub,
and Vercel rebuilds the website. The website then works even if the CMS is down, and Google sees real article pages.

## What the CMS writes (and nothing else)
- The website's own pages (`index.html`, `work.html`, …): only the edited words, picture addresses and the Google title/description change.
- One page per live article: `article-<address>.html`, made from the website's own `article.html`, with its Google tags.
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
`docs/audit/tests/git-publish.mjs` runs 53 checks against a fake GitHub (see the file header).
