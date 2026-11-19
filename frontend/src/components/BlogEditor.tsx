"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, Send, Check } from "lucide-react";
import { History } from "@/components/History";
import { api, fmt, Status, useToast } from "@/components/ui";
import { RichEditor } from "@/components/RichEditor";
import { ImageDrop } from "@/components/ImageDrop";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
const empty = { websiteId: "", title: "", slug: "", excerpt: "", content: "", categoryId: "", tags: [] as string[],
  seoTitle: "", metaDescription: "", canonicalUrl: "", robots: "index,follow", ogTitle: "", ogDescription: "",
  featuredImageId: "", ogImageId: "", authorId: "", authorName: "" };
type Site = { id: string; name: string; domain: string };
type Cat = { id: string; name: string; slug: string; color?: string };

/** Fast article editor: title, image, category, text — then one Publish button. Everything else is under "More options" and filled in automatically. */
export function BlogEditor({ id, embedded, onCreated, onBack, onChanged }: { id: string; embedded?: boolean; onCreated?: (id: string) => void; onBack?: () => void; onChanged?: () => void }) {
  const [curId, setCurId] = useState(id); const isNew = curId === "new";
  const [f, setF] = useState({ ...empty }); const [meta, setMeta] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [sites, setSites] = useState<Site[]>([]); const [cats, setCats] = useState<Cat[]>([]); const [me, setMe] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [tagText, setTagText] = useState(""); const [slugEdited, setSlugEdited] = useState(id !== "new");
  const [sched, setSched] = useState(""); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false); const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [more, setMore] = useState(true); const [showPv, setShowPv] = useState(false); const [newCat, setNewCat] = useState<string | null>(null);
  const { toast, el } = useToast(); const titleRef = useRef<HTMLTextAreaElement>(null);
  const set = (p: Partial<typeof empty>) => { setF((x) => ({ ...x, ...p })); setDirty(true); };

  useEffect(() => { (async () => {
    const [s, m, u] = await Promise.all([api<Site[]>("/api/v1/admin/websites"), api("/api/v1/auth/me"), api("/api/v1/admin/users").catch(() => [])]); setSites(s); setMe(m); setAuthors(u);
    if (id === "new") { let pref = ""; try { pref = localStorage.getItem("cms.site") || ""; } catch { /* ignore */ }
      setF((x) => ({ ...x, websiteId: s.find((w) => w.id === pref)?.id ?? s[0]?.id ?? "", authorId: m.user.id })); setTimeout(() => titleRef.current?.focus(), 50); return; }
    try { const b = await api(`/api/v1/admin/blogs/${id}`); setMeta(b);
      setF({ websiteId: b.websiteId, title: b.title, slug: b.slug, excerpt: b.excerpt, content: b.content, categoryId: b.categoryId ?? "",
        tags: b.tagLinks.map((l: { tag: { name: string } }) => l.tag.name), seoTitle: b.seoTitle, metaDescription: b.metaDescription, canonicalUrl: b.canonicalUrl,
        robots: b.robots, ogTitle: b.ogTitle, ogDescription: b.ogDescription, featuredImageId: b.featuredImageId ?? "", ogImageId: b.ogImageId ?? "", authorId: b.authorId ?? "", authorName: b.authorName ?? "" });
    } catch (e) { toast((e as Error).message, true); }
  })(); }, [id]); // eslint-disable-line
  useEffect(() => { if (f.websiteId) api<Cat[]>(`/api/v1/admin/categories?website=${f.websiteId}`).then(setCats).catch(() => setCats([])); }, [f.websiteId]);

  const site = sites.find((x) => x.id === f.websiteId);
  const role = me ? (me.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : me.websiteRoles[f.websiteId]) : null;
  const canPublish = role === "SUPER_ADMIN" || role === "WEBSITE_ADMIN";
  const status: string = meta?.status ?? "DRAFT";
  const locked = !canPublish && (status === "PUBLISHED" || status === "SCHEDULED");

  const save = useCallback(async (quiet = false) => {
    if (!f.title.trim()) { toast("Add a title first", true); titleRef.current?.focus(); return null; }
    setBusy(true);
    try {
      const body = { ...f, categoryId: f.categoryId || null, featuredImageId: f.featuredImageId || null, ogImageId: f.ogImageId || null, authorId: f.authorId || null };
      const b = isNew ? await api("/api/v1/admin/blogs", { method: "POST", body }) : await api(`/api/v1/admin/blogs/${curId}`, { method: "PUT", body });
      setMeta(b); setDirty(false); setSavedAt(new Date());
      setF((x) => ({ ...x, slug: b.slug, excerpt: x.excerpt || b.excerpt, featuredImageId: x.featuredImageId || b.featuredImageId || "" }));
      if (!quiet) toast(status === "PUBLISHED" ? "Live article updated" : "Draft saved");
      if (isNew) { setCurId(b.id); onCreated?.(b.id); } onChanged?.();
      return b;
    } catch (e) { toast((e as Error).message, true); return null; } finally { setBusy(false); }
  }, [f, curId, isNew, status]); // eslint-disable-line

  async function act(action: string, ok: string, extra: object = {}) {
    const b = dirty || isNew ? await save(true) : meta; if (!b) return; setBusy(true);
    try { const u = await api(`/api/v1/admin/blogs/${b.id}/publish`, { method: "POST", body: { action, ...extra } }); setMeta({ ...b, ...u }); toast(ok); onChanged?.(); }
    catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }
  const primary = () => canPublish ? act("publish", status === "PUBLISHED" ? "Live article updated" : "Published — it is on your website now") : act("submit", "Sent for review");

  // Grow the title box to fit long titles (also when an article is first opened).
  useEffect(() => { const t = titleRef.current; if (t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; } }, [f.title]);

  useEffect(() => { // Ctrl+S save · Ctrl+Enter publish · autosave drafts after 5 seconds · warn before leaving unsaved
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!locked) save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (!locked) { if (status === "PUBLISHED") save(); else primary(); } }
    };
    const u = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", k); window.addEventListener("beforeunload", u);
    const t = dirty && !locked && status !== "PUBLISHED" && f.title.trim() ? setTimeout(() => { save(true); }, 5000) : undefined;
  return () => { window.removeEventListener("keydown", k); window.removeEventListener("beforeunload", u); if (t) clearTimeout(t); };
  }); // eslint-disable-line

  // Closing the panel never loses work: unsaved drafts are saved on the way out.
  const exitSave = useRef<() => void>(() => {});
  exitSave.current = () => { if (dirty && !locked && status !== "PUBLISHED" && f.title.trim()) save(true); };
  useEffect(() => () => exitSave.current(), []);
  const addCat = async () => {
    const name = (newCat ?? "").trim(); if (!name) { setNewCat(null); return; }
    try { const c = await api("/api/v1/admin/categories", { method: "POST", body: { websiteId: f.websiteId, name } }); setCats((x) => x.some((y) => y.id === c.id) ? x : [...x, c]); set({ categoryId: c.id }); setNewCat(null); } catch (e) { toast((e as Error).message, true); }
  };
  const addTags = (raw: string) => { const names = raw.split(",").map((s) => s.trim()).filter(Boolean); if (names.length) set({ tags: [...new Set([...f.tags, ...names])] }); setTagText(""); };
  const requestChanges = async () => { const note = window.prompt("What should the writer change? They will see this note."); if (note?.trim()) await act("request_changes", "Sent back to the writer", { note }); };
  const saveLabel = busy ? "Saving…" : dirty ? (status === "PUBLISHED" ? "Unsaved changes" : "Saving soon…") : savedAt ? "Saved" : meta ? `Saved ${fmt(meta.updatedAt)}` : "Not saved yet";
  const primaryLabel = canPublish ? (status === "PUBLISHED" ? "Update live article" : status === "IN_REVIEW" ? "Approve & publish" : "Publish") : status === "IN_REVIEW" ? "Waiting for review" : "Send for review";

  return (<div className={"qe" + (embedded ? " qe--embedded" : "")}>
    <div className="qe-bar" role="toolbar" aria-label="Article actions">
      <div className="qe-bar-l">{!embedded && <button className="btn sm backlink" onClick={onBack}>← All content</button>}
        <Status s={status} /><span className="mut qe-saved" aria-live="polite">{saveLabel}</span></div>
      <div className="qe-bar-r">
        {site?.domain && <button className="btn sm" onClick={() => setShowPv(true)}><Eye size={14} /> Preview</button>}
        {!locked && status !== "PUBLISHED" && <button className="btn sm" disabled={busy || (!dirty && !isNew)} onClick={() => save()}>Save draft</button>}
        {canPublish && status === "IN_REVIEW" && <button className="btn sm" disabled={busy} onClick={requestChanges}>Request changes</button>}
        {canPublish && status === "PUBLISHED" && <button className="btn sm danger" disabled={busy} onClick={() => confirm("Take this article off the website?") && act("unpublish", "Unpublished")}>Unpublish</button>}
        {!locked && <button className="btn orange" disabled={busy || (!canPublish && status === "IN_REVIEW") || (status === "PUBLISHED" && !dirty)} onClick={() => (status === "PUBLISHED" ? save() : primary())} title="Ctrl+Enter">
          {canPublish ? <Check size={15} /> : <Send size={15} />} {primaryLabel}</button>}
      </div>
    </div>
    {meta?.reviewNote && status === "DRAFT" && <div className="note-banner" role="note"><b>Changes requested:</b> {meta.reviewNote}<small>Make the changes, then click Send for review again.</small></div>}
    {locked && <div className="note-banner" role="note">This article is live. Only a Website Admin can change it.</div>}

    <div className="qe-main">
      <textarea ref={titleRef} className="qe-title" rows={1} placeholder="Article title" aria-label="Title" value={f.title} disabled={locked} maxLength={200}
        onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; set({ title: e.target.value, ...(slugEdited ? {} : { slug: slugify(e.target.value) }) }); }} />
      <div className="qe-meta">
        {sites.length > 1 && isNew && <select aria-label="Website" value={f.websiteId} onChange={(e) => set({ websiteId: e.target.value, categoryId: "" })}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <div className="chips" role="radiogroup" aria-label="Category">
          {cats.map((c) => <button key={c.id} type="button" role="radio" aria-checked={f.categoryId === c.id} disabled={locked} className={"chip c-" + (c.color || "none") + (f.categoryId === c.id ? " on" : "")} onClick={() => set({ categoryId: f.categoryId === c.id ? "" : c.id })}>{c.name}</button>)}
          {newCat === null ? <button type="button" className="chip add" disabled={locked || !f.websiteId} onClick={() => setNewCat("")}>+ Category</button>
            : <input className="chip-input" autoFocus aria-label="New category name" placeholder="Name, then Enter" value={newCat} onChange={(e) => setNewCat(e.target.value)} onBlur={addCat} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCat(); } if (e.key === "Escape") setNewCat(null); }} />}
        </div>
      </div>
      <div className="qe-author"><label htmlFor="an">Author</label>
        <input id="an" type="text" list="an-list" value={f.authorName} disabled={locked} maxLength={120}
          placeholder={authors.find((a) => a.id === f.authorId)?.name ?? "Author name"} onChange={(e) => set({ authorName: e.target.value })} />
        <datalist id="an-list">{authors.map((a) => <option key={a.id} value={a.name} />)}</datalist>
        <small>Shown on the website as “By …”. Type any name, e.g. a guest writer.</small></div>
      {f.websiteId && <ImageDrop websiteId={f.websiteId} value={f.featuredImageId} disabled={locked} onChange={(v) => set({ featuredImageId: v })}
        hint="Optional — if empty, the first image in your text is used" />}
      <div className="field"><label>Article text</label>
        {!locked ? <RichEditor value={f.content} websiteId={f.websiteId} onChange={(html) => set({ content: html })} /> : <div className="tt" dangerouslySetInnerHTML={{ __html: f.content }} />}</div>

      <button type="button" className="qe-more" aria-expanded={more} onClick={() => setMore(!more)}><ChevronDown size={16} style={{ transform: more ? "rotate(180deg)" : "none" }} /> More options <span className="mut">address, summary, tags, Google &amp; sharing, schedule, history</span></button>
      {more && <div className="qe-more-body">
        <div className="grid2">
          <div className="field"><label htmlFor="s">Web address</label><input id="s" type="text" value={f.slug} disabled={locked} onChange={(e) => { setSlugEdited(true); set({ slug: slugify(e.target.value) }); }} /><small>…/article.html?slug={f.slug || "your-article"}</small></div>
          <div className="field"><label htmlFor="ac">Written by (account)</label><select id="ac" value={f.authorId} disabled={locked} onChange={(e) => set({ authorId: e.target.value })}><option value="">Nobody</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><small>Who owns this article in the CMS.</small></div>
        </div>
        <div className="field"><label htmlFor="x">Short summary</label><textarea id="x" rows={2} value={f.excerpt} disabled={locked} maxLength={500} placeholder="Leave empty to use the first lines of the article" onChange={(e) => set({ excerpt: e.target.value })} /><small>Shown on the blog card.</small></div>
        <div className="field"><label htmlFor="tg">Tags</label><input id="tg" type="text" value={tagText} disabled={locked} placeholder="Type a tag, press Enter" onChange={(e) => setTagText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTags(tagText); } }} onBlur={() => addTags(tagText)} />
          {f.tags.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{f.tags.map((t) => <span key={t} className="chip on">{t} <button type="button" aria-label={`Remove ${t}`} className="chip-x" onClick={() => set({ tags: f.tags.filter((x) => x !== t) })}>×</button></span>)}</div>}</div>
        <div className="grid2">
          <div className="field"><label htmlFor="st">Google title</label><input id="st" type="text" value={f.seoTitle} disabled={locked} placeholder="Empty = article title" onChange={(e) => set({ seoTitle: e.target.value })} /></div>
          <div className="field"><label htmlFor="md">Google description</label><input id="md" type="text" value={f.metaDescription} disabled={locked} placeholder="Empty = short summary" onChange={(e) => set({ metaDescription: e.target.value })} /></div>
        </div>
        {f.websiteId && <ImageDrop websiteId={f.websiteId} value={f.ogImageId} disabled={locked} onChange={(v) => set({ ogImageId: v })} label="Social share image" hint="Optional — if empty, the featured image is used" />}
        {canPublish && status !== "PUBLISHED" && <div className="field"><label htmlFor="sc">Publish later</label><div className="row-form">
          <input id="sc" type="datetime-local" value={sched} onChange={(e) => setSched(e.target.value)} />
          <button className="btn" disabled={busy || !sched} onClick={() => act("schedule", "Scheduled", { scheduledAt: new Date(sched).toISOString() })}>Schedule</button></div>
          {meta?.scheduledAt && status === "SCHEDULED" && <small>Goes live {fmt(meta.scheduledAt)}</small>}</div>}
        {!isNew && <History entity="blog" id={curId} onRestored={() => { toast("Older version restored as the draft"); location.reload(); }} />}
      </div>}
    </div>
    {showPv && site?.domain && <BlogPreview base={site.domain.replace(/\/$/, "")} onClose={() => setShowPv(false)} article={{
      title: f.title, slug: f.slug, excerpt: f.excerpt, content: f.content, publishedAt: meta?.publishedAt || new Date().toISOString(),
      category: (() => { const c = cats.find((x) => x.id === f.categoryId); return c ? { name: c.name, slug: c.slug } : null; })(),
      author: f.authorName.trim() || (authors.find((a) => a.id === f.authorId)?.name ?? null),
      featuredImage: f.featuredImageId ? { url: window.location.origin + `/api/v1/media/${f.featuredImageId}`, alt: f.title } : null,
      seo: { title: f.seoTitle || f.title, description: f.metaDescription || f.excerpt } }} />}
    {el}
  </div>);
}

