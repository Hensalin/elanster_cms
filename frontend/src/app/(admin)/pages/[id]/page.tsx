"use client";
import { History } from "@/components/History";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Status, useToast } from "@/components/ui";
import { MediaPicker } from "@/components/MediaPicker";

type Field = { key: string; label: string; group: string; tag: string; text: string };

export default function PageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [page, setPage] = useState<any>(null);
  const [vals, setVals] = useState<Record<string, string>>({});   // current text per key (draft over published over original)
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState(""); const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null); const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const past = useRef<Record<string, string>[]>([]); const future = useRef<Record<string, string>[]>([]); const lastEdit = useRef({ key: "", at: 0 });
  const [pickKey, setPickKey] = useState<string | null>(null); const [, bump] = useState(0); const [boxW, setBoxW] = useState(800); const [boxH, setBoxH] = useState(640); const { toast, el } = useToast();

  const load = useCallback(async () => {
    try {
      const p = await api(`/api/v1/admin/pages/${id}`); setPage(p);
      setVals({ ...p.published, ...p.draft }); setDirty(false);
    } catch (e) { toast((e as Error).message, true); }
  }, [id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!page) return;
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => { setBoxW(el.clientWidth); setBoxH(el.clientHeight); }); ro.observe(el);
    setBoxW(el.clientWidth); setBoxH(el.clientHeight); return () => ro.disconnect();
  }, [!!page]); // eslint-disable-line
  const fields: Field[] = page?.fields ?? [];
  const orig = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f.text])), [fields]);
  const valueOf = (k: string) => vals[k] ?? orig[k] ?? "";
  const changedMap = () => Object.fromEntries(Object.entries(vals).filter(([k, v]) => k in orig && v !== orig[k]));

  // live preview: tell the page inside the frame what to show
  const send = useCallback((msg: object) => frame.current?.contentWindow?.postMessage({ source: "elanster-cms", ...msg }, "*"), []);
  useEffect(() => { if (ready) send({ type: "values", original: orig, values: Object.fromEntries(fields.map((f) => [f.key, valueOf(f.key)])) }); }, [ready, vals, page]); // eslint-disable-line
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.source !== "elanster-site") return;
      if (e.data.type === "ready") setReady(true);
      if (e.data.type === "select") { setActive(e.data.key); setTimeout(() => document.getElementById("f-" + e.data.key)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30); }
    };
    window.addEventListener("message", on); return () => window.removeEventListener("message", on);
  }, []);

  useEffect(() => { // Ctrl+S saves the draft, Ctrl+Enter publishes; drafts autosave after 5 seconds; warn before leaving with unsaved changes
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) saveRef.current(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); pubRef.current(); } };
    const t = dirty ? setTimeout(() => saveRef.current(true), 5000) : undefined;
    const u = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", k); window.addEventListener("beforeunload", u);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("beforeunload", u); if (t) clearTimeout(t); };
  }, [dirty, vals]); // eslint-disable-line
  const saveRef = useRef<(quiet?: boolean) => void>(() => {}); const pubRef = useRef<() => void>(() => {});
  const setVal = (k: string, v: string) => {
    const now = Date.now();
    if (lastEdit.current.key !== k || now - lastEdit.current.at > 1200) { past.current.push(vals); if (past.current.length > 100) past.current.shift(); }
    lastEdit.current = { key: k, at: now }; future.current = [];
    setVals((o) => ({ ...o, [k]: v })); setDirty(true); bump((n) => n + 1);
  };
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(vals); setVals(p); setDirty(true); lastEdit.current = { key: "", at: 0 }; bump((n) => n + 1); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(vals); setVals(f); setDirty(true); lastEdit.current = { key: "", at: 0 }; bump((n) => n + 1); };
  saveRef.current = (quiet?: boolean) => { save(quiet); }; pubRef.current = () => { act("publish"); };
  const save = async (quiet?: boolean) => {
    setBusy(true);
    try { const r = await api(`/api/v1/admin/pages/${id}`, { method: "PUT", body: { draft: changedMap() } });
      if (!quiet) { toast("Draft saved. The live website is not changed yet."); await load(); } else { setDirty(false); setPage((p: any) => p && { ...p, unpublished: r.unpublished }); } } // eslint-disable-line @typescript-eslint/no-explicit-any
    catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  const act = async (action: "publish" | "unpublish" | "discard") => {
    if (action === "discard" && !confirm("Throw away all unpublished changes on this page?")) return;
    setBusy(true);
    try {
      if (action === "publish") await api(`/api/v1/admin/pages/${id}`, { method: "PUT", body: { draft: changedMap() } });
      await api(`/api/v1/admin/pages/${id}/publish`, { method: "POST", body: { action } });
      if (action === "publish") { // connection check runs in the background, so publishing feels instant
        api(`/api/v1/admin/websites/${page.websiteId}/check`).then((c: { ok: boolean; label: string }[]) => {
          const bad = c.filter((x) => !x.ok && !/published/.test(x.label));
          if (bad.length) toast(`Published in the CMS, but the live website is not connected (${bad[0].label}). Open Website connection.`, true);
        }).catch(() => {});
      }
      toast(action === "publish" ? "Published. It is now live on the website." : action === "unpublish" ? "Unpublished. The website shows its original text." : "Changes discarded");
      await load();
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };

  if (!page) return <p>Loading…</p>;
  const base = (page.website?.domain || "").replace(/\/$/, "");
  const src = base ? `${base}/${page.file || "index.html"}?cms-edit=1` : "";
  const shown = fields.filter((f) => !q || (f.text + " " + (vals[f.key] ?? "")).toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((f) => f.group))];
  const nEdited = Object.keys(changedMap()).length;

  return (<>
    <div className="head"><div><Link href="/content" className="backlink" style={{ fontSize: 13 }}>← All content</Link><h1>{page.title} <Status s={page.status} /></h1>
      <p>{page.website?.name} · {nEdited} edited text{nEdited === 1 ? "" : "s"}{page.unpublished && !dirty ? " · has unpublished changes" : ""}{dirty ? " · not saved yet" : ""}</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={!past.current.length} onClick={undo} title="Undo">↶ Undo</button>
        <button className="btn" disabled={!future.current.length} onClick={redo} title="Redo">↷ Redo</button>
        <button className="btn" disabled={busy || !dirty} onClick={() => save()}>Save draft</button>
        <button className="btn orange" disabled={busy || (!dirty && !page.unpublished && page.status === "PUBLISHED")} onClick={() => act("publish")} title="Ctrl+Enter">Publish</button>
        <button className="btn" disabled={busy || (!dirty && !page.unpublished)} onClick={() => (dirty ? load() : act("discard"))}>Discard changes</button>
        {page.status === "PUBLISHED" && <button className="btn danger" disabled={busy} onClick={() => act("unpublish")}>Unpublish</button>}
      </div></div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,380px) minmax(0,1fr)", gap: 16, alignItems: "start" }} className="pe">
      <div className="card" style={{ padding: 14, maxHeight: "calc(100vh - 150px)", overflow: "auto", position: "sticky", top: 12 }}>
        <input type="search" placeholder="Find text…" aria-label="Find text" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
        {groups.map((g, gi) => (
          <details key={g} open={!!q || gi === 0 || groups.length < 3 || fields.some((f) => f.group === g && f.key === active)} style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, textTransform: "capitalize", padding: "6px 0" }}>{g} <small style={{ color: "var(--muted)", fontWeight: 400 }}>({shown.filter((f) => f.group === g).length})</small></summary>
            {shown.filter((f) => f.group === g).map((f) => {
              const changed = valueOf(f.key) !== f.text;
              return (<div key={f.key} id={"f-" + f.key} className="field" style={{ outline: active === f.key ? "2px solid var(--dark)" : "none", borderRadius: 10, padding: active === f.key ? 6 : 0 }}>
                <label htmlFor={"i-" + f.key}>{f.tag.startsWith("seo") ? f.label : f.tag === "link" ? "BUTTON LINK" : f.tag === "image" ? "IMAGE" : f.tag === "alt" ? "IMAGE DESCRIPTION (ALT)" : f.tag.toUpperCase()}{changed && <span style={{ color: "var(--amber)", marginLeft: 6, fontWeight: 500 }}>edited</span>}</label>
                {f.tag === "image" ? (<div style={{ display: "grid", gap: 6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={/^(https?:)?\/\//.test(valueOf(f.key)) || valueOf(f.key).startsWith("/") ? valueOf(f.key) : `${base}/${valueOf(f.key)}`} alt="" style={{ width: "100%", maxHeight: 130, objectFit: "contain", background: "var(--panel)", borderRadius: 12 }} />
                  <div style={{ display: "flex", gap: 6 }}><button type="button" className="btn sm" onClick={() => { setActive(f.key); setPickKey(f.key); }}>Choose image</button></div></div>)
                : f.tag === "link" || f.tag === "alt" ? <input id={"i-" + f.key} type="text" value={valueOf(f.key)} onFocus={() => { setActive(f.key); send({ type: "focus", key: f.key }); }} onChange={(e) => setVal(f.key, e.target.value)} placeholder={f.tag === "link" ? "https://… or page.html" : ""} />
                : <textarea id={"i-" + f.key} rows={Math.min(8, Math.max(1, Math.ceil(valueOf(f.key).length / 38)))} value={valueOf(f.key)}
                  onFocus={() => { setActive(f.key); send({ type: "focus", key: f.key }); }} onChange={(e) => setVal(f.key, e.target.value)} style={{ width: "100%", resize: "vertical" }} />}
                {changed && <small><button type="button" className="btn sm" onClick={() => setVal(f.key, f.text)}>Reset to original</button></small>}
              </div>);
            })}
          </details>))}
        {!groups.length && <p style={{ color: "var(--muted)" }}>No text matches.</p>}
      </div>
      <div className="card" style={{ padding: 12, minHeight: 400, minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <div className="seg" role="tablist" aria-label="Preview size"><button className={mode === "desktop" ? "on" : ""} onClick={() => setMode("desktop")}>Desktop</button><button className={mode === "tablet" ? "on" : ""} onClick={() => setMode("tablet")}>Tablet</button><button className={mode === "mobile" ? "on" : ""} onClick={() => setMode("mobile")}>Phone</button></div>
          {base && <a className="btn sm" href={base + "/" + (page.file || "index.html")} target="_blank" rel="noopener">Open live page ↗</a>}
        </div>
        {src ? (() => {
          const w = mode === "desktop" ? 1280 : mode === "tablet" ? 820 : 390; const scale = Math.min(1, boxW / w); const h = Math.round(boxH / scale);
          return (<div ref={box} style={{ height: "calc(100vh - 270px)", minHeight: 360, overflow: "hidden", borderRadius: 18, background: "#fff", display: "flex", justifyContent: "center" }}>
            <iframe ref={frame} key={mode} src={src} title="Live preview of the page" onLoad={() => setReady(false)}
              style={{ width: w, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: "top center", flex: "none", background: "#fff" }} />
          </div>);
        })() : <div className="empty">Connect this website on the <Link href="/pages">Pages</Link> screen to see a live preview here.</div>}
      </div>
    </div>
    <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Tip: click any text in the preview to jump to it on the left. Changes show in the preview straight away, but only go live on your website after you press <b>Publish</b>.</p>
    <div style={{ marginTop: 14 }}><History entity="page" id={page.id} onRestored={() => { toast("Older draft restored. Publish to make it live."); load(); }} /></div>
    {pickKey && <MediaPicker websiteId={page.websiteId} onClose={() => setPickKey(null)} onPick={(m) => { setVal(pickKey, m.url); setPickKey(null); }} />}
    {el}
  </>);
}
