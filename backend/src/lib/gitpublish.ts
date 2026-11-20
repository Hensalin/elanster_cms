import { after } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyEdits } from "./htmledit";
import { articleDir, rebuildLists, renderInFile } from "./sitearticles";
import { ARTICLE_DIR, articlePath, hasArticleList, mediaIds, renderArticle, renderList, validSlug, type Article } from "./articlepage";
import { blobSha, commitFiles, getHead, GitError, hasToken, readFile, validBranch, validRepo, type FileChange } from "./github";
import { blogWithRelations } from "./blogs";
import { livePublished, notDeleted, publicBlog } from "./public";
import { readContent } from "./pagecontent";

/* Git publishing: the website's real files are the result of "original file + published CMS edits".
   Every run works the whole result out from the database and writes only what differs, as one commit. So it can be repeated
   safely (retry), unpublishing removes edits by itself, and nothing outside the allowed files is ever touched. */

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const MARK_A = "<!-- cms:start -->", MARK_B = "<!-- cms:end -->";

/** The only files the CMS may ever write or delete in a website's repo. */
export function allowedPath(path: string, pageFiles: Set<string>, dir: string | null = null) {
  if (dir && /^[a-z0-9_-]{1,40}$/i.test(dir) && new RegExp(`^${dir}/[a-z0-9][a-z0-9-]{0,100}\\.html$`).test(path)) return true;   // the website's article folder
  if (pageFiles.has(path)) return /^[A-Za-z0-9_\-./]+\.html$/.test(path) && !path.includes("..") && !path.startsWith("/") && !path.split("/").some((s) => s.startsWith("."));
  if (new RegExp(`^${ARTICLE_DIR}/[a-z0-9][a-z0-9-]{0,100}\\.html$`).test(path) && !pageFiles.has(path)) return true;
  return /^article-[a-z0-9][a-z0-9-]{0,100}\.html$/.test(path) || /^assets\/uploads\/[A-Za-z0-9_-]{1,40}\.(jpg|png|webp|gif|avif)$/.test(path) || path === "sitemap.xml";
}

/* "Content only from Git": a written page says so with <meta name="elanster-cms" content="git">, and the CMS scripts in it
   load only inside the CMS editor's preview (?cms-edit=1 in the editor's frame). Visitors get the file exactly as it is in Git:
   nothing is fetched from the CMS. Turning Git publishing off writes the pages once more without this. */
