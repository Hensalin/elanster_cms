"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Nav } from "./Nav";

type User = { name: string; email: string; role: string };

/** The page frame. Inside the slide-over editor (an iframe) it shows only the page itself, with no top bar. */
export function Chrome({ user, children }: { user: User; children: React.ReactNode }) {
  const sp = useSearchParams();
  const [embed, setEmbed] = useState(sp.get("embed") === "1");
  useEffect(() => { if (window.name === "cms-embed") setEmbed(true); }, []);
  useEffect(() => { document.documentElement.classList.toggle("is-embed", embed); }, [embed]);
  useEffect(() => { if (!embed) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") window.parent.postMessage("cms-close", window.location.origin); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [embed]);
  if (embed) return <div className="embed"><main className="main">{children}</main></div>;
  return (<div className="shell"><div className="frame"><Nav user={user} /><main className="main" id="main">{children}</main></div></div>);
}
