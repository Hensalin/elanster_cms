"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmt, Status, useToast } from "@/components/ui";
import { RichEditor } from "@/components/RichEditor";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
const empty = { websiteId: "", title: "", slug: "", excerpt: "", content: "", categoryId: "", tags: [] as string[],
  seoTitle: "", metaDescription: "", canonicalUrl: "", robots: "index,follow", ogTitle: "", ogDescription: "" };

export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const isNew = id === "new"; const router = useRouter();
  const [f, setF] = useState({ ...empty }); const [meta, setMeta] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]); const [me, setMe] = useState<any>(null);
  const [tagText, setTagText] = useState(""); const [slugEdited, setSlugEdited] = useState(!isNew);
  const [sched, setSched] = useState(""); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const { toast, el } = useToast(); const loaded = useRef(false);
  const set = (p: Partial<typeof empty>) => { setF((x) => ({ ...x, ...p })); setDirty(true); };

  useEffect(() => { (async () => {
    const [s, m] = await Promise.all([api("/api/v1/admin/websites"), api("/api/v1/auth/me")]); setSites(s); setMe(m);
    if (isNew) { setF((x) => ({ ...x, websiteId: s[0]?.id ?? "" })); loaded.current = true; return; }
    try { const b = await api(`/api/v1/admin/blogs/${id}`); setMeta(b);
      setF({ websiteId: b.websiteId, title: b.title, slug: b.slug, excerpt: b.excerpt, content: b.content, categoryId: b.categoryId ?? "",
        tags: b.tagLinks.map((l: any) => l.tag.name), seoTitle: b.seoTitle, metaDescription: b.metaDescription, canonicalUrl: b.canonicalUrl,
        robots: b.robots, ogTitle: b.ogTitle, ogDescription: b.ogDescription }); loaded.current = true;
    } catch (e) { toast((e as Error).message, true); }
  })(); }, [id]); // eslint-disable-line
  useEffect(() => { if (f.websiteId) api(`/api/v1/admin/categories?website=${f.websiteId}`).then(setCats).catch(() => setCats([])); }, [f.websiteId]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);

  const role = me ? (me.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : me.websiteRoles[f.websiteId]) : null;
  const canPublish = role === "SUPER_ADMIN" || role === "WEBSITE_ADMIN";
  const status: string = meta?.status ?? "DRAFT";
  const locked = !canPublish && (status === "PUBLISHED" || status === "SCHEDULED"); // editors cannot touch live content

  const save = useCallback(async (quiet = false) => {
    if (!f.title.trim()) { toast("Add a title first", true); return null; }
    setBusy(true);
    try {
      const body = { ...f, categoryId: f.categoryId || null };
      const b = isNew ? await api("/api/v1/admin/blogs", { method: "POST", body }) : await api(`/api/v1/admin/blogs/${id}`, { method: "PUT", body });
      setMeta(b); setDirty(false); setF((x) => ({ ...x, slug: b.slug }));
      if (!quiet) toast(status === "PUBLISHED" ? "Published article updated" : "Draft saved");
      if (isNew) router.replace(`/blogs/${b.id}`);
      return b;
    } catch (e) { toast((e as Error).message, true); return null; } finally { setBusy(false); }
  }, [f, id, isNew, status]); // eslint-disable-line

  async function act(action: string, ok: string, extra: object = {}) {
    const b = await save(true); if (!b) return; setBusy(true);
    try { const u = await api(`/api/v1/admin/blogs/${b.id}/publish`, { method: "POST", body: { action, ...extra } }); setMeta({ ...b, ...u }); toast(ok); }
    catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function preview() {
    const b = await save(true); if (!b) return;
    try { const r = await api(`/api/v1/admin/blogs/${b.id}/preview`, { method: "POST" }); window.open(r.url, "_blank", "noopener"); } catch (e) { toast((e as Error).message, true); }
  }
  async function addCat() {
    const name = window.prompt("New category name"); if (!name) return;
    try { const c = await api("/api/v1/admin/categories", { method: "POST", body: { websiteId: f.websiteId, name } }); setCats((x) => x.some((y) => y.id === c.id) ? x : [...x, c]); set({ categoryId: c.id }); } catch (e) { toast((e as Error).message, true); }
  }
  const addTags = (raw: string) => { const names = raw.split(",").map((s) => s.trim()).filter(Boolean); if (names.length) set({ tags: [...new Set([...f.tags, ...names])] }); setTagText(""); };

  return (<>
    <div className="head"><div><h1>{isNew ? "New article" : "Edit article"}</h1>
      <p>{meta ? <><Status s={status} /> · Last updated {fmt(meta.updatedAt)}{meta.publishedAt ? ` · Published ${fmt(meta.publishedAt)}` : ""}</> : "Not saved yet"}</p></div>
      <button className="btn" onClick={() => router.push("/blogs")}>← All articles</button></div>
    {locked && <p className="err-text">This article is live. Only a Website Admin can change it. You can duplicate it to make a new draft.</p>}
    <div className="editor-grid">
      <div className="card">
        <div className="field"><label htmlFor="t">Title</label><input id="t" type="text" value={f.title} disabled={locked}
          onChange={(e) => set({ title: e.target.value, ...(slugEdited ? {} : { slug: slugify(e.target.value) }) })} /></div>
        <div className="field"><label htmlFor="s">URL slug</label><input id="s" type="text" value={f.slug} disabled={locked}
          onChange={(e) => { setSlugEdited(true); set({ slug: slugify(e.target.value) }); }} /><small>The article address: /{f.slug || "your-article"}</small></div>
        <div className="field"><label htmlFor="x">Short description</label><textarea id="x" value={f.excerpt} disabled={locked} maxLength={500} onChange={(e) => set({ excerpt: e.target.value })} /><small>{f.excerpt.length}/500 · shown on blog cards</small></div>
        <div className="field"><label>Content</label>{!locked ? <RichEditor value={f.content} onChange={(html) => set({ content: html })} /> : <div className="tt" dangerouslySetInnerHTML={{ __html: f.content }} />}</div>
        <h2 style={{ marginTop: 24 }}>SEO</h2>
        <div className="field"><label htmlFor="st">SEO title</label><input id="st" type="text" value={f.seoTitle} disabled={locked} onChange={(e) => set({ seoTitle: e.target.value })} /><small>{f.seoTitle.length}/60 recommended</small></div>
        <div className="field"><label htmlFor="md">Meta description</label><textarea id="md" value={f.metaDescription} disabled={locked} onChange={(e) => set({ metaDescription: e.target.value })} /><small>{f.metaDescription.length}/160 recommended</small></div>
        <div className="field"><label htmlFor="cu">Canonical URL</label><input id="cu" type="text" value={f.canonicalUrl} disabled={locked} onChange={(e) => set({ canonicalUrl: e.target.value })} placeholder="https://…" /></div>
        <div className="field"><label htmlFor="rb">Search engine indexing</label><select id="rb" value={f.robots} disabled={locked} onChange={(e) => set({ robots: e.target.value })}>
          <option value="index,follow">Index and follow (default)</option><option value="noindex,follow">Do not index</option><option value="index,nofollow">Index, do not follow links</option><option value="noindex,nofollow">Do not index or follow</option></select></div>
        <div className="field"><label htmlFor="ot">Social share title</label><input id="ot" type="text" value={f.ogTitle} disabled={locked} onChange={(e) => set({ ogTitle: e.target.value })} /></div>
        <div className="field"><label htmlFor="od">Social share description</label><textarea id="od" value={f.ogDescription} disabled={locked} onChange={(e) => set({ ogDescription: e.target.value })} /></div>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="card"><h2>Publish</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {!locked && <button className="btn" disabled={busy} onClick={() => save()}>{status === "PUBLISHED" ? "Update published article" : "Save draft"}</button>}
            <button className="btn" disabled={busy} onClick={preview}>Preview</button>
            {canPublish ? <>
              {status !== "PUBLISHED" && <button className="btn dark" disabled={busy} onClick={() => act("publish", "Published. The website will show it shortly.")}>Publish now</button>}
              {status === "PUBLISHED" && <button className="btn danger" disabled={busy} onClick={() => confirm("Remove this article from the website?") && act("unpublish", "Unpublished")}>Unpublish</button>}
              {status !== "PUBLISHED" && <div className="field" style={{ marginTop: 8, marginBottom: 0 }}><label htmlFor="sc">Schedule for later</label>
                <input id="sc" type="datetime-local" value={sched} onChange={(e) => setSched(e.target.value)} />
                <button className="btn" disabled={busy || !sched} onClick={() => act("schedule", "Scheduled", { scheduledAt: new Date(sched).toISOString() })}>Schedule</button></div>}
            </> : !locked && <button className="btn dark" disabled={busy || status === "IN_REVIEW"} onClick={() => act("submit", "Submitted for review")}>{status === "IN_REVIEW" ? "Waiting for review" : "Submit for review"}</button>}
          </div>
          {meta?.scheduledAt && status === "SCHEDULED" && <p style={{ color: "var(--muted)" }}>Goes live {fmt(meta.scheduledAt)}</p>}
        </div>
        <div className="card"><h2>Details</h2>
          <div className="field"><label htmlFor="w">Website</label><select id="w" value={f.websiteId} disabled={!isNew} onChange={(e) => set({ websiteId: e.target.value, categoryId: "" })}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{!isNew && <small>An article stays on its website.</small>}</div>
          <div className="field"><label htmlFor="c">Category</label><div style={{ display: "flex", gap: 6 }}><select id="c" value={f.categoryId} disabled={locked} onChange={(e) => set({ categoryId: e.target.value })}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="btn sm" onClick={addCat} disabled={locked}>+ New</button></div></div>
          <div className="field"><label htmlFor="tg">Tags</label><input id="tg" type="text" value={tagText} disabled={locked} placeholder="Type a tag, press Enter" onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTags(tagText); } }} onBlur={() => addTags(tagText)} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{f.tags.map((t) => <span key={t} className="badge">{t} <button type="button" aria-label={`Remove ${t}`} style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => set({ tags: f.tags.filter((x) => x !== t) })}>×</button></span>)}</div></div>
          <small style={{ color: "var(--muted)" }}>Featured image and author selection arrive with the Media Library and Users phases.</small>
        </div>
      </div>
    </div>
    {el}
  </>);
}