const PREVIEW = `/[?&]cms-edit=1/.test(location.search)&&window.parent!==window`;
export function gitOnly(html: string): string {
  // A normal website (no CMS script in it) is written exactly as it is: nothing is added.
  if (!/<script\b[^>]*\bsrc=["'][^"']*(?:cms-config|cms-content|\/cms)\.js/i.test(html)) return html;
  let out = html;
  if (!/<meta\s+name=["']elanster-cms["']\s+content=["']git["']/i.test(out)) out = out.replace(/<\/head>/i, () => `  <meta name="elanster-cms" content="git">\n</head>`);
  // <script src=".../cms-config.js|cms-content.js|cms.js" ...></script> → loaded only for the editor preview, in the same order
  out = out.replace(/<script\b([^>]*?)\bsrc=(["'])([^"']*(?:cms-config|cms-content|\/cms)\.js[^"']*)\2([^>]*)>\s*<\/script>/gi, (_m, a: string, _q: string, src: string, b: string) => {
    const attrs = [...`${a} ${b}`.matchAll(/\b(data-[a-z-]+)=(["'])([^"']*)\2/gi)].map((x) => `s.setAttribute(${JSON.stringify(x[1])},${JSON.stringify(x[3])});`).join("");
    return `<script>/* Elanster CMS: this page's content comes from Git; the CMS script loads only in the CMS editor preview */if(${PREVIEW}){var s=document.createElement("script");s.src=${JSON.stringify(src)};s.async=false;${attrs}document.head.appendChild(s);}</script>`;
  });
  return out;
}

export type GitResult = { status: "OK" | "WARN" | "FAILED" | "SKIPPED"; message: string; files: number; commit?: string; warnings?: string[]; written?: string[]; mode?: string };
const sha = (s: string) => blobSha(Buffer.from(s));

type Plan = { changes: FileChange[]; state: Array<{ path: string; kind: string; original: string | null; lastSha: string }>; drop: string[]; warnings: string[]; touched: string[]; dir: string | null };

async function plan(site: typeof schema.websites.$inferSelect, repo: string, head: { commit: string }, force: Set<string>, mark = true): Promise<Plan> {
  const only = (h: string) => (mark ? gitOnly(h) : h);
  const P: Plan = { changes: [], state: [], drop: [], warnings: [], touched: [], dir: null };
  const wid = site.id;
  const rows = await db.select().from(schema.gitFiles).where(eq(schema.gitFiles.websiteId, wid));
  const st = new Map(rows.map((r) => [r.path, r]));
  const pages = await db.select().from(schema.pages).where(eq(schema.pages.websiteId, wid));
  const live = pages.filter((p) => !p.deletedAt);
  const global = live.find((p) => p.slug === "_global");
  const effective = (p: typeof pages[number]) => (p.status === "PUBLISHED" ? readContent(p.content).published : {});
  const pageFiles = new Set(live.map((p) => readContent(p.content).file).filter((f): f is string => !!f));

  // Pictures: every CMS picture used by published edits or live articles is committed once as a real file.
  const assets = new Map<string, string>();   // media id → path in the repo
  const needAsset = async (ids: string[]) => {
    const want = [...new Set(ids)].filter((i) => !assets.has(i)); if (!want.length) return;
    const ms = await db.select({ id: schema.media.id, mime: schema.media.mimeType }).from(schema.media).where(inArray(schema.media.id, want));   // a picture removed from the library but still used by a live article is still written
    for (const m of ms) { const e = EXT[m.mime]; if (e) assets.set(m.id, `assets/uploads/${m.id}.${e}`); }
  };
  const assetUrl = (id: string) => (assets.has(id) ? "/" + assets.get(id) : null);

  // ---- live articles (newest first): used for the list on the blog page and for the article pages
  const domain = site.domain ? site.domain.replace(/\/+$/, "") : "";
  const smBuf = await readFile(repo, "sitemap.xml", head.commit);
  const smBase = smBuf ? /<loc>\s*(https?:\/\/[^/<\s]+)/i.exec(smBuf.toString("utf8"))?.[1] ?? "" : "";
  const siteUrl = smBase || (/^https?:\/\//.test(domain) ? domain : "");
  const liveBlogs = await db.select({ id: schema.blogs.id }).from(schema.blogs).where(and(eq(schema.blogs.websiteId, wid), livePublished(), notDeleted()));
  const arts: Article[] = [];
  for (const { id } of liveBlogs) { const b = await blogWithRelations(id); if (b && validSlug(b.slug)) arts.push(publicBlog(b, "", true)); }
  arts.sort((a, b) => +new Date(b.publishedAt ?? 0) - +new Date(a.publishedAt ?? 0));
  const articleIds = arts.flatMap((a) => [...mediaIds(a.content ?? ""), ...mediaIds(a.featuredImage?.url ?? "")]);
  await needAsset(articleIds);

  // ---- pages
  const pageOut = new Map<string, { slug: string; orig: string; values: Record<string, string>; originals: Record<string, string>; repoBuf: Buffer }>();
  const globalVals = global ? effective(global) : {};
  const origOf = (p?: typeof pages[number]) => Object.fromEntries((p ? readContent(p.content).fields : []).map((f) => [f.key, f.text]));
  const globalOrig = origOf(global);
  for (const p of live) {
    if (p.slug === "_global") continue;
    const file = readContent(p.content).file;
    if (!file || !allowedPath(file, pageFiles)) continue;
    const repoBuf = await readFile(repo, file, head.commit);
    if (!repoBuf) continue;   // a page the CMS knows that is not (or no longer) in the repo: nothing to write
    const rec = st.get(file);
    let orig: string;
    if (!rec || !rec.original) orig = repoBuf.toString("utf8");
    else if (rec.lastSha !== blobSha(repoBuf) && !force.has(file)) { P.warnings.push(`${file}: changed in Git outside the CMS, so it was not touched. Use "Take over this file" to let the CMS write it again.`); continue; }
    else orig = force.has(file) && rec.lastSha !== blobSha(repoBuf) ? repoBuf.toString("utf8") : rec.original;
    pageOut.set(file, { slug: p.slug, orig, values: { ...globalVals, ...effective(p) }, originals: { ...globalOrig, ...origOf(p) }, repoBuf });
  }
  // Pages of the website that only have shared texts also get them (every page file listed above already includes the shared ones).
  await needAsset([...pageOut.values()].flatMap((x) => Object.values(x.values).flatMap((v) => mediaIds(v))));
  for (const [file, x] of pageOut) {
    const done = applyEdits(x.orig, x.slug, x.values, (u) => { const m = /\/api\/v1\/media\/([A-Za-z0-9_-]+)/.exec(u); return (m && assetUrl(m[1])) || u; }, x.originals);
    // Article lists are real HTML too: the blog page's list area (Elanster demo), or the article cards of the page (We Are Zion).
    let html = hasArticleList(done.html) ? renderList(done.html, arts, assetUrl) : rebuildLists(done.html, arts, null, assetUrl);
    const up = "../".repeat(file.split("/").length - 1), live = new Set(arts.map((a) => a.slug));
    html = html.replace(/(\shref=)(["'])(?:\.\.\/)*article\.html\?(?:slug|article)=([a-z0-9][a-z0-9-]*)\2/gi, (m, a: string, q: string, slug: string) => (live.has(slug) ? `${a}${q}${up}${articlePath(slug)}${q}` : m));
    const buf = Buffer.from(only(html));
    P.state.push({ path: file, kind: "page", original: x.orig, lastSha: blobSha(buf) });
    if (!x.repoBuf.equals(buf)) { P.changes.push({ path: file, content: buf }); P.touched.push(file); }
  }

  const wanted = new Set<string>();   // article files the CMS created (listed in the sitemap block)
  const asset = (u: string) => { const m = /\/api\/v1\/media\/([A-Za-z0-9_-]+)/.exec(u); return (m && assetUrl(m[1])) || u; };
  const shellFile = "article.html";
  const shellBuf = arts.length || rows.some((r) => r.kind === "article") ? await readFile(repo, shellFile, head.commit) : null;
  if (shellBuf && /id="articleApp"/.test(shellBuf.toString("utf8"))) {
    // A) One article design filled by the website's script (Elanster demo): every article becomes article-<slug>.html.
    const sp = pageOut.get(shellFile);
    const shell = sp ? applyEdits(sp.orig, sp.slug, sp.values, asset, sp.originals).html
      : applyEdits(shellBuf.toString("utf8"), "article", globalVals, asset, globalOrig).html;   // still gets the shared menu and footer edits
    for (const a of arts) {
      const path = articlePath(a.slug); if (pageFiles.has(path)) { P.warnings.push(`${path}: clashes with a page of the website (skipped)`); continue; }
      let html: string;
      try { html = only(renderArticle(shell, a, arts, { siteUrl, asset: assetUrl })); } catch (e) { P.warnings.push(`${path}: ${(e as Error).message}`); continue; }
      wanted.add(path);
      const buf = Buffer.from(html), h = blobSha(buf);
      P.state.push({ path, kind: "article", original: null, lastSha: h });
      if (st.get(path)?.lastSha !== h) { P.changes.push({ path, content: buf }); P.touched.push(path); }
    }
  } else if (arts.length || rows.some((r) => r.kind === "article" || r.kind === "article-own")) {
    // B) Every article is its own file in a folder (We Are Zion: blogs/<slug>.html). Its own file is edited; a new article gets a copy of one.
    const known = rows.find((r) => (r.kind === "article" || r.kind === "article-own") && r.path.includes("/") && !r.path.startsWith(ARTICLE_DIR + "/"))?.path.split("/")[0] ?? null;
    const dir = known ?? articleDir([...pageOut.values()].map((x) => x.orig), new Set(arts.map((a) => a.slug)));
    P.dir = dir;
    if (!dir) { if (arts.length) P.warnings.push("No article files were found on this website (for example blogs/<name>.html), so articles were not written to Git"); }
    else {
      let template: string | null = null, handMade: string | null = null, cmsMade: string | null = null;
      const isGen = (h: string) => /<meta\s+name=["']generator["']\s+content=["']Elanster CMS["']/i.test(h);
      const own = new Map<string, { orig: string; repo: Buffer | null; created: boolean }>();
      for (const a of arts) {
        const path = `${dir}/${a.slug}.html`; if (pageFiles.has(path)) { P.warnings.push(`${path}: clashes with a page of the website (skipped)`); continue; }
        const rec = st.get(path), repoBuf = await readFile(repo, path, head.commit);
        if (rec && rec.kind === "article-own" && rec.original) {
          if (repoBuf && rec.lastSha !== blobSha(repoBuf) && !force.has(path)) { P.warnings.push(`${path}: changed in Git outside the CMS, so it was not touched. Use "Take over this file" to let the CMS write it again.`); continue; }
          own.set(path, { orig: force.has(path) && repoBuf ? repoBuf.toString("utf8") : rec.original, repo: repoBuf, created: false });
        } else if (!rec && repoBuf) own.set(path, { orig: repoBuf.toString("utf8"), repo: repoBuf, created: false });
        else own.set(path, { orig: "", repo: repoBuf, created: true });
        if (!template && !own.get(path)!.created) template = own.get(path)!.orig;
        // A file the CMS once wrote but a person has since replaced with a hand-made design (no CMS tag):
        // its design is used for every article, and the CMS still owns the file.
        const txt = repoBuf?.toString("utf8") ?? "";
        if (rec?.kind === "article" && txt && !isGen(txt) && /<article\b|data-cms-article/i.test(txt) && !handMade) handMade = txt;
        // An article file the CMS wrote in this folder style (not the old article.html app) also works as the design.
        if (rec && txt && isGen(txt) && !/id="articleApp"/.test(txt) && /<article\b/i.test(txt) && !cmsMade) cmsMade = txt;
      }
      if (!template && handMade) template = handMade;
      if (!template) for (const r of rows) if (r.kind === "article-own" && r.original) { template = r.original; break; }
      if (!template && cmsMade) template = cmsMade;
      for (const a of arts) {
        const path = `${dir}/${a.slug}.html`, o = own.get(path); if (!o) continue;
        const base = o.created ? template : o.orig;
        if (!base) { P.warnings.push(`${path}: no article file to copy the design from (skipped)`); continue; }
        let html: string;
        try {
          html = applyEdits(base, "article", globalVals, asset, globalOrig).html;   // shared menu and footer edits
          html = renderInFile(html, a, { url: siteUrl ? `${siteUrl}/${path}` : "", asset: assetUrl, keepUrl: !o.created && o.orig.includes(`/${path}"`) });
          html = only(rebuildLists(html, arts, a.slug, assetUrl));                   // "Keep reading"
        } catch (e) { P.warnings.push(`${path}: ${(e as Error).message}`); continue; }
        if (o.created) wanted.add(path);
        const buf = Buffer.from(html), h = blobSha(buf);
        P.state.push({ path, kind: o.created ? "article" : "article-own", original: o.created ? null : o.orig, lastSha: h });
        if (!o.repo || !o.repo.equals(buf)) { P.changes.push({ path, content: buf }); P.touched.push(path); }
      }
      // An article file that was the website's own before the CMS: when the article is no longer live, the file goes back to how it was.
      const live = new Set(arts.map((a) => `${dir}/${a.slug}.html`));
      for (const r of rows) if (r.kind === "article-own" && !live.has(r.path) && r.original) {
        const cur = await readFile(repo, r.path, head.commit);
        if (cur && r.lastSha && blobSha(cur) !== r.lastSha && !force.has(r.path)) { P.warnings.push(`${r.path}: changed in Git outside the CMS, so it was not put back. Use "Take over this file".`); continue; }
        if (!cur || !cur.equals(Buffer.from(r.original))) { P.changes.push({ path: r.path, content: Buffer.from(r.original) }); P.touched.push(r.path); }
        P.drop.push(r.path);
      }
    }
  }
  // Articles that are no longer live: remove the page we wrote for them (only files the CMS itself created).
  const keep = new Set(P.state.map((x) => x.path));
  for (const r of rows) if (r.kind === "article" && !keep.has(r.path)) { P.changes.push({ path: r.path, content: null }); P.drop.push(r.path); P.touched.push(r.path); }

  // ---- pictures (written once; kept while used)
  const used = new Set<string>();
  for (const v of [...pageOut.values()].flatMap((x) => Object.values(x.values))) for (const i of mediaIds(v)) if (assets.has(i)) used.add(assets.get(i)!);
  for (const i of articleIds) if (assets.has(i)) used.add(assets.get(i)!);
  for (const path of used) {
    P.state.push({ path, kind: "asset", original: null, lastSha: "" });
    if (!st.has(path)) {
      const id = path.replace(/^assets\/uploads\//, "").replace(/\.\w+$/, "");
      const [m] = await db.select({ data: schema.media.data }).from(schema.media).where(eq(schema.media.id, id));
      if (m?.data) { P.changes.push({ path, content: Buffer.from(m.data) }); P.touched.push(path); }
    }
  }
  for (const r of rows) if (r.kind === "asset" && !used.has(r.path)) { P.changes.push({ path: r.path, content: null }); P.drop.push(r.path); P.touched.push(r.path); }

  // ---- sitemap: only our own block between two comments
  if (wanted.size || rows.some((r) => r.kind === "article")) {
    const buf = smBuf;
    if (buf && siteUrl) {
      const xml = buf.toString("utf8");
      const block = wanted.size ? `  ${MARK_A}\n${[...wanted].sort().map((p) => `  <url><loc>${siteUrl}/${p}</loc></url>`).join("\n")}\n  ${MARK_B}\n` : "";
      const has = xml.includes(MARK_A) && xml.includes(MARK_B);
      const next = has ? xml.replace(new RegExp(`[ \\t]*${MARK_A}[\\s\\S]*?${MARK_B}\\n?`), () => block) : block ? xml.replace(/<\/urlset>/, () => block + "</urlset>") : xml;
      if (next !== xml) { P.changes.push({ path: "sitemap.xml", content: Buffer.from(next) }); P.touched.push("sitemap.xml"); }
    }
  }
  return P;
}

async function setStatus(id: string, s: GitResult, extra: Partial<typeof schema.websites.$inferInsert> = {}) {
  await db.update(schema.websites).set({ gitStatus: s.status === "SKIPPED" ? "" : s.status, gitMessage: s.message.slice(0, 600), gitAt: new Date(), ...extra }).where(eq(schema.websites.id, id));
}

/** Writes the website's current published content to its GitHub repo. Safe to call at any time and as often as needed. */
export async function gitPublish(websiteId: string, opts: { force?: string[]; why?: string; unmark?: boolean } = {}): Promise<GitResult> {
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, websiteId));
  if (!site || site.deletedAt || !site.gitRepo) return { status: "SKIPPED", message: "Git publishing is not turned on for this website", files: 0 };
  if (!hasToken()) { const r: GitResult = { status: "FAILED", message: "GITHUB_TOKEN is not set on the server (Vercel → backend project → Environment Variables)", files: 0 }; await setStatus(websiteId, r); return r; }
  if (!validRepo(site.gitRepo) || !validBranch(site.gitBranch || "main")) { const r: GitResult = { status: "FAILED", message: "The repository or branch name is not valid", files: 0 }; await setStatus(websiteId, r); return r; }

  // One run at a time per website. If something is published while a run is busy, it runs once more afterwards.
  const got = await db.execute(sql`UPDATE websites SET git_status = 'RUNNING', git_again = false, git_at = now()
    WHERE id = ${websiteId} AND (git_status <> 'RUNNING' OR git_at < now() - interval '90 seconds') RETURNING id`);
  const rowsGot = (got as unknown as { rows: unknown[] }).rows;
  if (!rowsGot.length) { await db.update(schema.websites).set({ gitAgain: true }).where(eq(schema.websites.id, websiteId)); return { status: "SKIPPED", message: "Another publish is running; this change will follow it", files: 0 }; }

  const repo = site.gitRepo, branch = site.gitBranch || "main";
  let result: GitResult;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const head = await getHead(repo, branch);
        const P = await plan(site, repo, head, new Set(opts.force ?? []), !opts.unmark);
        const pageFiles = new Set((await db.select().from(schema.pages).where(eq(schema.pages.websiteId, websiteId))).map((p) => readContent(p.content).file).filter((f): f is string => !!f));
        const bad = P.changes.find((c) => !allowedPath(c.path, pageFiles, P.dir));
        if (bad) throw new GitError(`Refused to write ${bad.path}: not an allowed file`);
        let commit = head.commit;
        if (P.changes.length) {
          const names = P.touched.slice(0, 6).join(", ") + (P.touched.length > 6 ? ` and ${P.touched.length - 6} more` : "");
          commit = await commitFiles(repo, branch, head, P.changes, `CMS: ${opts.why || "publish"} (${names})`);
        }
        // Remember what is now in the repo (also when nothing changed: the first run records every page's untouched original).
        for (const s of P.state) await db.insert(schema.gitFiles).values({ websiteId, ...s }).onConflictDoUpdate({ target: [schema.gitFiles.websiteId, schema.gitFiles.path], set: { kind: s.kind, original: s.original, lastSha: s.lastSha, updatedAt: new Date() } });
        for (const d of P.drop) await db.delete(schema.gitFiles).where(and(eq(schema.gitFiles.websiteId, websiteId), eq(schema.gitFiles.path, d)));
        const extra = { written: P.touched.slice(0, 200), mode: P.dir ? `folder ${P.dir}/` : "design article.html" };
        result = P.warnings.length
          ? { status: "WARN", message: `${P.changes.length ? `${P.changes.length} file(s) written. ` : ""}${P.warnings.join(" · ")}`, files: P.changes.length, commit: P.changes.length ? commit : undefined, warnings: P.warnings, ...extra }
          : { status: "OK", message: P.changes.length ? `${P.changes.length} file(s) written to ${repo}. Vercel is rebuilding the website.` : "Nothing to change: the repo already matches.", files: P.changes.length, commit: P.changes.length ? commit : undefined, ...extra };
        break;
      } catch (e) {
        if (e instanceof GitError && e.status === 422 && /branch changed/i.test(e.message) && attempt < 1) continue;
        throw e;
      }
    }
  } catch (e) {
    result = { status: "FAILED", message: e instanceof GitError ? e.message : "Unexpected error while publishing to Git (see the server log)", files: 0 };
    if (!(e instanceof GitError)) console.error(e);
  }
  await setStatus(websiteId, result, result.commit ? { gitCommit: result.commit } : {});
  const [after] = await db.select({ again: schema.websites.gitAgain }).from(schema.websites).where(eq(schema.websites.id, websiteId));
  if (after?.again && result.status !== "FAILED") return gitPublish(websiteId, { why: opts.why });
  return result;
}

/** Called after a change that affects the live website. Runs after the answer is sent, so Publish never waits for GitHub.
    If another publish is busy, this waits for it to finish and then runs once more, so no change is ever left out. */
export function gitAfter(websiteId: string, why: string) {
  after(async () => {
    try {
      const [s] = await db.select({ repo: schema.websites.gitRepo }).from(schema.websites).where(eq(schema.websites.id, websiteId));
      if (!s?.repo) return;
      let r = await gitPublish(websiteId, { why });
      for (let i = 0; r.status === "SKIPPED" && /running/i.test(r.message) && i < 10; i++) {
        await new Promise((ok) => setTimeout(ok, 4000));
        const [w] = await db.select({ status: schema.websites.gitStatus, again: schema.websites.gitAgain }).from(schema.websites).where(eq(schema.websites.id, websiteId));
        if (w?.status === "RUNNING") continue;
        if (!w?.again) return;                       // the other run already included this change
        r = await gitPublish(websiteId, { why });
      }
    } catch (e) { console.error("git publish failed", e); }
  });
}

/** Scheduled articles go live by time, without anyone pressing Publish. Websites on Git publishing get written again once
    an article's time has passed after their last Git write. Called often (every open CMS window checks the bell each minute); cheap when nothing is due. */
export async function gitScheduledDue() {
  const due = await db.execute(sql`SELECT DISTINCT w.id FROM websites w JOIN blogs b ON b.website_id = w.id
    WHERE w.git_repo <> '' AND w.deleted_at IS NULL AND w.git_status <> 'RUNNING' AND b.deleted_at IS NULL AND b.status = 'SCHEDULED'
      AND b.scheduled_at <= now() AND (w.git_at IS NULL OR b.scheduled_at > w.git_at) LIMIT 5`);
  for (const r of (due as unknown as { rows: { id: string }[] }).rows) gitAfter(r.id, "scheduled article is now live");
}
