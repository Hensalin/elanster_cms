"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePlus2, FileText, Globe2, ShieldCheck, Users, Activity, Plus } from "lucide-react";
import { CaughtUpArt, QuietArt, PromoArt, WriteArt, PagesArt, LiveArt } from "@/components/Illustrations";
import { api, fmt, Status, useToast } from "@/components/ui";
import { useSite } from "@/components/site";

type Level = "super" | "admin" | "editor";
type Stats = { level: Level; websites: number; published: number; drafts: number; review: number; pages: number; users: number; pageStats: { live: number; changed: number; waiting: number };
  reviewQueue: any[]; pendingUsers: number; changesRequested: { id: string; title: string; reviewNote: string; href: string }[]; myDrafts: any[]; myReview: any[]; recentUpdated: any[]; recentPublished: any[]; activity: any[] };

const INTRO: Record<Level, { title: string; text: string; chip: string }> = {
  super: { title: "Dashboard", chip: "Super Admin", text: "Everything across every website: people, publishing and activity." },
  admin: { title: "Dashboard", chip: "Website Admin", text: "Review what your editors wrote, then publish it to your websites." },
  editor: { title: "My work", chip: "Editor", text: "Write and edit content. When it is ready, send it for review — an admin publishes it." },
};


function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  return (<svg className="ring" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label={`${pct}%`}>
    <circle cx="32" cy="32" r={r} stroke="var(--panel)" strokeWidth="7" fill="none" />
    <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 32 32)" />
    <text x="32" y="36.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">{pct}%</text></svg>);
}

