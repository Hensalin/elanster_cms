"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, GitBranch, KeyRound, Link2, Plus, Power, RefreshCw, Trash2, XCircle } from "lucide-react";
import { api, fmt, useToast } from "@/components/ui";

export default function Websites() {
  const [sites, setSites] = useState<any[] | null>(null); const [me, setMe] = useState<any>(null);
  const [add, setAdd] = useState(false); const [keysFor, setKeysFor] = useState<any>(null); const [checkFor, setCheckFor] = useState<any>(null); const [gitFor, setGitFor] = useState<any>(null);
  const { toast, el } = useToast();
  const load = useCallback(() => api("/api/v1/admin/websites").then(setSites).catch((e) => toast(e.message, true)), []); // eslint-disable-line
  useEffect(() => { load(); api("/api/v1/auth/me").then(setMe); }, [load]);
  const isSuper = me?.user.role === "SUPER_ADMIN";
  return (<>
    <div className="head"><div><h1>Websites</h1><p>Every website has its own content and its own API key.</p></div>
      {isSuper && <button className="btn dark" onClick={() => setAdd(true)}><Plus size={15} /> Add website</button>}</div>
    {!sites ? <div className="skel" aria-busy="true"><div /><div /><div /></div> : !sites.length ? <div className="empty">No websites yet.</div> :
      <div className="card tbl" style={{ padding: 0 }}><table>
        <thead><tr><th>Website</th><th>Address</th><th className="num">Live</th><th className="num">Drafts</th><th>Connection</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{sites.map((s) => {
          const setAddress = async () => { const d = prompt("Website address (used for the live preview and links). Example: https://websiteelanster.vercel.app", s.domain || ""); if (d === null) return; try { const r = await api(`/api/v1/admin/websites/${s.id}`, { method: "PUT", body: { domain: d.trim() } }); toast(r.sync?.pages ? `Address saved · ${r.sync.pages.length} pages brought in from the website` : r.sync?.error ? `Address saved. Pages not read: ${r.sync.error}` : "Address saved"); load(); } catch (e) { toast((e as Error).message, true); } };
          const toggle = async () => { try { await api(`/api/v1/admin/websites/${s.id}`, { method: "PUT", body: { active: !s.active } }); toast(s.active ? "Website turned off" : "Website turned on"); load(); } catch (e) { toast((e as Error).message, true); } };
          return (<tr key={s.id}>
          <td><div className="site-cell"><span className={"site-ic" + (s.active ? " on" : "")} aria-hidden>{s.name.slice(0, 1)}</span><div><b>{s.name}</b><small>{s.slug}</small></div></div></td>
          <td>{s.domain ? <a className="mut" href={s.domain} target="_blank" rel="noreferrer">{s.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : <span className="mut">Not set</span>}</td>
          <td className="num">{s.published}</td><td className="num">{s.drafts}</td>
          <td><Conn s={s} onCheck={() => setCheckFor(s)} /></td>
          <td style={{ textAlign: "right" }}>{isSuper && <div className="acts">
            <button className="icon-btn" title="Set website address" aria-label={`Set address for ${s.name}`} onClick={setAddress}><Link2 size={15} /></button>
            <button className="icon-btn" title="API keys" aria-label={`API keys for ${s.name}`} onClick={() => setKeysFor(s)}><KeyRound size={15} /></button>
            <button className="icon-btn" title="Check connection" aria-label={`Check connection for ${s.name}`} onClick={() => setCheckFor(s)}><RefreshCw size={15} /></button>
            <button className="icon-btn" title={s.gitRepo ? `Git publishing: ${s.gitStatus === "FAILED" ? "needs attention" : s.gitStatus === "WARN" ? "warning" : "on"}` : "Git publishing"} aria-label={`Git publishing for ${s.name}`} onClick={() => setGitFor(s)} style={s.gitStatus === "FAILED" ? { color: "#b91c1c" } : s.gitRepo ? { color: "#15803d" } : undefined}><GitBranch size={15} /></button>
            <button className="icon-btn" title={s.active ? "Turn off" : "Turn on"} aria-label={(s.active ? "Turn off " : "Turn on ") + s.name} onClick={toggle}><Power size={15} /></button>
            <button className="icon-btn danger-ic" title="Remove website" aria-label={`Remove ${s.name}`} onClick={async () => { if (!confirm(`Remove “${s.name}” from the CMS? Its articles and pages are hidden with it.`)) return; try { await api(`/api/v1/admin/websites/${s.id}`, { method: "DELETE" }); toast("Website removed"); load(); } catch (e) { toast((e as Error).message, true); } }}><Trash2 size={15} /></button>
          </div>}</td>
        </tr>); })}</tbody></table></div>}
    {add && <AddSite onClose={() => setAdd(false)} onDone={(r: any) => { setAdd(false); toast(r?.sync?.pages ? `Website added · ${r.sync.pages.length} pages brought in from ${r.domain.replace(/^https?:\/\//, "")}` : r?.sync?.error ? `Website added. Pages not read: ${r.sync.error}` : "Website added"); load(); }} />}
    {checkFor && <CheckPanel site={checkFor} onClose={() => { setCheckFor(null); load(); }} />}
    {gitFor && <GitPanel site={gitFor} onClose={() => { setGitFor(null); load(); }} toast={toast} />}
    {keysFor && <Keys site={keysFor} onClose={() => setKeysFor(null)} toast={toast} />}
    {el}
  </>);
}

function AddSite({ onClose, onDone }: { onClose: () => void; onDone: (r: any) => void }) {
  const [name, setName] = useState(""); const [domain, setDomain] = useState(""); const [err, setErr] = useState("");
  return (<div className="modal" onClick={onClose}><form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
    e.preventDefault(); setErr(""); try { onDone(await api("/api/v1/admin/websites", { method: "POST", body: { name, domain } })); } catch (x) { setErr((x as Error).message); } }}
    style={{ background: "var(--card)", borderRadius: 20, padding: 24, width: "min(520px,100%)" }}>
    <h2>Add website</h2>
    <div className="field"><label htmlFor="n">Name</label><input id="n" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Indzara" /></div>
    <div className="field"><label htmlFor="d">Website address</label><input id="d" type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://www.example.com" /><small>All pages on this address are brought in automatically. One address = one website.</small></div>
    {err && <p className="err-text">{err}</p>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn dark">Add website</button></div>
  </form></div>);
}

