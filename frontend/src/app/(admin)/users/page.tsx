"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserX, X } from "lucide-react";
import { api, fmt, useToast } from "@/components/ui";

type P = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; sites: { websiteId: string; role: string }[] };
type W = { id: string; name: string };
const ROLE: Record<string, string> = { SUPER_ADMIN: "Super Admin", WEBSITE_ADMIN: "Website Admin", EDITOR: "Editor" };

export default function Users() {
  const router = useRouter(); const { toast, el } = useToast();
  const [rows, setRows] = useState<P[] | null>(null); const [sites, setSites] = useState<W[]>([]); const [edit, setEdit] = useState<P | null>(null);
  const load = () => Promise.all([api<P[]>("/api/v1/admin/people"), api<W[]>("/api/v1/admin/websites")]).then(([p, w]) => { setRows(p); setSites(w); }).catch((e) => { toast((e as Error).message, true); if (/Forbidden/.test((e as Error).message)) router.replace("/"); });
  useEffect(() => { load(); }, []); // eslint-disable-line
  const save = async (id: string, body: object, msg: string) => { try { await api(`/api/v1/admin/people/${id}`, { method: "PATCH", body }); toast(msg); setEdit(null); load(); } catch (e) { toast((e as Error).message, true); } };
  const remove = async (p: P) => { if (!confirm(`Delete ${p.name}? They will no longer be able to sign in.`)) return; try { await api(`/api/v1/admin/people/${p.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast((e as Error).message, true); } };
  const pending = rows?.filter((r) => !r.active && !r.sites.length && r.role === "EDITOR") ?? [];
  return (<>
    <div className="head"><div><h1>Users</h1><p>Approve new accounts and choose which websites each person can work on.</p></div></div>
    {pending.length > 0 && <div className="card" style={{ marginBottom: 16 }}><h2>Waiting for approval <span className="count-pill">{pending.length}</span></h2>
      {pending.map((p) => <div className="row" key={p.id}><div><b>{p.name}</b><small>{p.email} · asked {fmt(p.createdAt)}</small></div><div className="list-actions"><button className="btn sm orange" onClick={() => setEdit(p)}><Check size={14} /> Review</button></div></div>)}</div>}
    <div className="card tbl">{!rows ? <div className="skel"><div /><div /></div> : <table><thead><tr><th>Name</th><th>Role</th><th>Websites</th><th>Status</th><th /></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td><b>{p.name}</b><div className="mut">{p.email}</div></td><td>{ROLE[p.role]}</td>
        <td className="mut">{p.role === "SUPER_ADMIN" ? "All" : p.sites.length ? p.sites.map((s) => sites.find((w) => w.id === s.websiteId)?.name).filter(Boolean).join(", ") : "None"}</td>
        <td><span className={"badge " + (p.active ? "PUBLISHED" : "DRAFT")}>{p.active ? "Active" : "Off"}</span></td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="btn sm" onClick={() => setEdit(p)}>Manage</button> <button className="icon-btn" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Trash2 size={14} /></button></td></tr>)}</tbody></table>}</div>
    {edit && <Manage p={edit} sites={sites} onClose={() => setEdit(null)} onSave={save} />}
    {el}</>);
}

function Manage({ p, sites, onClose, onSave }: { p: P; sites: W[]; onClose: () => void; onSave: (id: string, b: object, m: string) => void }) {
  const [role, setRole] = useState(p.role); const [active, setActive] = useState(p.active || p.sites.length > 0 ? p.active : true);
  const [sel, setSel] = useState<Record<string, string>>(Object.fromEntries(p.sites.map((s) => [s.websiteId, s.role])));
  const [temp, setTemp] = useState(""); const [err, setErr] = useState("");
  const resetPw = async () => { if (!confirm(`Give ${p.name} a new temporary password? Their old password stops working.`)) return;
    try { setTemp((await api<{ password: string }>(`/api/v1/admin/people/${p.id}/reset-password`, { method: "POST" })).password); } catch (e) { setErr((e as Error).message); } };
  const noSite = role !== "SUPER_ADMIN" && active && Object.keys(sel).length === 0;
  return (<><div className="so-dim" onClick={onClose} /><aside className="slide" style={{ width: "min(480px,94vw)" }} role="dialog" aria-label={`Manage ${p.name}`}>
    <div className="slide-head"><b>{p.name}</b><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
    <div style={{ padding: 20, overflow: "auto", display: "grid", gap: 16 }}>
      <div className="mut">{p.email}</div>
      <div className="field"><label htmlFor="r">Role</label><select id="r" value={role} onChange={(e) => setRole(e.target.value)}><option value="EDITOR">Editor — writes, sends for review</option><option value="WEBSITE_ADMIN">Website Admin — can publish</option><option value="SUPER_ADMIN">Super Admin — everything</option></select></div>
      {role !== "SUPER_ADMIN" && <fieldset style={{ border: 0, padding: 0 }}><legend><b>Websites this person can use</b></legend>
        {sites.map((w) => <div key={w.id} className="row"><label><input type="checkbox" checked={w.id in sel} onChange={(e) => setSel((s) => { const n = { ...s }; if (e.target.checked) n[w.id] = role === "WEBSITE_ADMIN" ? "WEBSITE_ADMIN" : "EDITOR"; else delete n[w.id]; return n; })} /> {w.name}</label></div>)}</fieldset>}
      <label><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Account is active (can sign in)</label>
      {noSite && <p className="err-text">Tick at least one website, or this person will sign in to an empty CMS.</p>}
      <hr className="sep" />
      <div><b>Password</b><p className="mut" style={{ margin: "4px 0 8px", fontSize: 13 }}>Forgot their password? Give them a temporary one. They change it under My account after signing in.</p>
        {temp ? <><div className="keybox">{temp}</div><small className="mut">Shown only once. Send it to {p.name} privately.</small></> : <button className="btn sm" onClick={resetPw}>Give a temporary password</button>}
        {err && <p className="err-text">{err}</p>}</div>
      <button className="btn dark" disabled={noSite} onClick={() => onSave(p.id, { role, active, sites: role === "SUPER_ADMIN" ? [] : Object.entries(sel).map(([websiteId, r]) => ({ websiteId, role: role === "WEBSITE_ADMIN" ? "WEBSITE_ADMIN" : r === "WEBSITE_ADMIN" ? "WEBSITE_ADMIN" : "EDITOR" })) }, "Saved")}>Save</button>
    </div></aside></>);
}
