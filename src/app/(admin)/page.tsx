"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmt, Status } from "@/components/ui";

type Stats = { websites: number; published: number; drafts: number; review: number; pages: number;
  recentUpdated: any[]; recentPublished: any[]; activity: any[] };

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api<Stats>("/api/v1/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="err-text">{err}</p>;
  if (!s) return <p>Loading…</p>;
  const list = (rows: any[], empty: string, date: "updatedAt" | "publishedAt") => rows.length ? rows.map((b) => (
    <div className="row" key={b.id}><div><Link href={`/blogs/${b.id}`}><b>{b.title}</b></Link><small>{b.website?.name} · {fmt(b[date])}</small></div><Status s={b.status} /></div>
  )) : <div className="empty">{empty}</div>;
  return (<>
    <div className="head"><div><h1>Dashboard</h1><p>Overview of all the websites you manage.</p></div>
      <Link className="btn dark" href="/blogs/new">+ New article</Link></div>
    <div className="grid4">
      <div className="stat"><span>Connected websites</span><b>{s.websites}</b></div>
      <div className="stat"><span>Published articles</span><b>{s.published}</b></div>
      <div className="stat"><span>Draft articles</span><b>{s.drafts}</b></div>
      <div className="stat"><span>Waiting for review</span><b>{s.review}</b></div>
      <div className="stat"><span>Pages</span><b>{s.pages}</b></div>
    </div>
    <div className="cols">
      <div className="card"><h2>Recent updates</h2>{list(s.recentUpdated, "No articles yet. Create your first one.", "updatedAt")}</div>
      <div className="card"><h2>Recently published</h2>{list(s.recentPublished, "Nothing published yet.", "publishedAt")}</div>
      <div className="card"><h2>Recent admin activity</h2>
        {s.activity.length ? s.activity.map((a) => <div className="row" key={a.id}><div>{a.summary}<small>{a.user?.name ?? "System"} · {fmt(a.createdAt)}</small></div></div>) : <div className="empty">No activity yet.</div>}
      </div>
    </div>
  </>);
}