const cmsPublicUrl = () => process.env.NEXT_PUBLIC_CMS_API_URL || "https://elanster-cms-five.vercel.app"; // always the live CMS address, a website cannot reach localhost
const sharedSnippet = (key: string) => `<script src="${cmsPublicUrl()}/cms.js" data-key="${key}" defer></script>`;
function Keys({ site, onClose, toast }: { site: any; onClose: () => void; toast: (m: string, e?: boolean) => void }) {
  const [keys, setKeys] = useState<any[]>([]); const [fresh, setFresh] = useState(""); const [label, setLabel] = useState("Website");
  const load = useCallback(() => api(`/api/v1/admin/websites/${site.id}/api-keys`).then(setKeys), [site.id]);
  useEffect(() => { load(); }, [load]);
  return (<div className="modal" onClick={onClose}><div onClick={(e) => e.stopPropagation()}>
    <h2>API keys — {site.name}</h2>
    <p style={{ color: "var(--muted)" }}>This key lets <b>{site.name}</b> read its own published content. It cannot read other websites or any drafts.</p>
    {fresh && <div style={{ marginBottom: 14 }}><p><b>Your website script. Copy it now, it will not be shown again.</b></p>
      <p style={{ color: "var(--muted)" }}>Paste this line inside the <code>&lt;head&gt;</code> of your pages (just before <code>&lt;/head&gt;</code>), then push. It runs on every page where it is pasted.</p>
      <div className="keybox" style={{ wordBreak: "break-all" }}>{sharedSnippet(fresh)}</div>
      <button className="btn sm dark" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(sharedSnippet(fresh)); toast("Script copied"); }}>Copy script</button></div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Key label" />
      <button className="btn dark" onClick={async () => { try { const r = await api(`/api/v1/admin/websites/${site.id}/api-keys`, { method: "POST", body: { label } }); setFresh(r.key); load(); } catch (e) { toast((e as Error).message, true); } }}>Create key</button></div>
    {keys.map((k) => (<div className="row" key={k.id}><div><b>{k.label}</b> <code>{k.prefix}…</code><small>Created {fmt(k.createdAt)} · last used {fmt(k.lastUsedAt)}</small></div>
      {k.active ? <button className="btn sm danger" onClick={async () => { if (!confirm("Revoke this key? Websites using it will stop working.")) return; await api(`/api/v1/admin/websites/${site.id}/api-keys/${k.id}`, { method: "DELETE" }); load(); }}>Revoke</button> : <span className="badge UNPUBLISHED">Revoked</span>}</div>))}
    <div style={{ textAlign: "right", marginTop: 14 }}><button className="btn" onClick={onClose}>Close</button></div>
  </div></div>);
}

