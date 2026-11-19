"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon, ArrowDown, ArrowUp, ExternalLink, FileText, Link2, Newspaper, Plus, RefreshCw, Search, X } from "lucide-react";
import { api, fmt, useToast } from "@/components/ui";
import { useSite } from "@/components/site";
import { BlogEditor } from "@/components/BlogEditor";

type Kind = "pages" | "blogs";
type Row = { id: string; title: string; slug: string; status: string; website: string; websiteId: string; category: string; author: string; updatedAt: string; edited: boolean; note: string; img?: string; changes?: boolean; review?: string; kind?: string };
type Sort = { key: keyof Row; dir: 1 | -1 };

const LABEL: Record<string, string> = { DRAFT: "Draft", IN_REVIEW: "In review", SCHEDULED: "Scheduled", PUBLISHED: "Live", UNPUBLISHED: "Unpublished" };
const Chip = ({ r }: { r: Row }) => r.review === "WAITING" ? <span className="badge IN_REVIEW" title="Sent for review, waiting for an admin">Waiting for review</span>
  : (r.changes && r.status === "DRAFT") || r.review === "CHANGES" ? <span className="badge UNPUBLISHED" title="An admin asked for changes">Changes requested</span>
  : r.edited ? <span className="badge SCHEDULED" title="Has saved changes that are not live yet">{r.status === "PUBLISHED" ? "Live · unpublished changes" : "Draft changes"}</span>
  : r.kind === "page" && r.status !== "PUBLISHED" ? <span className="badge UNPUBLISHED" title="The website shows its own text">No changes</span>
  : <span className={"badge " + r.status}>{LABEL[r.status] ?? r.status}</span>;

