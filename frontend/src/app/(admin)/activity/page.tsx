"use client";
import { useEffect, useState } from "react";
import { Download, History, Search } from "lucide-react";
import { api, fmt } from "@/components/ui";
import { useSite } from "@/components/site";

type A = { id: string; action: string; summary: string; createdAt: string; user?: { name: string } | null };
export default function Activity() {
  const [site] = useSite(); const [rows, setRows] = useState<A[] | null>(null); const [q, setQ] = useState(""); const [days, setDays] = useState("30"); const [err, setErr] = useState("");
  const qs = () => { const p = new URLSearchParams(); if (site) p.set("website", site); if (q) p.set("q", q); if (days) p.set("days", days); return p; };
  useEffect(() => { setRows(null); const t = setTimeout(() => api<A[]>("/api/v1/admin/activity?" + qs()).then(setRows).catch((e) => { setErr(e.message); setRows([]); }), q ? 250 : 0); return () => clearTimeout(t); }, [site, q, days]); // eslint-disable-line
  const csv = () => { const p = qs(); p.set("format", "csv"); window.location.href = "/api/v1/admin/activity?" + p; };
  return (<>
    <div className="head"><div><h1>Activity log</h1><p>Who changed what, and when. Kept for your whole team.</p></div><div className="list-actions"><button className="btn" onClick={csv}><Download size={15} /> Export CSV</button></div></div>
    <div className="list"><div className="toolbar">
      <label className="search"><Search size={15} aria-hidden /><input type="search" aria-label="Search activity" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <select aria-label="Period" value={days} onChange={(e) => setDays(e.target.value)}><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="">All time</option></select></div></div>
    {err && <p className="err-text" role="alert">{err}</p>}
    <div className="card">{!rows ? <div className="skel"><div /><div /><div /></div> : !rows.length
      ? <div className="empty-state"><div className="es-ic"><History size={28} /></div><h3>No activity</h3><p>Nothing happened in this period.</p></div>
      : <ol className="timeline">{rows.map((a) => <li key={a.id}><span className="tl-dot" data-a={a.action.split("_")[0]} /><div><b>{a.summary}</b><small>{a.user?.name ?? "Website / system"} · {fmt(a.createdAt)}</small></div></li>)}</ol>}</div>
  </>);
}
