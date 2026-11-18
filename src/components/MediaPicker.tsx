"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./ui";

export type MediaItem = { id: string; url: string; originalName: string; altText: string; size: number };

export async function uploadImage(file: File, websiteId: string, alt = ""): Promise<MediaItem> {
  const fd = new FormData(); fd.append("file", file); fd.append("websiteId", websiteId); fd.append("alt", alt);
  const r = await fetch("/api/v1/admin/media", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Upload failed");
  return j;
}

/** Pop-up to choose an image from the Media Library or upload a new one. */
export function MediaPicker({ websiteId, onPick, onClose }: { websiteId: string; onPick: (m: MediaItem) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = () => api(`/api/v1/admin/media?website=${websiteId}`).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [websiteId]); // eslint-disable-line
  const [link, setLink] = useState("");
  const importLink = async () => {
    const url = link.trim(); if (!url) return; setBusy(true); setErr("");
    try { const m = await api("/api/v1/admin/media/from-url", { method: "POST", body: { websiteId, url } }); onPick(m); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const up = async (f?: File) => { if (!f) return; setBusy(true); setErr(""); try { const m = await uploadImage(f, websiteId); onPick(m); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (<div className="modal" onClick={onClose}><div style={{ width: "min(820px,100%)" }} onClick={(e) => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ margin: 0 }}>Choose an image</h2>
      <div><input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => { up(e.target.files?.[0]); e.target.value = ""; }} />
        <button className="btn orange" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload new"}</button>{" "}<button className="btn" onClick={onClose}>Close</button></div></div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <input type="text" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") importLink(); }} placeholder="Or paste an image link (https://…) and press Import" style={{ flex: 1 }} />
      <button className="btn" disabled={busy || !link.trim()} onClick={importLink}>{busy ? "Importing…" : "Import"}</button>
    </div>
    {err && <p className="err-text">{err}</p>}
    {!items ? <p>Loading…</p> : !items.length ? <div className="empty">No images yet. Click <b>Upload new</b>. PNG, JPG, WebP, GIF or AVIF, up to 3.5 MB.</div> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
        {items.map((m) => <button key={m.id} type="button" onClick={() => onPick(m)} style={{ border: 0, background: "var(--panel)", borderRadius: 16, padding: 6, cursor: "pointer", textAlign: "left" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt={m.altText || m.originalName} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12, display: "block" }} />
          <small style={{ display: "block", padding: "4px 4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.originalName}</small></button>)}
      </div>}
  </div></div>);
}
