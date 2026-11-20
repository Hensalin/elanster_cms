"use client";
import { copyText } from "@/lib/clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useToast } from "@/components/ui";
import { uploadImage, type MediaItem } from "@/components/MediaPicker";

export default function Media() {
  const [sites, setSites] = useState<any[]>([]); const [site, setSite] = useState("");
  const [items, setItems] = useState<MediaItem[] | null>(null); const [busy, setBusy] = useState(false);
  const { toast, el } = useToast(); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { api("/api/v1/admin/websites").then((s) => { setSites(s); setSite(s[0]?.id ?? ""); }); }, []);
  const load = useCallback(() => { if (site) api(`/api/v1/admin/media?website=${site}`).then(setItems).catch((e) => toast(e.message, true)); }, [site]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const up = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try { for (const f of Array.from(files)) await uploadImage(f, site); toast("Uploaded"); load(); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  const alt = async (m: MediaItem) => { const a = prompt("Describe this image (alt text, helps Google and screen readers)", m.altText); if (a === null) return;
    try { await api(`/api/v1/admin/media/${m.id}`, { method: "PUT", body: { altText: a } }); load(); } catch (e) { toast((e as Error).message, true); } };
  const del = async (m: MediaItem) => { if (!confirm("Delete this image? Pages using it will show a broken image.")) return;
    try { await api(`/api/v1/admin/media/${m.id}`, { method: "DELETE" }); load(); } catch (e) { toast((e as Error).message, true); } };
  return (<>
    <div className="head"><div><h1>Media Library</h1><p>Images you upload here can be used on pages and in blog articles.</p></div>
      <div><input ref={input} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => { up(e.target.files); e.target.value = ""; }} />
        <button className="btn orange" disabled={busy || !site} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload images"}</button></div></div>
    <div className="toolbar"><select aria-label="Website" value={site} onChange={(e) => setSite(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    {!items ? <p>Loading…</p> : !items.length ? <div className="empty">No images yet. Click <b>Upload images</b>. Allowed: PNG, JPG, WebP, GIF, AVIF up to 3.5 MB.</div> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
        {items.map((m) => <div key={m.id} className="card" style={{ padding: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt={m.altText || m.originalName} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 16, display: "block" }} />
          <p style={{ margin: "8px 4px 2px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.originalName}</p>
          <small style={{ color: "var(--muted)", margin: "0 4px", display: "block" }}>{Math.round(m.size / 1024)} KB · {m.altText ? "has alt text" : "no alt text"}</small>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn sm" onClick={async () => { (await copyText(new URL(m.url, location.origin).href)) ? toast("Link copied") : toast("Could not copy the link", true); }}>Copy link</button>
            <button className="btn sm" onClick={() => alt(m)}>Alt text</button><button className="btn sm danger" onClick={() => del(m)}>Delete</button></div></div>)}
      </div>}
    {el}
  </>);
}
