"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./ui";

const items = [
  { href: "/", label: "Dashboard", on: true }, { href: "/websites", label: "Websites", on: true },
  { href: "/blogs", label: "Blogs / Articles", on: true },
  { label: "Pages" }, { label: "Page Sections" }, { label: "Media Library" }, { label: "Categories" },
  { label: "SEO Management" }, { label: "Users & Roles" }, { label: "Settings" },
] as { href?: string; label: string; on?: boolean }[];

export function Nav({ user }: { user: { name: string; email: string; role: string } }) {
  const path = usePathname(); const router = useRouter();
  return (
    <aside className="side">
      <div className="brand"><i>E</i> Elanster CMS</div>
      <nav className="nav" aria-label="Main">
        {items.map((i) => i.on && i.href ? (
          <Link key={i.label} href={i.href} className={(i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "on" : ""}>{i.label}</Link>
        ) : (<span key={i.label}>{i.label}<small>Soon</small></span>))}
      </nav>
      <div className="me"><b>{user.name}</b>{user.email}<br /><small>{user.role.replace("_", " ").toLowerCase()}</small>
        <button className="btn sm" onClick={async () => { await api("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>Sign out</button>
      </div>
    </aside>
  );
}
