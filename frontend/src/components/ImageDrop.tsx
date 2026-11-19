"use client";
import { useRef, useState } from "react";
import { ImagePlus, Link2, Images, X } from "lucide-react";
import { api } from "./ui";
import { MediaPicker, uploadImage } from "./MediaPicker";

/** One box for an image: drop a file, paste (Ctrl+V), click to upload, pick from the library, or paste a link. */
export function ImageDrop({ websiteId, value, onChange, label = "Featured image", hint = "Shown on the blog card and at the top of the article", disabled }:
  { websiteId: string; value: string; onChange: (id: string) => void; label?: string; hint?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [over, setOver] = useState(false); const [pick, setPick] = useState(false); const [linkMode, setLinkMode] = useState(false); const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const up = async (f?: File | null) => {
    if (!f || disabled) return; if (!f.type.startsWith("image/")) { setErr("That file is not an image"); return; }
    setBusy("Uploading…"); setErr(""); try { onChange((await uploadImage(f, websiteId)).id); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const importLink = async () => { if (!link.trim()) return; setBusy("Importing…"); setErr(""); try { onChange((await api("/api/v1/admin/media/from-url", { method: "POST", body: { websiteId, url: link.trim() } })).id); setLink(""); setLinkMode(false); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } };
  return (<div className="field">
    <label>{label}</label>
    <div className={"idrop" + (over ? " over" : "") + (value ? " has" : "")} tabIndex={disabled || value ? -1 : 0} role={value ? undefined : "button"} aria-label={value ? undefined : "Add image: click, drop or paste"}
      onClick={() => !value && !disabled && input.current?.click()} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !value) { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); up(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); up(f); } }}>
      {value ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/v1/media/${value}`} alt="" />
        {!disabled && <div className="idrop-tools"><button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); input.current?.click(); }}>Replace</button>
          <button type="button" className="icon-btn" aria-label="Remove image" onClick={(e) => { e.stopPropagation(); onChange(""); }}><X size={14} /></button></div>}</>
      : <div className="idrop-empty">{busy ? <b>{busy}</b> : <><ImagePlus size={26} /><b>Drop an image here, paste it, or click to upload</b><small>{hint}. Big photos are made smaller automatically.</small></>}</div>}
      {busy && value && <div className="idrop-busy">{busy}</div>}
    </div>
    <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => { up(e.target.files?.[0]); e.target.value = ""; }} />
    {!disabled && <div className="idrop-alt">
      <button type="button" className="linkish" onClick={() => setPick(true)}><Images size={14} /> Choose from library</button>
      <button type="button" className="linkish" onClick={() => setLinkMode((x) => !x)}><Link2 size={14} /> Use an image link</button></div>}
    {linkMode && <div className="row-form" style={{ marginTop: 6 }}><input type="text" autoFocus placeholder="https://…/photo.jpg" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); importLink(); } }} /><button type="button" className="btn" disabled={!!busy || !link.trim()} onClick={importLink}>Import</button></div>}
    {err && <p className="err-text" role="alert">{err}</p>}
    {pick && <MediaPicker websiteId={websiteId} onClose={() => setPick(false)} onPick={(m) => { onChange(m.id); setPick(false); }} />}
  </div>);
}
