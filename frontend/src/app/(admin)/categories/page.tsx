"use client";
import { useEffect, useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { api, useToast } from "@/components/ui";
import { useSite } from "@/components/site";

type C = { id: string; name: string; slug: string; color: string };
type W = { id: string; name: string };
const COLORS = ["", "orange", "blue", "lime", "pink"];
export default function Categories() {
  const [site, choose] = useSite(); const { toast, el } = useToast(); const [sites, setSites] = useState<W[]>([]); const [rows, setRows] = useState<C[] | null>(null); const [name, setName] = useState("");
  useEffect(() => { api<W[]>("/api/v1/admin/websites").then((w) => { setSites(w); if (!site && w[0]) choose(w[0].id); }); }, []); // eslint-disable-line
  const load = () => site && api<C[]>(`/api/v1/admin/categories?website=${site}`).then(setRows).catch((e) => toast(e.message, true));
  useEffect(() => { setRows(null); load(); }, [site]); // eslint-disable-line
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; try { await api("/api/v1/admin/categories", { method: "POST", body: { websiteId: site, name } }); setName(""); toast("Category added"); load(); } catch (x) { toast((x as Error).message, true); } };
  const patch = async (c: C, body: Partial<C>) => { try { await api(`/api/v1/admin/categories/${c.id}`, { method: "PATCH", body }); toast("Saved"); load(); } catch (x) { toast((x as Error).message, true); } };
  const del = async (c: C) => { if (!confirm(`Delete "${c.name}"? Articles in it will have no category.`)) return; try { await api(`/api/v1/admin/categories/${c.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (x) { toast((x as Error).message, true); } };
  return (<>
    <div className="head"><div><h1>Categories</h1><p>Blog categories and their label colour on the website.</p></div>
      {sites.length > 1 && <select aria-label="Website" value={site} onChange={(e) => choose(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}</div>
    <form className="card narrow row-form" onSubmit={add}><input type="text" aria-label="New category name" placeholder="New category name, e.g. AI Strategy" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn dark" disabled={!site}><Plus size={15} /> Add</button></form>
    <div className="card narrow" style={{ marginTop: 14 }}>{!site ? <p className="mut">Choose a website first.</p> : !rows ? <div className="skel"><div /><div /></div> : !rows.length
      ? <div className="empty-state"><div className="es-ic"><Tags size={28} /></div><h3>No categories yet</h3><p>Add one above.</p></div>
      : rows.map((c) => <div className="row" key={c.id}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className={"cat-dot c-" + (c.color || "none")} aria-hidden />
          <input type="text" aria-label={`Name of ${c.name}`} defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patch(c, { name: e.target.value })} /></div>
        <div className="list-actions"><select aria-label={`Colour of ${c.name}`} value={c.color} onChange={(e) => patch(c, { color: e.target.value })}>{COLORS.map((k) => <option key={k} value={k}>{k ? k[0].toUpperCase() + k.slice(1) : "Automatic"}</option>)}</select>
          <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => del(c)}><Trash2 size={14} /></button></div></div>)}</div>
    {el}</>);
}
