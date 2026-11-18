"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePlus2, FileText, Globe2, Image as Img, ShieldCheck, Users } from "lucide-react";
import { api, fmt, Status, useToast } from "@/components/ui";

type Level = "super" | "admin" | "editor";
type Stats = { level: Level; websites: number; published: number; drafts: number; review: number; pages: number; users: number;
  reviewQueue: any[]; myDrafts: any[]; myReview: any[]; recentUpdated: any[]; recentPublished: any[]; activity: any[] };

const INTRO: Record<Level, { title: string; text: string; chip: string }> = {
  super: { title: "Dashboard", chip: "Super Admin", text: "Everything across every website: people, publishing and activity." },
  admin: { title: "Dashboard", chip: "Website Admin", text: "Review what your editors wrote, then publish it to your websites." },
  editor: { title: "My work", chip: "Editor", text: "Write and edit content. When it is ready, send it for review — an admin publishes it." },
};

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null); const [err, setErr] = useState(""); const { toast, el } = useToast();
  const load = () => api<Stats>("/api/v1/admin/stats").then(setS).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <p className="err-text" role="alert">{err}</p>;
  if (!s) return <div className="skel" aria-busy="true"><div /><div /><div /></div>;
  const L = INTRO[s.level]; const canPub = s.level !== "editor";
  const act = async (id: string, action: "publish" | "unpublish") => {
    try { await api(`/api/v1/admin/blogs/${id}/publish`, { method: "POST", body: { action } }); toast(action === "publish" ? "Published" : "Sent back to draft"); load(); } catch (e) { toast((e as Error).message, true); }
  };
  const list = (rows: any[], empty: string, date: "updatedAt" | "publishedAt", extra?: (b: any) => React.ReactNode) => rows.length ? rows.map((b) => (
    <div className="row" key={b.id}><div><Link href={`/content?open=blogs:${b.id}`}><b>{b.title}</b></Link><small>{b.website?.name}{b.author?.name ? ` · ${b.author.name}` : ""} · {fmt(b[date])}</small></div>{extra ? extra(b) : <Status s={b.status} />}</div>
  )) : <div className="empty">{empty}</div>;
  const stats: [string, number, React.ReactNode][] = s.level === "super"
    ? [["Websites", s.websites, <Globe2 size={16} key="a" />], ["People", s.users, <Users size={16} key="b" />], ["Live articles", s.published, <FileText size={16} key="c" />], ["Waiting for review", s.review, <ShieldCheck size={16} key="d" />], ["Pages", s.pages, <FileText size={16} key="e" />]]
    : s.level === "admin"
    ? [["Waiting for review", s.review, <ShieldCheck size={16} key="d" />], ["Live articles", s.published, <FileText size={16} key="c" />], ["Drafts", s.drafts, <FilePlus2 size={16} key="f" />], ["Pages", s.pages, <FileText size={16} key="e" />]]
    : [["My drafts", s.myDrafts.length, <FilePlus2 size={16} key="f" />], ["In review", s.myReview.length, <ShieldCheck size={16} key="d" />], ["Pages I can edit", s.pages, <FileText size={16} key="e" />]];
  return (<>
    <div className="head"><div><h1>{L.title} <span className="role-chip big">{L.chip}</span></h1><p>{L.text}</p></div>
      <div className="list-actions"><Link className="btn" href="/media"><Img size={15} /> Media</Link><Link className="btn dark" href="/content?new=1"><FilePlus2 size={15} /> New article</Link></div></div>
    <div className="grid4">{stats.map(([l, n, ic]) => <div className="stat" key={l}><span className="stat-l">{ic}{l}</span><b>{n}</b></div>)}</div>
    {s.level === "editor" ? <div className="cols">
      <div className="card"><h2>My drafts</h2>{list(s.myDrafts, "No drafts. Start a new article or open a page from Content.", "updatedAt")}</div>
      <div className="card"><h2>Sent for review</h2>{list(s.myReview, "Nothing is waiting. After you send an article for review, it shows here until an admin publishes it.", "updatedAt")}</div>
      <div className="card"><h2>Recently published</h2>{list(s.recentPublished, "Nothing published yet.", "publishedAt")}</div></div>
    : <div className="cols">
      <div className="card"><h2>Needs your review {s.review > 0 && <span className="count-pill">{s.review}</span>}</h2>
        {list(s.reviewQueue, "All caught up. Nothing is waiting for review.", "updatedAt", (b) => <button className="btn sm orange" disabled={!canPub} onClick={() => act(b.id, "publish")}>Publish</button>)}</div>
      <div className="card"><h2>Recently published</h2>{list(s.recentPublished, "Nothing published yet.", "publishedAt", (b) => <button className="btn sm" onClick={() => act(b.id, "unpublish")}>Unpublish</button>)}</div>
      <div className="card"><h2>{s.level === "super" ? "Activity across all websites" : "Activity on your websites"}</h2>
        {s.activity.length ? s.activity.map((a) => <div className="row" key={a.id}><div>{a.summary}<small>{a.user?.name ?? "System"} · {fmt(a.createdAt)}</small></div></div>) : <div className="empty">No activity yet.</div>}</div>
      {s.level === "super" && <div className="card"><h2>Quick links</h2><div className="quick">
        <Link href="/websites"><Globe2 size={16} /> Manage websites &amp; connections</Link><Link href="/pages"><FileText size={16} /> Check website connection</Link><Link href="/content"><FileText size={16} /> All content</Link></div></div>}
    </div>}
    {el}
  </>);
}
