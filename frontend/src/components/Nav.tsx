"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, FileText, Globe, LayoutDashboard, LogOut, Moon, Plus, Search, Sun, Users, UserCog, History, Tags } from "lucide-react";
import { api } from "./ui";
import { useSite } from "./site";
import { CommandPalette } from "./CommandPalette";

type User = { name: string; email: string; role: string };
const roleName = (r: string) => (r === "SUPER_ADMIN" ? "Super Admin" : r === "WEBSITE_ADMIN" ? "Admin" : "Editor");

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [on]); // eslint-disable-line
}

const PAGE_NAMES: [string, string][] = [["/content", "Content"], ["/pages", "Website pages"], ["/blogs", "Article"], ["/websites", "Websites"], ["/users", "Users"],
  ["/activity", "Activity log"], ["/categories", "Categories"], ["/account", "My account"]];
const pageName = (p: string) => p === "/" ? "Dashboard" : (PAGE_NAMES.find(([k]) => p.startsWith(k))?.[1] ?? "Dashboard");

export function Nav({ user }: { user: User }) {
  const path = usePathname(); const router = useRouter(); const isSuper = user.role === "SUPER_ADMIN";
  const [site, setSite] = useSite(); const [sites, setSites] = useState<any[]>([]);
  const [swOpen, setSwOpen] = useState(false); const [menu, setMenu] = useState(false); const [cp, setCp] = useState(false); const [q, setQ] = useState("");
  const [dark, setDark] = useState(false);
  const swRef = useRef<HTMLDivElement>(null); const menuRef = useRef<HTMLDivElement>(null);
  useOutside(swRef, () => setSwOpen(false), swOpen); useOutside(menuRef, () => setMenu(false), menu);
  useEffect(() => { api("/api/v1/admin/websites").then(setSites).catch(() => {}); }, []);
  useEffect(() => { try { const d = localStorage.getItem("cms.theme") === "dark"; setDark(d); document.documentElement.dataset.theme = d ? "dark" : "light"; } catch { /* ignore */ } }, []);
  const items = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} />, key: "1" },
    { href: "/content", label: "Content", icon: <FileText size={16} />, key: "2" },
    ...(isSuper ? [{ href: "/websites", label: "Websites", icon: <Globe size={16} />, key: "3" }, { href: "/users", label: "Users", icon: <Users size={16} />, key: "4" }] : []),
  ];
  // Content also covers the older Pages / Blogs screens.
  const on = (h: string) => h === "/" ? path === "/" : h === "/content" ? ["/content", "/pages", "/blogs"].some((p) => path.startsWith(p)) : path.startsWith(h);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCp((x) => !x); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey) { const it = items.find((i) => i.key === e.key); if (it) { e.preventDefault(); router.push(it.href); } }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [isSuper]); // eslint-disable-line
  const cur = sites.find((s) => s.id === site);
  const shown = sites.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.domain || "").toLowerCase().includes(q.toLowerCase()));
  const toggleTheme = () => { const d = !dark; setDark(d); document.documentElement.dataset.theme = d ? "dark" : "light"; try { localStorage.setItem("cms.theme", d ? "dark" : "light"); } catch { /* ignore */ } };
  const railExtra = [
    { href: "/activity", label: "Activity log", icon: <History size={19} /> },
    { href: "/categories", label: "Categories", icon: <Tags size={19} /> },
  ];
  return (<>
    <a className="skip" href="#main">Skip to content</a>
    <aside className="rail" aria-label="Sections">
      <svg className="rail-shape" viewBox="0 0 96 560" preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id="railg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5874c" /><stop offset=".55" stopColor="#f26f2c" /><stop offset="1" stopColor="#e2581c" /></linearGradient></defs>
        <path d="M0 0 C0 46 80 34 80 104 L80 456 C80 526 0 514 0 560 Z" fill="url(#railg)" />
      </svg>
      <Link href="/" className="rail-logo" aria-label="Elanster CMS home">E</Link>
      <nav className="rail-nav">
        {items.map((i) => <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} aria-current={on(i.href) ? "page" : undefined} className={on(i.href) ? "on" : ""}>{React.cloneElement(i.icon as React.ReactElement<{ size?: number }>, { size: 19 })}</Link>)}
        <span className="rail-sep" />
        {railExtra.map((i) => <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} className={path.startsWith(i.href) ? "on" : ""}>{i.icon}</Link>)}
      </nav>
      <Link href="/account" className={"rail-me" + (path.startsWith("/account") ? " on" : "")} title="My account" aria-label="My account"><UserCog size={19} /></Link>
    </aside>
    <header className="topbar">
      <div className="crumb" aria-label="You are here"><span className="mut">Elanster CMS</span><span className="mut">/</span><b>{pageName(path)}</b></div>
      <div className="tb-left">
        <Link href="/" className="brand" aria-label="Elanster CMS home"><i>E</i><span>Elanster CMS</span></Link>
        <div className="menu-wrap" ref={swRef}>
          <button className="sw" aria-haspopup="listbox" aria-expanded={swOpen} onClick={() => { setSwOpen((x) => !x); setQ(""); }}>
            <Globe size={15} aria-hidden /><span>{cur ? cur.name : "All websites"}</span><ChevronDown size={14} aria-hidden /></button>
          {swOpen && <div className="pop sw-pop" role="listbox" aria-label="Choose a website">
            <div className="pop-search"><Search size={14} aria-hidden /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search websites…" aria-label="Search websites" /></div>
            <button role="option" aria-selected={!site} onClick={() => { setSite(""); setSwOpen(false); }}><span>All websites</span>{!site && <Check size={14} />}</button>
            {shown.map((s) => <button key={s.id} role="option" aria-selected={s.id === site} onClick={() => { setSite(s.id); setSwOpen(false); }}>
              <span>{s.name}<small>{(s.domain || "").replace(/^https?:\/\//, "") || "no address yet"}</small></span>{s.id === site && <Check size={14} />}</button>)}
            {!shown.length && <p className="pop-none">No website matches.</p>}
            {isSuper && <Link className="pop-add" href="/websites" onClick={() => setSwOpen(false)}><Plus size={14} /> Add website</Link>}
          </div>}
        </div>
      </div>
      <nav className="nav" aria-label="Main">
        {items.map((i) => (<Link key={i.href} href={i.href} title={`${i.label} (Alt+${i.key})`} aria-current={on(i.href) ? "page" : undefined} className={on(i.href) ? "on" : ""}>{i.icon}<span>{i.label}</span></Link>))}
      </nav>
      <div className="me">
        <Link className="btn dark new-btn" href="/content?new=1"><Plus size={15} /> <span>New article</span></Link>
        <button className="icon-btn wide" onClick={() => setCp(true)} aria-label="Search and quick actions (Ctrl+K)"><Search size={15} /><span>Search</span><kbd>Ctrl K</kbd></button>
        <div className="theme-seg" role="group" aria-label="Theme">
          <button className={!dark ? "on" : ""} aria-pressed={!dark} onClick={() => dark && toggleTheme()}><Sun size={14} /> <span>Light</span></button>
          <button className={dark ? "on" : ""} aria-pressed={dark} onClick={() => !dark && toggleTheme()}><Moon size={14} /> <span>Dark</span></button></div>
        <div className="menu-wrap" ref={menuRef}>
          <button className="avatar-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)} aria-label="Account menu">
            <span className="avatar" aria-hidden>{user.name.slice(0, 1).toUpperCase()}</span></button>
          {menu && <div className="pop me-pop" role="menu">
            <div className="me-info"><b>{user.name}</b><small>{user.email}</small><span className="role-chip">{roleName(user.role)}</span></div>
            {[["/account", "My account", <UserCog size={14} key="a" />], ["/activity", "Activity log", <History size={14} key="c" />], ["/categories", "Categories", <Tags size={14} key="d" />]].map(([h, l, ic]) =>
              <button role="menuitem" key={h as string} onClick={() => { setMenu(false); router.push(h as string); }}>{ic} {l}</button>)}
            <hr className="pop-sep" />
            <button role="menuitem" onClick={async () => { await api("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut size={14} /> Sign out</button>
          </div>}
        </div>
      </div>
    </header>
    <CommandPalette open={cp} onClose={() => setCp(false)} isSuper={isSuper} />
  </>);
}
