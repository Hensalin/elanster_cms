import { createHash } from "node:crypto";

/* A very small GitHub client: read a file, and write several files as ONE commit (no force-push, ever).
   The token comes from the environment (GITHUB_TOKEN) and is never logged, stored or put in an error message. */

const api = () => (process.env.GITHUB_API || "https://api.github.com").replace(/\/+$/, "");
export const hasToken = () => !!process.env.GITHUB_TOKEN;
export const validRepo = (r: string) => /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(r);
export const validBranch = (b: string) => /^[A-Za-z0-9_./-]{1,100}$/.test(b) && !b.includes("..") && !b.startsWith("/") && !b.endsWith("/");

export class GitError extends Error { constructor(msg: string, public status = 0) { super(msg); } }

async function call(path: string, init: RequestInit & { raw?: boolean } = {}) {
  const token = process.env.GITHUB_TOKEN; if (!token) throw new GitError("GITHUB_TOKEN is not set on the server");
  let res: Response;
  try {
    res = await fetch(api() + path, {
      ...init, cache: "no-store", signal: AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${token}`, Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "elanster-cms", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch { throw new GitError("Could not reach GitHub"); }
  return res;
}
async function fail(res: Response, what: string): Promise<never> {
  const hint = res.status === 401 ? "The GitHub token is wrong or expired" : res.status === 403 ? "The GitHub token is not allowed to do this (or a rate limit was hit)"
    : res.status === 404 ? "Repository or branch not found, or the token cannot see it" : res.status === 422 ? "GitHub refused the change" : `GitHub answered ${res.status}`;
  throw new GitError(`${what}: ${hint}`, res.status);
}

/** Git's own hash of a file, so a file can be compared with what is in the repo without downloading it twice. */
export const blobSha = (b: Buffer) => createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");

export async function getHead(repo: string, branch: string) {
  const res = await call(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
  if (!res.ok) return fail(res, "Reading the branch");
  const ref = await res.json() as { object: { sha: string } };
  const c = await call(`/repos/${repo}/git/commits/${ref.object.sha}`);
  if (!c.ok) return fail(c, "Reading the latest commit");
  const commit = await c.json() as { tree: { sha: string } };
  return { commit: ref.object.sha, tree: commit.tree.sha };
}

/** The file's bytes at that commit, or null when it does not exist. */
export async function readFile(repo: string, path: string, ref: string): Promise<Buffer | null> {
  const res = await call(`/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`, { raw: true });
  if (res.status === 404) return null;
  if (!res.ok) return fail(res, `Reading ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

export type FileChange = { path: string; content: Buffer | null };   // null = delete

/** One commit with all the changes. Fails (without force) if the branch moved meanwhile, so nothing of anyone else is overwritten. */
export async function commitFiles(repo: string, branch: string, base: { commit: string; tree: string }, files: FileChange[], message: string) {
  const tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const f of files) {
    if (f.content === null) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
    const b = await call(`/repos/${repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.content.toString("base64"), encoding: "base64" }) });
    if (!b.ok) return fail(b, `Uploading ${f.path}`);
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: ((await b.json()) as { sha: string }).sha });
  }
  const t = await call(`/repos/${repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: base.tree, tree }) });
  if (!t.ok) return fail(t, "Building the commit");
  const c = await call(`/repos/${repo}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: ((await t.json()) as { sha: string }).sha, parents: [base.commit] }) });
  if (!c.ok) return fail(c, "Creating the commit");
  const sha = ((await c.json()) as { sha: string }).sha;
  const r = await call(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`, { method: "PATCH", body: JSON.stringify({ sha, force: false }) });
  if (!r.ok) { if (r.status === 422) throw new GitError("The branch changed while publishing", 422); return fail(r, "Updating the branch"); }
  return sha;
}
