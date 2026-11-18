"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmt, useToast } from "@/components/ui";

export default function Websites() {
  const [sites, setSites] = useState<any[] | null>(null); const [me, setMe] = useState<any>(null);
  const [add, setAdd] = useState(false); const [keysFor, setKeysFor] = useState<any>(null);
  const { toast, el } = useToast();
  const load = useCallback(() => api("/api/v1/admin/websites").then(setSites).catch((e) => toast(e.message, true)), []); // eslint-disable-line
  useEffect(() => { load(); api("/api/v1/auth/me").then(setMe); }, [load]);
  const isSuper = me?.user.role === "SUPER_ADMIN";
  return (<>
    <div className="head"><div><h1>Websites</h1><p>Every website has its own content and its own API key.</p></div>
      {isSuper && <button className="btn dark" onClick={() => setAdd(true)}>+ Add website</button>}</div>
    {!sites ? <p>Loading…</p> : !sites.length ? <div className="empty">No websites yet.</div> :
      <div className="card" style={{ padding: 0, overflowX: "auto" }}><table>
        <thead><tr><th>Website</th><th>Domain</th><th>Published</th><th>Drafts</th><th>Status</th><th></th></tr></thead>
        <tbody>{sites.map((s) => (<tr key={s.id}>
          <td><b>{s.name}</b><br /><small style={{ color: "var(--muted)" }}>{s.slug}</small></td>
          <td>{s.domain || "—"}</td><td>{s.published}</td><td>{s.drafts}</td>
          <td><span className={"badge " + (s.active ? "PUBLISHED" : "UNPUBLISHED")}>{s.active ? "Connected" : "Disabled"}</span></td>
          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{isSuper && <>
            <button className="btn sm" onClick={() => setKeysFor(s)}>API keys</button>{" "}
            <button className="btn sm" onClick={async () => { try { await api(`/api/v1/admin/websites/${s.id}`, { method: "PUT", body: { active: !s.active } }); toast(s.active ? "Website disabled" : "Website enabled"); load(); } catch (e) { toast((e as Error).message, true); } }}>{s.active ? "Disable" : "Enable"}</button></>}</td>
        </tr>))}</tbody></table></div>}
    {add && <AddSite onClose={() => setAdd(false)} onDone={() => { setAdd(false); toast("Website added"); load(); }} />}
    {keysFor && <Keys site={keysFor} onClose={() => setKeysFor(null)} toast={toast} />}
    {el}
  </>);
}

function AddSite({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(""); const [domain, setDomain] = useState(""); const [err, setErr] = useState("");
  return (<div className="modal" onClick={onClose}><form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
    e.preventDefault(); setErr(""); try { await api("/api/v1/admin/websites", { method: "POST", body: { name, domain } }); onDone(); } catch (x) { setErr((x as Error).message); } }}
    style={{ background: "var(--card)", borderRadius: 20, padding: 24, width: "min(520px,100%)" }}>
    <h2>Add website</h2>
    <div className="field"><label htmlFor="n">Name</label><input id="n" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Indzara" /></div>
    <div className="field"><label htmlFor="d">Domain</label><input id="d" type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://www.example.com" /></div>
    {err && <p className="err-text">{err}</p>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn dark">Add website</button></div>
  </form></div>);
}

function Keys({ site, onClose, toast }: { site: any; onClose: () => void; toast: (m: string, e?: boolean) => void }) {
  const [keys, setKeys] = useState<any[]>([]); const [fresh, setFresh] = useState(""); const [label, setLabel] = useState("Website");
  const load = useCallback(() => api(`/api/v1/admin/websites/${site.id}/api-keys`).then(setKeys), [site.id]);
  useEffect(() => { load(); }, [load]);
  return (<div className="modal" onClick={onClose}><div onClick={(e) => e.stopPropagation()}>
    <h2>API keys — {site.name}</h2>
    <p style={{ color: "var(--muted)" }}>This key lets <b>{site.name}</b> read its own published content. It cannot read other websites or any drafts.</p>
    {fresh && <div style={{ marginBottom: 14 }}><p><b>Copy this key now. It will not be shown again.</b></p><div className="keybox">{fresh}</div>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(fresh); toast("Copied"); }}>Copy key</button></div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Key label" />
      <button className="btn dark" onClick={async () => { try { const r = await api(`/api/v1/admin/websites/${site.id}/api-keys`, { method: "POST", body: { label } }); setFresh(r.key); load(); } catch (e) { toast((e as Error).message, true); } }}>Create key</button></div>
    {keys.map((k) => (<div className="row" key={k.id}><div><b>{k.label}</b> <code>{k.prefix}…</code><small>Created {fmt(k.createdAt)} · last used {fmt(k.lastUsedAt)}</small></div>
      {k.active ? <button className="btn sm danger" onClick={async () => { if (!confirm("Revoke this key? Websites using it will stop working.")) return; await api(`/api/v1/admin/websites/${site.id}/api-keys/${k.id}`, { method: "DELETE" }); load(); }}>Revoke</button> : <span className="badge UNPUBLISHED">Revoked</span>}</div>))}
    <div style={{ textAlign: "right", marginTop: 14 }}><button className="btn" onClick={onClose}>Close</button></div>
  </div></div>);
}