const ago = (d: string) => { const m = Math.round((Date.now() - +new Date(d)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

/** Friendly connection status from the website's key use: connected / waiting / not connected / off. */
function Conn({ s, onCheck }: { s: any; onCheck: () => void }) {
  const fresh = s.lastSeen && Date.now() - +new Date(s.lastSeen) < 7 * 864e5;
  const [cls, label, sub] = !s.active ? ["OFF", "Off", "Turned off in the CMS"]
    : fresh ? ["PUBLISHED", "Connected", `Website read content ${ago(s.lastSeen)}`]
    : s.keys > 0 ? ["IN_REVIEW", "Waiting for website", s.lastSeen ? `Last seen ${ago(s.lastSeen)}` : "Key made, not used yet"]
    : ["OFF", "Not connected", "No key yet"];
  return (<button className="conn" onClick={onCheck} title="Check connection"><span className={"badge " + cls}>{label}</span><small>{sub}</small></button>);
}

function CheckPanel({ site, onClose }: { site: any; onClose: () => void }) {
  const [checks, setChecks] = useState<{ ok: boolean; label: string; hint?: string }[] | null>(null); const [err, setErr] = useState("");
  const run = useCallback(() => { setChecks(null); setErr(""); api(`/api/v1/admin/websites/${site.id}/check`).then(setChecks).catch((e) => setErr(e.message)); }, [site.id]);
  useEffect(() => { run(); }, [run]);
  const must = checks?.filter((c) => !(c.hint ?? "").startsWith("Optional")) ?? [];
  const allOk = !!checks && must.length > 0 && must.every((c) => c.ok);
  return (<div className="modal" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="check-panel">
    <div className={"check-hero " + (!checks ? "" : allOk ? "ok" : "bad")}>
      {!checks ? <RefreshCw size={26} className="spin" /> : allOk ? <CheckCircle2 size={30} /> : <CircleAlert size={30} />}
      <div><h2>{!checks ? "Checking the connection…" : allOk ? "Connected" : "Not connected yet"}</h2>
        <p>{!checks ? `Opening ${site.domain || site.name} and testing its key.` : allOk ? `${site.name} is reading its articles and pages from this CMS. What you publish appears there.` : "Follow the first red step below, then check again."}</p></div></div>
    {err && <p className="err-text">{err}</p>}
    {checks && <ol className="checklist">{checks.map((c, i) => { const opt = (c.hint ?? "").startsWith("Optional");
      return <li key={i} className={c.ok ? "ok" : opt ? "opt" : "bad"}>{c.ok ? <CheckCircle2 size={18} /> : opt ? <CircleAlert size={18} /> : <XCircle size={18} />}
        <div><b>{c.label}</b>{!c.ok && c.hint && <small>{c.hint}</small>}
          {!c.ok && c.label === "Website is turned on in the CMS" && <button className="btn sm dark" style={{ marginTop: 8 }} onClick={async () => { try { await api(`/api/v1/admin/websites/${site.id}`, { method: "PUT", body: { active: true } }); run(); } catch (e) { setErr((e as Error).message); } }}><Power size={13} /> Turn on now</button>}</div></li>; })}</ol>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}><button className="btn" onClick={run} disabled={!checks}><RefreshCw size={14} /> Check again</button><button className="btn dark" onClick={onClose}>Done</button></div>
  </div></div>);
}

function GitPanel({ site, onClose, toast }: { site: any; onClose: () => void; toast: (m: string, e?: boolean) => void }) {
  const [g, setG] = useState<any>(null); const [repo, setRepo] = useState(site.gitRepo || ""); const [branch, setBranch] = useState(site.gitBranch || "main");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = useCallback(() => api(`/api/v1/admin/websites/${site.id}/git`).then((x) => { setG(x); }).catch((e) => setErr(e.message)), [site.id]);
  useEffect(() => { load(); }, [load]);
  const save = async () => { setBusy(true); setErr(""); try { await api(`/api/v1/admin/websites/${site.id}`, { method: "PUT", body: { gitRepo: repo.trim(), gitBranch: branch.trim() || "main" } }); toast(repo.trim() ? "Git publishing saved" : "Git publishing turned off"); load(); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const publish = async (file?: string) => { setBusy(true); setErr(""); try { const r = await api(`/api/v1/admin/websites/${site.id}/git`, { method: "POST", body: file ? { action: "take_over", file } : { action: "publish" } }); setG((o: any) => ({ ...o, ...r })); toast(r.message, r.status === "FAILED"); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const files = (g?.status === "WARN" ? String(g.message || "").split(" · ") : []).map((m) => /^(.+?\.html): changed in Git/.exec(m)?.[1]).filter(Boolean) as string[];
  return (<div className="modal" onClick={onClose}><div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Git publishing for ${site.name}`} style={{ background: "var(--card)", borderRadius: 20, padding: 24, width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto" }}>
    <h2>Git publishing — {site.name}</h2>
    <p style={{ color: "var(--muted)" }}>When you press <b>Publish</b>, the CMS writes the changed texts, pictures and article pages into this website's real files on GitHub. Vercel then rebuilds the website. The website keeps working even if the CMS is down.</p>
    {g && !g.tokenSet && <p className="err-text" role="alert"><b>The GitHub token is not set on the server.</b> Add <code>GITHUB_TOKEN</code> in Vercel → the <b>elanster-cms</b> project → Settings → Environment Variables, then redeploy.</p>}
    <div className="field"><label htmlFor="gr">GitHub repository</label><input id="gr" type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Hensalin/elanster_website-demo" /></div>
    <div className="field"><label htmlFor="gb">Branch</label><input id="gb" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" /></div>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Leave the repository empty to turn Git publishing off. The CMS only ever writes the website's pages, its article pages (<code>article-….html</code>), uploaded pictures and a block in <code>sitemap.xml</code>. It never touches anything else.</p>
    {g && g.enabled && <div className="tip" style={{ marginTop: 10 }}>
      <b>Status: {g.status === "OK" ? "Up to date" : g.status === "WARN" ? "Needs a look" : g.status === "FAILED" ? "Failed" : g.status === "RUNNING" ? "Publishing…" : "Not published yet"}</b>
      {g.message && <div style={{ marginTop: 4 }}>{g.message}</div>}
      {g.commit && <div className="mut" style={{ marginTop: 4, fontSize: 12 }}>Last commit {String(g.commit).slice(0, 7)}{g.at ? " · " + fmt(g.at) : ""}</div>}
    </div>}
    {files.map((f) => <button key={f} className="btn sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => { if (confirm(`Let the CMS write ${f} again? Changes made to this file directly in Git will be replaced.`)) publish(f); }}>Take over {f}</button>)}
    {err && <p className="err-text" role="alert">{err}</p>}
    <div style={{ display: "flex", flexWrap: "wrap", marginTop: 14, gap: 8, justifyContent: "flex-end" }}>
      <button className="btn" onClick={onClose}>Close</button>
      {g?.enabled && <button className="btn" disabled={busy} onClick={() => publish()}>{busy ? "Working…" : "Publish to Git now"}</button>}
      <button className="btn dark" disabled={busy} onClick={save}>Save</button>
    </div>
  </div></div>);
}