/** The article shown inside the real Elanster website design (the site's own article page), updating as you type. */
function BlogPreview({ base, article, onClose }: { base: string; article: object; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null); const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false); const [mode, setMode] = useState<"desktop" | "tablet" | "phone">("desktop"); const [w, setW] = useState(900); const [h, setH] = useState(600);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => { setW(el.clientWidth); setH(el.clientHeight); }); ro.observe(el); setW(el.clientWidth); setH(el.clientHeight); return () => ro.disconnect(); }, []);
  useEffect(() => { const on = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.source === "elanster-site" && e.data.type === "ready") setReady(true); }; window.addEventListener("message", on); return () => window.removeEventListener("message", on); }, []);
  useEffect(() => { if (ready) frame.current?.contentWindow?.postMessage({ source: "elanster-cms", type: "article", article }, "*"); }, [ready, article]);
  const width = mode === "desktop" ? 1280 : mode === "tablet" ? 820 : 390; const scale = Math.min(1, w / width);
  return (<div className="modal" onClick={onClose}><div style={{ width: "min(1240px,100%)", height: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div className="seg">{(["desktop", "tablet", "phone"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setReady(false); }}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
      <button className="btn" onClick={onClose}>Close preview</button></div>
    <div ref={box} style={{ flex: 1, minHeight: 0, overflow: "hidden", borderRadius: 18, background: "#fff", display: "flex", justifyContent: "center" }}>
      <iframe ref={frame} key={mode} title="Article preview in the website design" src={`${base}/article.html?cms-preview=1`} onLoad={() => setReady(false)}
        style={{ width, height: Math.round(h / scale), border: 0, transform: `scale(${scale})`, transformOrigin: "top center", flex: "none", background: "#fff" }} />
    </div></div></div>);
}
