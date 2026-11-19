"use client";
import { useEffect, useState } from "react";
import { History as HistoryIcon, RotateCcw } from "lucide-react";
import { api, fmt } from "./ui";

type V = { id: string; createdAt: string; user?: { name: string } | null; data: Record<string, unknown> };

/** Saved versions of an article or page with one-click restore (restores into the draft; nothing goes live). */
export function History({ entity, id, onRestored, refresh }: { entity: "blog" | "page"; id: string; onRestored: () => void; refresh?: unknown }) {
  const [rows, setRows] = useState<V[] | null>(null); const [open, setOpen] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (!open) return; api<V[]>(`/api/v1/admin/versions?entity=${entity}&id=${id}`).then(setRows).catch((e) => setErr(e.message)); }, [open, entity, id, refresh]);
  const restore = async (v: V) => {
    if (!confirm(`Restore the version from ${fmt(v.createdAt)}? Your current text is saved as a version first, so you can undo this.`)) return;
    try { await api(`/api/v1/admin/versions/${v.id}`, { method: "POST" }); setRows(null); setOpen(false); onRestored(); } catch (e) { setErr((e as Error).message); }
  };
  const label = (v: V) => entity === "blog" ? String(v.data.title ?? "") : `${Object.keys((v.data.draft as object) ?? {}).length} edited fields`;
  return (<div className="card"><button className="hist-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><HistoryIcon size={16} /> <b>Version history</b><span className="mut">{open ? "Hide" : "Show"}</span></button>
    {open && <div style={{ marginTop: 10 }}>{err && <p className="err-text">{err}</p>}
      {!rows ? <p className="mut">Loading…</p> : !rows.length ? <p className="mut">No older versions yet. A copy is kept each time you save changes (the newest 20).</p>
        : rows.map((v) => <div className="row" key={v.id}><div><b>{fmt(v.createdAt)}</b><small>{v.user?.name ?? "Someone"} · {label(v)}</small></div>
          <button className="btn sm" onClick={() => restore(v)}><RotateCcw size={13} /> Restore</button></div>)}</div>}
  </div>);
}

