"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmt, Status, STATUS_LABEL, useToast } from "@/components/ui";

export default function Blogs() {
  const [sites, setSites] = useState<any[]>([]); const [data, setData] = useState<any>(null);
  const [q, setQ] = useState(""); const [site, setSite] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const { toast, el } = useToast();
  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) p.set("q", q); if (site) p.set("website", site); if (status) p.set("status", status);
    try { setData(await api("/api/v1/admin/blogs?" + p)); } catch (e) { toast((e as Error).message, true); }
  }, [q, site, status, page]); // eslint-disable-line
  useEffect(() => { api("/api/v1/admin/websites").then(setSites); }, []);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); load(); } catch (e) { toast((e as Error).message, true); } };
  return (<>
    <div className="head"><div><h1>Blogs / Articles</h1><p>Write, review and publish articles for any connected website.</p></div>
      <Link className="btn dark" href="/blogs/new">+ New article</Link></div>
    <div className="toolbar">
      <input type="search" placeholder="Search by title or slug…" aria-label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <select aria-label="Website" value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }}><option value="">All websites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
    {!data ? <p>Loading…</p> : !data.items.length ? <div className="empty">{q || site || status ? "No articles match these filters." : "No articles yet. Create your first one."}</div> :
      <div className="card" style={{ padding: 0, overflowX: "auto" }}><table>
        <thead><tr><th>Article</th><th>Website</th><th>Category</th><th>Author</th><th>Status</th><th>Updated</th><th>Published</th><th></th></tr></thead>
        <tbody>{data.items.map((b: any) => (<tr key={b.id}>
          <td><Link href={`/blogs/${b.id}`}><b>{b.title}</b></Link><br /><small style={{ color: "var(--muted)" }}>/{b.slug}</small></td>
          <td>{b.website?.name}</td><td>{b.category?.name ?? "—"}</td><td>{b.author?.name ?? "—"}</td><td><Status s={b.status} /></td>
          <td>{fmt(b.updatedAt)}</td><td>{fmt(b.publishedAt)}</td>
          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
            <Link className="btn sm" href={`/blogs/${b.id}`}>Edit</Link>{" "}
            <button className="btn sm" onClick={() => act(() => api(`/api/v1/admin/blogs/${b.id}/duplicate`, { method: "POST" }), "Duplicated as a new draft")}>Duplicate</button>{" "}
            <button className="btn sm danger" onClick={() => confirm(`Delete "${b.title}"?`) && act(() => api(`/api/v1/admin/blogs/${b.id}`, { method: "DELETE" }), "Article deleted")}>Delete</button></td>
        </tr>))}</tbody></table></div>}
    {data && <div className="pager"><span>{data.total} article{data.total === 1 ? "" : "s"}</span>
      <span><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> Page {data.page} of {data.pages} <button className="btn sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></span></div>}
    {el}
  </>);
}
