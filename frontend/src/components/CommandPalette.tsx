"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Newspaper, LayoutDashboard, Globe, Plus, LogOut, Search, Link2, History, Tags, UserCog, Users } from "lucide-react";
import { api } from "./ui";

type Cmd = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };

/** Ctrl+K: jump to any screen, article or page, or start something new. */
export function CommandPalette({ open, onClose, isSuper }: { open: boolean; onClose: () => void; isSuper: boolean }) {
  const router = useRouter(); const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const [items, setItems] = useState<{ pages: any[]; blogs: any[] }>({ pages: [], blogs: [] }); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => input.current?.focus(), 20); api("/api/v1/admin/pages").then((p) => setItems((x) => ({ ...x, pages: p }))).catch(() => {}); } }, [open]);
  useEffect(() => { if (!open || q.trim().length < 2) return; const t = setTimeout(() => api("/api/v1/admin/blogs?limit=6&q=" + encodeURIComponent(q.trim())).then((d) => setItems((x) => ({ ...x, blogs: d.items }))).catch(() => {}), 200); return () => clearTimeout(t); }, [q, open]);
  const go = (href: string) => () => { onClose(); router.push(href); };
  const cmds = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { id: "dash", label: "Go to Dashboard", hint: "Alt+1", icon: <LayoutDashboard size={16} />, run: go("/") },
      { id: "content", label: "Go to Content", hint: "Alt+2", icon: <FileText size={16} />, run: go("/content") },
      { id: "act", label: "Activity log", icon: <History size={16} />, run: go("/activity") },
      { id: "cats", label: "Categories", icon: <Tags size={16} />, run: go("/categories") },
      { id: "acc", label: "My account / change password", icon: <UserCog size={16} />, run: go("/account") },
      { id: "new", label: "New article", icon: <Plus size={16} />, run: go("/content?new=1") },
      { id: "conn", label: "Check website connection", icon: <Link2 size={16} />, run: go("/pages") },
    ];
    if (isSuper) base.splice(3, 0, { id: "users", label: "Go to Users", hint: "Alt+4", icon: <Users size={16} />, run: go("/users") }, { id: "sites", label: "Go to Websites", hint: "Alt+3", icon: <Globe size={16} />, run: go("/websites") });
    base.push({ id: "out", label: "Sign out", icon: <LogOut size={16} />, run: async () => { onClose(); await api("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); } });
    const s = q.trim().toLowerCase();
    const found: Cmd[] = s.length < 2 ? [] : [
      ...items.pages.filter((p) => (p.title + " " + p.slug).toLowerCase().includes(s)).slice(0, 5).map((p): Cmd => ({ id: "p" + p.id, label: p.title, hint: "Page · " + p.website?.name, icon: <FileText size={16} />, run: go(`/content?open=pages:${p.id}`) })),
      ...items.blogs.slice(0, 5).map((b): Cmd => ({ id: "b" + b.id, label: b.title, hint: "Article", icon: <Newspaper size={16} />, run: go(`/content?open=blogs:${b.id}`) })),
    ];
    return [...found, ...base.filter((c) => !s || c.label.toLowerCase().includes(s))];
  }, [q, items, isSuper]); // eslint-disable-line
  useEffect(() => setI(0), [q]);
  if (!open) return null;
  return (<div className="cp-back" onMouseDown={onClose}>
    <div className="cp" role="dialog" aria-modal="true" aria-label="Quick actions" onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(cmds.length - 1, x + 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
        if (e.key === "Enter") { e.preventDefault(); cmds[i]?.run(); }
      }}>
      <div className="cp-in"><Search size={16} aria-hidden /><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and articles, or type a command…" aria-label="Search" /><kbd>Esc</kbd></div>
      <ul role="listbox" aria-label="Results">
        {cmds.length ? cmds.map((c, n) => (<li key={c.id} role="option" aria-selected={n === i} className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={c.run}>
          <span className="ic">{c.icon}</span><span className="lb">{c.label}</span>{c.hint && <small>{c.hint}</small>}</li>)) : <li className="none">Nothing found. Try a different word.</li>}
      </ul></div></div>);
}
