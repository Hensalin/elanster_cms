"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Link2, Newspaper, Plus, RefreshCw, Search, X } from "lucide-react";
import { api, fmt, useToast } from "@/components/ui";
import { useSite } from "@/components/site";

type Kind = "pages" | "blogs";
type Row = { id: string; title: string; slug: string; status: string; website: string; category: string; author: string; updatedAt: string; edited: boolean; note: string };
type Sort = { key: keyof Row; dir: 1 | -1 };

const LABEL: Record<string, string> = { DRAFT: "Draft", IN_REVIEW: "In review", SCHEDULED: "Scheduled", PUBLISHED: "Live", UNPUBLISHED: "Unpublished" };
const Chip = ({ r }: { r: Row }) => r.edited
  ? <span className="badge SCHEDULED" title="Has changes that are not live yet">Edited</span>
  : <span className={"badge " + r.status}>{LABEL[r.status] ?? r.status}</span>;

function ContentScreen() {
  const router = useRouter(); const sp = useSearchParams(); const [site] = useSite(); const { toast, el } = useToast();
  const [kind, setKind] = useState<Kind>("blogs"); const [rows, setRows] = useState<Row[] | null>(null); const [counts, setCounts] = useState({ pages: 0, blogs: 0 });
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [sort, setSort] = useState<Sort>({ key: "updatedAt", dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set()); const [open, setOpen] = useState<null | { kind: Kind; id: string; title: string }>(null);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const w = site ? `website=${site}` : "";
      const [pg, bl] = await Promise.all([api("/api/v1/admin/pages" + (w ? "?" + w : "")), api(`/api/v1/admin/blogs?limit=1${w ? "&" + w : ""}`)]);
      if (seq !== loadSeq.current) return;
      setCounts({ pages: pg.length, blogs: bl.total });
      if (kind === "pages") {
        setRows(pg.map((p: any): Row => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, website: p.website?.name ?? "", category: "", author: "", updatedAt: p.updatedAt,
          edited: p.status === "PUBLISHED" && p.unpublished, note: p.fieldCount ? `${p.editedCount} of ${p.fieldCount} edited` : "" }))); setPages(1);
      } else {
        const p = new URLSearchParams({ limit: "20", page: String(page) }); if (site) p.set("website", site); if (q) p.set("q", q); if (status) p.set("status", status);
        const d = await api("/api/v1/admin/blogs?" + p); if (seq !== loadSeq.current) return;
        setRows(d.items.map((b: any): Row => ({ id: b.id, title: b.title, slug: b.slug, status: b.status, website: b.website?.name ?? "", category: b.category?.name ?? "", author: b.author?.name ?? "", updatedAt: b.updatedAt, edited: false, note: "" })));
        setPages(d.pages);
      }
    } catch (e) { setRows([]); toast((e as Error).message, true); }
  }, [site, kind, q, status, page]); // eslint-disable-line
  useEffect(() => { setRows(null); const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line
  useEffect(() => { setSel(new Set()); setPage(1); }, [kind, site, q, status]);
  // Links like /content?open=blogs:ID (from the Ctrl+K search) or /content?new=1
  useEffect(() => {
    const o = sp.get("open"); if (o) { const [k, id] = o.split(":"); if (k && id) { setKind(k as Kind); setOpen({ kind: k as Kind, id, title: "" }); } router.replace("/content"); }
    else if (sp.get("new")) { setKind("blogs"); setOpen({ kind: "blogs", id: "new", title: "New article" }); router.replace("/content"); }
  }, [sp]); // eslint-disable-line
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); }; const m = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data === "cms-close") setOpen(null); };
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
  const siteUrl = open ? `/${open.kind === "pages" ? "pages" : "blogs"}/${open.id}` : "";

  return (<div className={"content" + (open ? " has-panel" : "")}>
    <aside className="coll" aria-label="Collections">
      <h2>Collections</h2>
      {([["blogs", "Blog", <Newspaper size={16} key="n" />, counts.blogs], ["pages", "Pages", <FileText size={16} key="f" />, counts.pages]] as const).map(([k, label, icon, n]) => (
        <button key={k} className={kind === k ? "on" : ""} aria-current={kind === k} onClick={() => { setKind(k); setQ(""); setStatus(""); }}>{icon}<span>{label}</span><em>{n}</em></button>))}
    </aside>
    <section className="list" aria-label={kind === "blogs" ? "Blog articles" : "Website pages"}>
      <div className="list-head">
        <div><h1>{kind === "blogs" ? "Blog" : "Pages"}</h1><p>{kind === "blogs" ? "Write, review and publish articles. They appear on your website's Blog page." : "Edit the text, links, images and SEO of your real website pages. The design stays exactly as it is."}</p></div>
        <div className="list-actions">
          {kind === "pages" && <button className="btn" onClick={() => router.push("/pages")}><Link2 size={15} /> Website connection</button>}
          {kind === "blogs" && <button className="btn dark" onClick={() => setOpen({ kind: "blogs", id: "new", title: "New article" })}><Plus size={15} /> New article</button>}
        </div>
      </div>
      <div className="toolbar">
        <label className="search"><Search size={15} aria-hidden /><input type="search" placeholder={kind === "blogs" ? "Search by title or slug…" : "Search pages…"} aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="icon-btn" onClick={() => { setRows(null); load(); }} aria-label="Refresh list" title="Refresh"><RefreshCw size={15} /></button>
      </div>
      {sel.size > 0 && <div className="bulk" role="region" aria-label="Selected items"><b>{sel.size} selected</b>
        <button className="btn sm" disabled={busy} onClick={() => bulk("publish")}>Publish</button><button className="btn sm" disabled={busy} onClick={() => bulk("unpublish")}>Unpublish</button>
        {kind === "blogs" && <button className="btn sm danger" disabled={busy} onClick={() => bulk("delete")}>Delete</button>}<button className="btn sm" onClick={() => setSel(new Set())}>Clear</button></div>}
      <div className="card tbl">
        {!shown ? <div className="skel" aria-busy="true" aria-label="Loading">{[0, 1, 2, 3, 4].map((i) => <div key={i} />)}</div>
          : !shown.length ? <div className="empty-state"><div className="es-ic">{kind === "blogs" ? <Newspaper size={28} /> : <FileText size={28} />}</div>
            <h3>{q || status ? "Nothing matches" : kind === "blogs" ? "No articles yet" : "No pages yet"}</h3>
            <p>{q || status ? "Try a different word or clear the filters." : kind === "blogs" ? "Write your first article. It stays a draft until you publish it." : "Open Website connection to import your website's pages."}</p>
            {!q && !status && kind === "blogs" && <button className="btn orange" onClick={() => setOpen({ kind: "blogs", id: "new", title: "New article" })}><Plus size={15} /> New article</button>}
            {!q && !status && kind === "pages" && <button className="btn orange" onClick={() => router.push("/pages")}>Open website connection</button>}</div>
            : <table><thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(shown.map((r) => r.id)))} /></th>
              {th("title", "Title")}{th("status", "Status")}{th("slug", "Slug")}{kind === "blogs" ? th("category", "Category") : th("website", "Website")}{kind === "blogs" ? th("author", "Author") : <th>Edits</th>}{th("updatedAt", "Updated")}</tr></thead>
              <tbody>{shown.map((r) => (<tr key={r.id} className={(open?.id === r.id ? "on " : "") + (sel.has(r.id) ? "picked" : "")} onClick={() => setOpen({ kind, id: r.id, title: r.title })}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.title}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><button className="row-title" onClick={(e) => { e.stopPropagation(); setOpen({ kind, id: r.id, title: r.title }); }}>{r.title}</button></td>
                <td><Chip r={r} /></td><td className="mut">/{r.slug.replace(/^\//, "")}</td>
                <td>{kind === "blogs" ? (r.category || <span className="mut">—</span>) : r.website}</td><td>{kind === "blogs" ? (r.author || <span className="mut">—</span>) : <span className="mut">{r.note || "—"}</span>}</td>
                <td className="mut">{fmt(r.updatedAt)}</td></tr>))}</tbody></table>}
      </div>
      {kind === "blogs" && pages > 1 && <div className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </section>
    {open && <>
      <div className="so-dim" onClick={() => setOpen(null)} />
      <aside className="slide" role="dialog" aria-label={open.title || "Editor"}>
        <div className="slide-head"><b>{open.id === "new" ? "New article" : open.title || "Editing"}</b>
          <div><a className="icon-btn" href={siteUrl} target="_blank" rel="noreferrer" aria-label="Open in a full page" title="Open in a full page"><ExternalLink size={15} /></a>
            <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close editor (Esc)" title="Close (Esc)"><X size={16} /></button></div></div>
        <iframe key={open.kind + open.id} name="cms-embed" title="Editor" src={siteUrl + "?embed=1"} onLoad={() => load()} />
      </aside></>}
    {el}
  </div>);
}

export default function Content() { return <Suspense fallback={<p>Loading…</p>}><ContentScreen /></Suspense>; }
