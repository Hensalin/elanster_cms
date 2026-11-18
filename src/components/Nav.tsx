"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./ui";

const items = [
  { href: "/", label: "Dashboard" }, { href: "/websites", label: "Websites" },
  { href: "/pages", label: "Pages" }, { href: "/blogs", label: "Blogs" }, { href: "/media", label: "Media" },
];

export function Nav({ user }: { user: { name: string; email: string; role: string } }) {
  const path = usePathname(); const router = useRouter();
  return (
    <header className="topbar">
      <div className="brand"><i>E</i> Elanster CMS</div>
      <nav className="nav" aria-label="Main">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={(i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "on" : ""}>{i.label}</Link>
        ))}
      </nav>
      <div className="me"><div><b>{user.name}</b><small>{user.role.replace("_", " ").toLowerCase()}</small></div>
        <span className="avatar" aria-hidden>{user.name.slice(0, 1).toUpperCase()}</span>
        <button className="btn sm" onClick={async () => { await api("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>Sign out</button>
      </div>
    </header>
  );
}
