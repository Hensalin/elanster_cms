"use client";
import { History } from "@/components/History";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, fmt, Status, useToast } from "@/components/ui";
import { MediaPicker } from "@/components/MediaPicker";

type Field = { key: string; label: string; group: string; tag: string; text: string };

/** A plain name for each kind of text, instead of HTML tag names. */
function kindLabel(f: Field) {
  if (f.tag.startsWith("seo") || (f.tag === "image" && f.label?.startsWith("Image"))) return f.label;
  const k: Record<string, string> = { link: "Button link", image: "Image", alt: "Image description", a: "Link", button: "Button", li: "List item", label: "Label",
    blockquote: "Quote", q: "Quote", figcaption: "Caption", summary: "Question", dt: "Term", dd: "Description", th: "Table heading", td: "Table cell" };
  return /^h[1-6]$/.test(f.tag) ? (f.tag === "h1" ? "Main heading" : "Heading") : k[f.tag] ?? "Text";
}
const MSG: Record<string, string> = { submit: "Sent for review. An admin will publish it or send it back.", withdraw: "Taken back. You can edit again.",
  request_changes: "Sent back to the editor with your note.", discard: "Changes discarded", unpublish: "Unpublished. The website shows its original text." };

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
  const [editedOnly, setEditedOnly] = useState<boolean | null>(null);
  const [ask, setAsk] = useState(false); const [note, setNote] = useState("");   // "Request changes" note box
  const canPub: boolean = !!page?.canPublish; const rv: { state: string; note: string; by: string | null; byMe: boolean; at: string | null } = page?.review ?? { state: "", note: "", by: null, byMe: false, at: null };
  const locked = !canPub && rv.state === "WAITING";   // an editor's page is read-only while it waits for review

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
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canPub) { e.preventDefault(); pubRef.current(); } };
    const t = dirty && !locked ? setTimeout(() => saveRef.current(true), 5000) : undefined;
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
  const act = async (action: "publish" | "unpublish" | "discard" | "submit" | "withdraw" | "request_changes", note?: string) => {
    if (action === "discard" && !confirm("Throw away all unpublished changes on this page? This cannot be undone.")) return;
    setBusy(true);
    try {
      // Publishing or sending for review first saves what is on screen, so nothing typed is lost.
      if ((action === "publish" || action === "submit") && !locked) await api(`/api/v1/admin/pages/${id}`, { method: "PUT", body: { draft: changedMap() } });
      await api(`/api/v1/admin/pages/${id}/publish`, { method: "POST", body: { action, ...(note ? { note } : {}) } });
      if (action !== "publish") { toast(MSG[action]); setAsk(false); setNote(""); await load(); return; }
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

  if (!page) return <div className="skel" aria-busy="true"><div /><div /><div /></div>;
  const base = (page.website?.domain || "").replace(/\/$/, "");
  const src = base ? `${base}/${page.file || "index.html"}?cms-edit=1` : "";
  const isEdited = (f: Field) => (vals[f.key] ?? f.text) !== f.text;
  const onlyEdited = editedOnly ?? (canPub && rv.state === "WAITING");   // a reviewer starts with just the changed texts
  const shown = fields.filter((f) => (!onlyEdited || isEdited(f)) && (!q || (f.text + " " + (vals[f.key] ?? "")).toLowerCase().includes(q.toLowerCase())));
  const groups = [...new Set(shown.map((f) => f.group))];
  const nEdited = Object.keys(changedMap()).length;
  const savedDraft: Record<string, string> = page.draft ?? {}; const cur = changedMap();
  const unsaved = new Set([...Object.keys(cur), ...Object.keys(savedDraft)].filter((k) => cur[k] !== savedDraft[k])).size;

  return (<>
    <div className="head"><div><Link href="/content" className="backlink" style={{ fontSize: 13 }}>← All content</Link>
      <h1>{page.title} {rv.state === "WAITING" ? <span className="badge IN_REVIEW">Waiting for review</span> : rv.state === "CHANGES" ? <span className="badge UNPUBLISHED">Changes requested</span> : <Status s={page.status} />}</h1>
      <p>{page.website?.name} · {nEdited} edited text{nEdited === 1 ? "" : "s"}{page.unpublished && !dirty ? " · not live yet" : ""}{dirty ? ` · ${unsaved} unsaved` : ""}</p></div>
      <div className="head-actions">
        {!locked && <><button className="btn" disabled={!past.current.length} onClick={undo} title="Undo">↶ Undo</button>
        <button className="btn" disabled={!future.current.length} onClick={redo} title="Redo">↷ Redo</button></>}
        {!locked && <button className="btn" disabled={busy || !dirty} onClick={() => save()} title="Ctrl+S">Save draft{dirty && unsaved ? <span className="btn-count">{unsaved}</span> : null}</button>}
        {canPub ? <>
          <button className="btn orange" disabled={busy || (!dirty && !page.unpublished && page.status === "PUBLISHED")} onClick={() => act("publish")} title="Ctrl+Enter">{rv.state === "WAITING" ? "Approve & publish" : "Publish"}</button>
          {rv.state === "WAITING" && <button className="btn" disabled={busy} onClick={() => setAsk(true)}>Request changes</button>}
          <button className="btn" disabled={busy || (!dirty && !page.unpublished)} onClick={() => (dirty ? load() : act("discard"))}>Discard changes</button>
          {page.status === "PUBLISHED" && rv.state !== "WAITING" && <button className="btn danger" disabled={busy} onClick={() => act("unpublish")}>Unpublish</button>}
        </> : locked ? <>{rv.byMe && <button className="btn" disabled={busy} onClick={() => act("withdraw")}>Take back to edit</button>}</>
        : <>
          <button className="btn orange" disabled={busy || (!dirty && !page.unpublished)} onClick={() => act("submit")}>Send for review</button>
          <button className="btn" disabled={busy || (!dirty && !page.unpublished)} onClick={() => (dirty ? load() : act("discard"))}>Discard changes</button>
        </>}
      </div></div>
    {rv.state === "WAITING" && <div className="note-banner" role="note">
      {canPub ? <><b>{rv.by ?? "An editor"} sent these changes for review{rv.at ? ` on ${fmt(rv.at)}` : ""}.</b> Check them in the preview, then approve and publish, or ask for changes.</>
        : <><b>Waiting for review.</b> {rv.byMe ? "You" : rv.by ?? "Someone"} sent these changes{rv.at ? ` on ${fmt(rv.at)}` : ""}. The texts are locked until an admin publishes them or sends them back.</>}</div>}
    {rv.state === "CHANGES" && <div className="note-banner" role="note"><b>Changes requested:</b> {rv.note} {!canPub && <span className="mut">Edit the texts, then send for review again.</span>}</div>}
    {ask && <div className="modal" onClick={() => setAsk(false)}><div onClick={(e) => e.stopPropagation()}>
      <h2>Request changes</h2><p className="mut">Tell {rv.by ?? "the editor"} what to change. They see this note on the page and in their notifications.</p>
      <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: shorten the heading and fix the service time." style={{ width: "100%" }} autoFocus />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}><button className="btn" onClick={() => setAsk(false)}>Cancel</button>
        <button className="btn dark" disabled={busy || !note.trim()} onClick={() => act("request_changes", note.trim())}>Send back</button></div></div></div>}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,380px) minmax(0,1fr)", gap: 16, alignItems: "start" }} className="pe">
      <div className="card" style={{ padding: 14, maxHeight: "calc(100vh - 150px)", overflow: "auto", position: "sticky", top: 12 }}>
        <input type="search" placeholder="Find text…" aria-label="Find text" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <div className="seg seg-sm" role="tablist" aria-label="Which texts" style={{ marginBottom: 12 }}>
          <button className={!onlyEdited ? "on" : ""} onClick={() => setEditedOnly(false)}>All texts <small>{fields.length}</small></button>
          <button className={onlyEdited ? "on" : ""} onClick={() => setEditedOnly(true)}>Edited <small>{nEdited}</small></button></div>
        {groups.map((g, gi) => (
          <details key={g} open={!!q || gi === 0 || groups.length < 3 || fields.some((f) => f.group === g && f.key === active)} style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, padding: "6px 0" }}>{g} <small style={{ color: "var(--muted)", fontWeight: 400 }}>({shown.filter((f) => f.group === g).length})</small></summary>
            {shown.filter((f) => f.group === g).map((f) => {
              const changed = valueOf(f.key) !== f.text;
              return (<div key={f.key} id={"f-" + f.key} className="field" style={{ outline: active === f.key ? "2px solid var(--dark)" : "none", borderRadius: 10, padding: active === f.key ? 6 : 0 }}>
                <label htmlFor={"i-" + f.key}>{kindLabel(f)}{changed && <span style={{ color: "var(--amber)", marginLeft: 6, fontWeight: 500 }}>edited</span>}</label>
                {f.tag === "image" ? (<div style={{ display: "grid", gap: 6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={/^(https?:)?\/\//.test(valueOf(f.key)) || valueOf(f.key).startsWith("/") ? valueOf(f.key) : `${base}/${valueOf(f.key)}`} alt="" style={{ width: "100%", maxHeight: 130, objectFit: "contain", background: "var(--panel)", borderRadius: 12 }} />
                  <div style={{ display: "flex", gap: 6 }}><button type="button" className="btn sm" disabled={locked} onClick={() => { setActive(f.key); setPickKey(f.key); }}>Choose image</button></div></div>)
                : f.tag === "link" || f.tag === "alt" ? <input id={"i-" + f.key} type="text" value={valueOf(f.key)} onFocus={() => { setActive(f.key); send({ type: "focus", key: f.key }); }} onChange={(e) => setVal(f.key, e.target.value)} readOnly={locked} placeholder={f.tag === "link" ? "https://… or page.html" : ""} />
                : <textarea id={"i-" + f.key} rows={Math.min(8, Math.max(1, Math.ceil(valueOf(f.key).length / 38)))} value={valueOf(f.key)}
                  onFocus={() => { setActive(f.key); send({ type: "focus", key: f.key }); }} onChange={(e) => setVal(f.key, e.target.value)} readOnly={locked} style={{ width: "100%", resize: "vertical" }} />}
                {changed && !locked && <small><button type="button" className="btn sm" onClick={() => setVal(f.key, f.text)}>Reset to original</button></small>}
              </div>);
            })}
          </details>))}
        {!groups.length && <p style={{ color: "var(--muted)" }}>{onlyEdited && !q ? "No texts edited yet. Switch to All texts, or click a text in the preview." : "No text matches."}</p>}
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
    <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Tip: click any text in the preview to jump to it on the left. Changes show in the preview straight away{canPub ? <>, but only go live on your website after you press <b>Publish</b>.</> : <>. When you are done, press <b>Send for review</b> and an admin publishes them.</>}</p>
    <div style={{ marginTop: 14 }}><History entity="page" id={page.id} onRestored={() => { toast("Older draft restored. Publish to make it live."); load(); }} /></div>
    {pickKey && <MediaPicker websiteId={page.websiteId} onClose={() => setPickKey(null)} onPick={(m) => { setVal(pickKey, m.url); setPickKey(null); }} />}
    {el}
  </>);
}