type WeekItem = { id: string; title: string; when: string; kind: string; href: string; site?: string };
/** A week at a glance: pick a day to see what was published or sent for review that day. */
function WeekCard({ items, tall }: { items: WeekItem[]; tall?: boolean }) {
  const today = new Date(); const day0 = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const [offset, setOffset] = useState(0);   // weeks back/forward from this week
  const start = day0(today); start.setDate(start.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const onDay = (d: Date) => items.filter((x) => same(new Date(x.when), d)).sort((a, b) => +new Date(b.when) - +new Date(a.when));
  const firstBusy = [...days].reverse().find((d) => d <= today && onDay(d).length);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = days.find((d) => d.toDateString() === picked) ?? (days.some((d) => same(d, today)) && onDay(today).length ? today : firstBusy ?? (offset === 0 ? today : days[0]));
  const list = onDay(sel);
  const label = start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (<div className={"card s4 week" + (tall ? " tall" : "")}>
    <div className="card-h wk-head"><h2>{label}</h2>
      <div className="wk-nav">
        <button aria-label="Previous week" onClick={() => { setOffset(offset - 1); setPicked(null); }}>‹</button>
        <button className={"wk-today" + (offset === 0 ? " on" : "")} onClick={() => { setOffset(0); setPicked(today.toDateString()); }}>Today</button>
        <button aria-label="Next week" onClick={() => { setOffset(offset + 1); setPicked(null); }}>›</button></div></div>
    <div className="week-strip" role="tablist" aria-label="Days of the week">{days.map((d) => { const n = onDay(d).length;
      return <button key={d.toISOString()} role="tab" aria-selected={same(d, sel)} className={"wd" + (same(d, today) ? " today" : "") + (same(d, sel) ? " sel" : "") + (n ? " busy" : "")}
        onClick={() => setPicked(d.toDateString())} title={n ? `${n} update${n > 1 ? "s" : ""}` : "Nothing this day"}>
        <small>{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</small><b>{d.getDate()}</b>
        <span className="wd-dots">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span></button>; })}</div>
    <div className="wk-day"><b>{same(sel, today) ? "Today" : sel.toLocaleDateString(undefined, { weekday: "long" })}</b>
      <span>{sel.toLocaleDateString(undefined, { day: "numeric", month: "long" })}</span>
      <em>{list.length ? `${list.length} update${list.length > 1 ? "s" : ""}` : ""}</em></div>
    {list.length ? <ul className="wk-list">{list.map((x) => <li key={x.id + x.kind}>
        <span className="wk-time">{new Date(x.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        <Link href={x.href} className="wk-box"><b>{x.title.replace(/^[‘'"“]+/, "")}</b>
          <small><span className={"wk-kind " + (x.kind === "Published" ? "pub" : "rev")}>{x.kind}</span>{x.site ? ` · ${x.site}` : ""}</small></Link></li>)}</ul>
      : <div className="wk-empty">Nothing published or sent for review this day.</div>}
  </div>);
}

const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function Dashboard() {
  const [health, setHealth] = useState<{ canConnect: boolean | string; problem: string | null; sessionSecretSet: boolean } | null>(null);
  useEffect(() => { fetch("/api/v1/health").then((r) => r.json()).then(setHealth).catch(() => {}); }, []);
  const [s, setS] = useState<Stats | null>(null); const [err, setErr] = useState(""); const { toast, el } = useToast();
  const [site] = useSite();
  const load = () => api<Stats>("/api/v1/admin/stats" + (site ? `?website=${site}` : "")).then(setS).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [site]); // eslint-disable-line
  const [me, setMe] = useState<{ name: string } | null>(null); const [live, setLive] = useState(""); const [linked, setLinked] = useState<boolean | null>(null);
  useEffect(() => { api("/api/v1/auth/me").then((r) => setMe(r.user)).catch(() => {});
    // Connected = the live website read content with its key in the last 7 days.
    api<any[]>("/api/v1/admin/websites").then((w) => { const a = w.find((x) => x.id === site) ?? w.find((x) => x.active && x.domain); setLive(a?.domain ?? "");
      setLinked(!!a && a.active && !!a.lastSeen && Date.now() - +new Date(a.lastSeen) < 7 * 864e5); }).catch(() => {}); }, [site]);
  if (err) return <p className="err-text" role="alert">{err}</p>;
  if (!s) return <div className="skel" aria-busy="true"><div /><div /><div /></div>;
  const L = INTRO[s.level];
 const canPub = s.level !== "editor";
  const act = async (id: string, action: "publish" | "unpublish") => {
    try { await api(`/api/v1/admin/blogs/${id}/publish`, { method: "POST", body: { action } }); toast(action === "publish" ? "Published" : "Sent back to draft"); load(); } catch (e) { toast((e as Error).message, true); }
  };
  const list = (rows: any[], empty: string, date: "updatedAt" | "publishedAt", extra?: (b: any) => React.ReactNode) => rows.length ? rows.map((b) => (
    <div className="row" key={b.kind + b.id}><div><Link href={b.href ?? `/content?open=blogs:${b.id}`}><b>{b.title}</b></Link><small>{b.website?.name}{b.author?.name ? ` · ${b.author.name}` : ""} · {fmt(b[date])}</small></div>{extra ? extra(b) : <Status s={b.status} />}</div>
  )) : <div className="empty-art">{empty.startsWith("All caught up") ? <CaughtUpArt /> : <QuietArt />}<p>{empty}</p></div>;
  const stats: [string, number, React.ReactNode][] = s.level === "super"
    ? [["Websites", s.websites, <Globe2 size={16} key="a" />], ["People", s.users, <Users size={16} key="b" />], ["Live articles", s.published, <FileText size={16} key="c" />], ["Waiting for review", s.review, <ShieldCheck size={16} key="d" />], ["Pages", s.pages, <FileText size={16} key="e" />]]
    : s.level === "admin"
    ? [["Waiting for review", s.review, <ShieldCheck size={16} key="d" />], ["Live articles", s.published, <FileText size={16} key="c" />], ["Article drafts", s.drafts, <FilePlus2 size={16} key="f" />], ["Pages with changes", s.pageStats.changed, <FileText size={16} key="e" />]]
    : [["My drafts", s.myDrafts.length, <FilePlus2 size={16} key="f" />], ["In review", s.myReview.length, <ShieldCheck size={16} key="d" />], ["Pages I can edit", s.pages, <FileText size={16} key="e" />]];
  return (<div className="dash">
    <section className="hero2">
      <div className="hero2-txt">
        <span className="role-chip">{L.chip}</span>
        <h1>Hi, {me?.name ? me.name.split(" ")[0] : "there"}!<br />What are we publishing today?</h1>
        <p>{L.text}</p>
        <div className="kpis">{stats.map(([l, n, ic]) => <span className="kpi" key={l}>{ic}<b>{n}</b> {l}</span>)}</div>
      </div>
      <div className="feat">
        <Link className="feat-add" href="/content?new=1" aria-label="New article"><span><Plus size={20} /></span><b>New article</b></Link>
        <Link className="feat-i" href="/content?new=1"><WriteArt /><b>Write an article</b><small>Add a title, photo and text, then publish</small></Link>
        <Link className="feat-i" href="/content"><PagesArt /><b>Edit website pages</b><small>Change text, links and images</small></Link>
        {live ? <a className="feat-i" href={live} target="_blank" rel="noreferrer"><LiveArt /><b>View live website</b><small>{live.replace(/^https?:\/\//, "").replace(/\/$/, "")}</small></a>
          : <Link className="feat-i" href="/websites"><LiveArt /><b>Your websites</b><small>Addresses and connections</small></Link>}
      </div>
    </section>
    {s.changesRequested.map((b) => <div className="note-banner" key={b.href} role="note"><b>Changes requested on “{b.title}”:</b> {b.reviewNote}<Link className="btn sm" href={b.href}>Open</Link></div>)}
    {s.level !== "super" && s.websites === 0 && <div className="note-banner" role="note"><b>You have no website to work on yet.</b> Ask your Super Admin to tick a website for you under Users.</div>}
    {s.level === "super" && s.pendingUsers > 0 && <div className="note-banner" role="note"><b>{s.pendingUsers} account{s.pendingUsers > 1 ? "s" : ""} waiting for approval.</b><Link className="btn sm" href="/users">Review</Link></div>}
    {s.level === "editor" ? <div className="bento">
      <div className="card s4"><h2>My drafts</h2>{list(s.myDrafts, "No drafts. Start a new article or open a page from Content.", "updatedAt", (b) => <Link className="btn sm" href={b.href}>Continue</Link>)}</div>
      <div className="card s4"><h2>Sent for review</h2>{list(s.myReview, "Nothing is waiting. After you send an article or page for review, it shows here until an admin publishes it.", "updatedAt")}</div>
      <div className="card s4"><h2>Recently published</h2>{list(s.recentPublished, "Nothing published yet.", "publishedAt")}</div></div>
    : <div className="bento">
      <div className="card s4"><div className="card-h"><h2>Needs your review {s.review > 0 && <span className="count-pill">{s.review}</span>}</h2><Link className="linkish" href="/content">See all</Link></div>
        {list(s.reviewQueue.slice(0, 3), "All caught up. Nothing is waiting for review.", "updatedAt", (b) => b.kind === "page" ? <Link className="btn sm orange" href={b.href}>Review</Link> : <button className="btn sm orange" disabled={!canPub} onClick={() => act(b.id, "publish")}>Publish</button>)}</div>
      <div className="card s4"><div className="card-h"><h2>Recently published</h2><Link className="linkish" href="/content">See all</Link></div>
        {list(s.recentPublished.slice(0, 3), "Nothing published yet.", "publishedAt", (b) => <button className="btn sm" onClick={() => act(b.id, "unpublish")}>Unpublish</button>)}</div>
      <WeekCard items={[...s.recentPublished.map((b: any) => ({ id: b.id, title: b.title, when: b.publishedAt, kind: "Published", href: b.href, site: b.website?.name })),
        ...s.reviewQueue.map((b: any) => ({ id: b.kind + b.id, title: b.title, when: b.updatedAt, kind: "Sent for review", href: b.href, site: b.website?.name }))].filter((x) => x.when)} />
      <div className="card s5"><div className="card-h"><h2>{s.level === "super" ? "Recent activity" : "Activity on your websites"}</h2><Link className="linkish" href="/activity">Open log</Link></div>
        {s.activity.length ? <ul className="feed">{s.activity.slice(0, 4).map((a) => <li key={a.id}><span className="feed-av" aria-hidden>{(a.user?.name ?? "S").slice(0, 1)}</span>
          <span className="feed-t">{a.summary ? a.summary[0].toUpperCase() + a.summary.slice(1) : ""}<small>{a.user?.name ?? "System"}</small></span><span className="feed-d">{fmt(a.createdAt)}</span></li>)}</ul>
          : <div className="empty-art"><QuietArt /><p>No activity yet.</p></div>}</div>
      {linked ? <div className="promo promo--ok s2"><PromoArt /><h3>You&apos;re live</h3><p>Your website reads from the CMS. What you publish appears there within seconds.</p>
        <Link className="btn promo-btn" href="/content?new=1">Write an article</Link></div>
      : <div className="promo s2"><PromoArt /><h3>Go live!</h3><p>Connect your website so what you publish appears there automatically.</p>
        <Link className="btn promo-btn" href={s.level === "super" ? "/websites" : "/content"}>{s.level === "super" ? "Connect" : "Open content"}</Link></div>}
      <div className="s5 stack">
        <div className="ring-row">
          <div className="card ring-card"><Ring pct={s.published + s.drafts ? Math.round((s.published / (s.published + s.drafts)) * 100) : 0} color="#1f9d55" />
            <div><small className="ring-k g">ARTICLES</small><b>Live</b><small>{s.published} live · {s.drafts} drafts</small></div></div>
          <div className="card ring-card"><Ring pct={health ? (health.canConnect === true ? 50 : 0) + (health.sessionSecretSet ? 50 : 0) : 0} color="#f26f2c" />
            <div><small className="ring-k o">SYSTEM</small><b>Health</b><small>{health?.canConnect === true ? "Database OK" : "Checking…"}</small></div></div>
        </div>
        <div className="card site-card"><div className="card-h"><h2>Your website</h2>{live && (linked ? <span className="badge PUBLISHED">Connected</span> : <span className="badge IN_REVIEW">Not connected yet</span>)}</div>
          <p className="mut" style={{ margin: "0 0 12px", fontSize: 13.5 }}>{live ? live.replace(/^https?:\/\//, "").replace(/\/$/, "") : "No website address set yet."}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{live && <a className="btn" href={live} target="_blank" rel="noreferrer">Open website</a>}
            <Link className="btn dark" href={s.level === "super" ? "/websites" : "/content"}>{s.level === "super" ? "Manage" : "Edit pages"}</Link></div>
          {health?.problem && <p className="err-text" style={{ marginTop: 10 }}>{health.problem}</p>}</div>
      </div>
    </div>}
    {el}
  </div>);
}