function ContentScreen() {
  const router = useRouter(); const sp = useSearchParams(); const [site] = useSite(); const { toast, el } = useToast();
  const [kind, setKind] = useState<Kind>("blogs"); const [rows, setRows] = useState<Row[] | null>(null); const [counts, setCounts] = useState({ pages: 0, blogs: 0 });
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [sort, setSort] = useState<Sort>({ key: "updatedAt", dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set()); const [open, setOpen] = useState<null | { kind: Kind; id: string; title: string; first?: string }>(null);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0); const [syncing, setSyncing] = useState(false); const autoSynced = useRef<Set<string>>(new Set());
  const [sites, setSites] = useState<any[]>([]);
  // Who may publish where (the server checks again on every action).
  const [roles, setRoles] = useState<{ sup: boolean; map: Record<string, string> }>({ sup: false, map: {} });
  useEffect(() => { api("/api/v1/auth/me").then((m) => setRoles({ sup: m.user.role === "SUPER_ADMIN", map: m.websiteRoles ?? {} })).catch(() => {}); }, []);
  const canPub = (websiteId: string) => roles.sup || roles.map[websiteId] === "WEBSITE_ADMIN";
  useEffect(() => { api<any[]>("/api/v1/admin/websites").then(setSites).catch(() => {}); }, []);
  const syncTarget = () => (site ? sites.find((x) => x.id === site) : sites.filter((x) => x.active && x.domain).length === 1 ? sites.find((x) => x.active && x.domain) : null) ?? null;
  /** Framer-style: read the live website and bring in all its pages. */
  const syncPages = async (quiet = false) => {
    const t = syncTarget(); if (!t) { if (!quiet) toast("Choose a website (top left) that has an address", true); return; }
    setSyncing(true);
    try {
      const r = await api(`/api/v1/admin/websites/${t.id}/sync-pages`, { method: "POST" });
      toast(`${r.pages.length} page${r.pages.length === 1 ? "" : "s"} found on ${t.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}` + (r.created ? ` · ${r.created} new` : "") + (r.removed ? ` · ${r.removed} removed` : "") + (r.posts?.added ? ` · ${r.posts.added} article${r.posts.added === 1 ? "" : "s"} brought in` : "") + (r.posts?.filled ? ` · ${r.posts.filled} article${r.posts.filled === 1 ? "" : "s"} completed (photo/category)` : "") + (r.posts?.problems?.length ? ` · Problem: ${r.posts.problems[0]}` : "") + (r.untagged?.length ? ` · ${r.untagged.length} not editable yet` : ""));
      load();
    } catch (e) { if (!quiet) toast((e as Error).message, true); } finally { setSyncing(false); }
  };

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const w = site ? `website=${site}` : "";
      const [pg, bl] = await Promise.all([api("/api/v1/admin/pages" + (w ? "?" + w : "")), api(`/api/v1/admin/blogs?limit=1${w ? "&" + w : ""}`)]);
      if (seq !== loadSeq.current) return;
      setCounts({ pages: pg.length, blogs: bl.total });
      if (kind === "pages") {
        setRows(pg.map((p: any): Row => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, website: p.website?.name ?? "", websiteId: p.websiteId, category: "", author: "", updatedAt: p.updatedAt,
          edited: p.unpublished, review: p.reviewState, kind: "page", note: p.fieldCount ? `${p.editedCount} of ${p.fieldCount} texts edited` : "" }))); setPages(1);
      } else {
        const p = new URLSearchParams({ limit: "20", page: String(page) }); if (site) p.set("website", site); if (q) p.set("q", q); if (status) p.set("status", status);
        const d = await api("/api/v1/admin/blogs?" + p); if (seq !== loadSeq.current) return;
        setRows(d.items.map((b: any): Row => ({ id: b.id, title: b.title, slug: b.slug, status: b.status, website: b.website?.name ?? "", websiteId: b.websiteId, category: b.category?.name ?? "", author: b.authorName || b.author?.name || "", updatedAt: b.updatedAt, edited: false, note: "", img: b.featuredImage?.id ? `/api/v1/media/${b.featuredImage.id}` : (b.featuredImageId ? `/api/v1/media/${b.featuredImageId}` : ""), changes: !!b.reviewNote })));
        setPages(d.pages);
      }
    } catch (e) { setRows([]); toast((e as Error).message, true); }
  }, [site, kind, q, status, page]); // eslint-disable-line
  useEffect(() => { setRows(null); const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line
  useEffect(() => { setSel(new Set()); setPage(1); }, [kind, site, q, status]);
  useEffect(() => {
    const t = syncTarget(); if (!site || !rows || !t?.domain || !t.active || autoSynced.current.has(t.id)) return;   // "All websites": nothing is read automatically
    autoSynced.current.add(t.id); syncPages(true);
  }, [kind, rows, sites, site]); // eslint-disable-line
  // Links like /content?open=blogs:ID (from the Ctrl+K search) or /content?new=1
  useEffect(() => {
    const o = sp.get("open"); if (o) { const [k, id] = o.split(":"); if (k === "pages" && id) { router.replace(`/pages/${id}`); return; } if (k && id) { setKind(k as Kind); setOpen({ kind: k as Kind, id, title: "" }); } router.replace("/content"); }
    else if (sp.get("new")) { setKind("blogs"); setOpen({ kind: "blogs", id: "new", title: "New article" }); router.replace("/content"); }
  }, [sp]); // eslint-disable-line
  useEffect(() => { const k = (e: KeyboardEvent) => { const a = document.activeElement as HTMLElement | null; if (e.key === "Escape" && !document.querySelector(".modal") && !(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))) setOpen(null); }; const m = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data === "cms-close") setOpen(null); };
    window.addEventListener("keydown", k); window.addEventListener("message", m); return () => { window.removeEventListener("keydown", k); window.removeEventListener("message", m); }; }, []);

  const shown = useMemo(() => {
    if (!rows) return null; const s = q.trim().toLowerCase();
    let r = kind === "pages" ? rows.filter((x) => (!s || (x.title + x.slug).toLowerCase().includes(s)) && (!status || x.status === status)) : rows;
    return [...r].sort((a, b) => { const x = String(a[sort.key] ?? ""), y = String(b[sort.key] ?? ""); return x.localeCompare(y) * sort.dir; });
  }, [rows, q, status, sort, kind]);
  const th = (key: keyof Row, label: string) => (<th aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
    <button className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>{label}{sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button></th>);
  const all = !!shown?.length && shown.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (action: "publish" | "unpublish" | "delete") => {
    const ids = [...sel]; if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} article${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await Promise.allSettled(ids.map((id) => action === "delete" ? api(`/api/v1/admin/blogs/${id}`, { method: "DELETE" })
      : api(`/api/v1/admin/${kind}/${id}/publish`, { method: "POST", body: { action } })));
    const bad = res.filter((r) => r.status === "rejected") as PromiseRejectedResult[]; setBusy(false); setSel(new Set());
    toast(bad.length ? `${ids.length - bad.length} done, ${bad.length} failed: ${(bad[0].reason as Error).message}` : `Done for ${ids.length} item${ids.length > 1 ? "s" : ""}`, !!bad.length); load();
  };
  const openRow = (r: Row) => kind === "pages" ? router.push(`/pages/${r.id}`) : setOpen({ kind, id: r.id, title: r.title });
  const quick = async (r: Row, action: "publish" | "unpublish") => {
    try { await api(`/api/v1/admin/${kind}/${r.id}/publish`, { method: "POST", body: { action } }); toast(action === "publish" ? `“${r.title}” is live` : `“${r.title}” taken off the website`); load(); }
    catch (e) { toast((e as Error).message, true); }
  };
  const siteUrl = open ? `/${open.kind === "pages" ? "pages" : "blogs"}/${open.id}` : "";

  return (<div className={"content" + (open ? " has-panel" : "")}>
    <aside className="coll" aria-label="Collections">
      <h2>Collections</h2>
      {([["blogs", "Blog", <Newspaper size={16} key="n" />, counts.blogs], ["pages", "Pages", <FileText size={16} key="f" />, counts.pages]] as const).map(([k, label, icon, n]) => (
        <button key={k} className={kind === k ? "on" : ""} aria-current={kind === k} onClick={() => { setKind(k); setQ(""); setStatus(""); }}>{icon}<span>{label}</span><em>{n}</em></button>))}
    </aside>
    <section className="list" aria-label={kind === "blogs" ? "Blog articles" : "Website pages"}>
      <div className="list-head">
        <div><h1>{kind === "blogs" ? "Blog" : "Pages"}</h1><p>{kind === "blogs" ? "Write, review and publish articles. They appear on your website's Blog page." : "Every page of your live website, kept in sync. Edit text, links and images; the design stays exactly as it is."}</p></div>
        <div className="list-actions">
          {<button className="btn" disabled={syncing} onClick={() => syncPages()}><RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Reading website…" : "Sync from website"}</button>}
          {kind === "pages" && <button className="btn" onClick={() => router.push("/pages")}><Link2 size={15} /> Connection</button>}
          {kind === "blogs" && <button className="btn dark" onClick={() => setOpen({ kind: "blogs", id: "new", title: "New article" })}><Plus size={15} /> New article</button>}
        </div>
      </div>
      <div className="toolbar">
        <label className="search"><Search size={15} aria-hidden /><input type="search" placeholder={kind === "blogs" ? "Search by title or slug…" : "Search pages…"} aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="icon-btn" onClick={() => { setRows(null); load(); }} aria-label="Refresh list" title="Refresh"><RefreshCw size={15} /></button>
      </div>
      {sel.size > 0 && <div className="bulk" role="region" aria-label="Selected items"><b>{sel.size} selected</b>
        {(rows ?? []).filter((r) => sel.has(r.id)).every((r) => canPub(r.websiteId))
          ? <><button className="btn sm" disabled={busy} onClick={() => bulk("publish")}>Publish</button><button className="btn sm" disabled={busy} onClick={() => bulk("unpublish")}>Unpublish</button></>
          : <span className="mut">Only a Website Admin can publish.</span>}
        {kind === "blogs" && <button className="btn sm danger" disabled={busy} onClick={() => bulk("delete")}>Delete</button>}<button className="btn sm" onClick={() => setSel(new Set())}>Clear</button></div>}
      <div className="card tbl">
        {!shown ? <div className="skel" aria-busy="true" aria-label="Loading">{[0, 1, 2, 3, 4].map((i) => <div key={i} />)}</div>
          : !shown.length ? <div className="empty-state"><div className="es-ic">{kind === "blogs" ? <Newspaper size={28} /> : <FileText size={28} />}</div>
            <h3>{q || status ? "Nothing matches" : kind === "blogs" ? "No articles yet" : "No pages yet"}</h3>
            <p>{q || status ? "Try a different word or clear the filters." : kind === "blogs" ? syncing ? "Reading your website and bringing in the articles it already shows…" : "Bring in the articles your website already shows, or write a new one." : syncing ? "Reading your website and bringing in every page…" : "Click below and the CMS reads your live website and brings in every page, like Framer."}</p>
            {!q && !status && kind === "blogs" && <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn" disabled={syncing} onClick={() => syncPages()}><RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Reading website…" : "Bring in articles from website"}</button>
              <button className="btn orange" onClick={() => setOpen({ kind: "blogs", id: "new", title: "New article" })}><Plus size={15} /> New article</button></div>}
            {!q && !status && kind === "pages" && <button className="btn orange" disabled={syncing} onClick={() => syncPages()}><RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Reading website…" : "Bring in pages from website"}</button>}</div>
            : <table><thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(shown.map((r) => r.id)))} /></th>
              {th("title", "Title")}{th("status", "Status")}{!site && kind === "blogs" ? th("website", "Website") : th("slug", "Slug")}{kind === "blogs" ? th("category", "Category") : th("website", "Website")}{kind === "blogs" ? th("author", "Author") : <th>Edits</th>}{th("updatedAt", "Updated")}<th><span className="sr-only">Quick actions</span></th></tr></thead>
              <tbody>{shown.map((r) => (<tr key={r.id} className={(open?.id === r.id ? "on " : "") + (sel.has(r.id) ? "picked" : "")} onClick={() => openRow(r)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.title}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><div className="title-cell">{kind === "blogs" && (r.img ? <img className="thumb" src={r.img} alt="" loading="lazy" /> : <span className="thumb thumb--none" aria-hidden><ImageIcon size={15} /></span>)}<button className="row-title" onClick={(e) => { e.stopPropagation(); openRow(r); }}>{r.title}</button></div></td>
                <td><Chip r={r} /></td>{!site && kind === "blogs" ? <td className="mut">{r.website}</td> : <td><div className="slug-cell" title={"/" + r.slug.replace(/^\//, "")}>/{r.slug.replace(/^\//, "")}</div></td>}
                <td>{kind === "blogs" ? (r.category || <span className="mut">—</span>) : r.website}</td><td>{kind === "blogs" ? (r.author || <span className="mut">—</span>) : <span className="mut">{r.note || "—"}</span>}</td>
                <td className="mut nowrap">{fmt(r.updatedAt)}</td>
                <td className="row-act" onClick={(e) => e.stopPropagation()}>{!canPub(r.websiteId) ? <button className="btn sm" onClick={() => openRow(r)}>{r.review === "WAITING" || r.status === "IN_REVIEW" ? "View" : "Edit"}</button>
                  : r.review === "WAITING" || r.status === "IN_REVIEW" ? <button className="btn sm orange" onClick={() => openRow(r)}>Review</button>
                  : r.kind === "page" && !r.edited ? <button className="btn sm" onClick={() => openRow(r)}>Edit</button>
                  : r.status === "PUBLISHED" && !r.edited ? <button className="btn sm" onClick={() => quick(r, "unpublish")}>Unpublish</button>
                  : <button className="btn sm orange" onClick={() => quick(r, "publish")}>{r.edited && r.status === "PUBLISHED" ? "Publish changes" : "Publish"}</button>}</td></tr>))}</tbody></table>}
      </div>
      {kind === "blogs" && pages > 1 && <div className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </section>
    {open && <>
      <div className="so-dim" onClick={() => setOpen(null)} />
      <aside className="slide" role="dialog" aria-label={open.title || "Editor"}>
        <div className="slide-head"><b>{open.id === "new" ? "New article" : open.title || "Editing"}</b>
          <div><a className="icon-btn" href={siteUrl} target="_blank" rel="noreferrer" aria-label="Open in a full page" title="Open in a full page"><ExternalLink size={15} /></a>
            <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close editor (Esc)" title="Close (Esc)"><X size={16} /></button></div></div>
        <div className="slide-body"><BlogEditor key={open.first ?? open.id} id={open.first ?? open.id} embedded onChanged={load} onCreated={(nid) => setOpen((o) => o && { ...o, id: nid, first: o.first ?? o.id })} /></div>
      </aside></>}
    {el}
  </div>);
}

export default function Content() { return <Suspense fallback={<p>Loading…</p>}><ContentScreen /></Suspense>; }
