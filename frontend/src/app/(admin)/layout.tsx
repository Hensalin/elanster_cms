"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "@/components/Chrome";

type User = { id: string; name: string; email: string; role: string };

/** Asks the backend who is signed in. Not signed in → sign-in page. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/v1/auth/me", { cache: "no-store" }).then(async (r) => { if (r.ok) setUser((await r.json()).user); else router.replace("/login"); }).catch(() => router.replace("/login"));
  }, [router]);
  if (!user) return <div className="shell"><div className="frame"><main className="main"><div className="skel" aria-busy="true" aria-label="Loading"><div /><div /><div /></div></main></div></div>;
  return <Suspense fallback={null}><Chrome user={user}>{children}</Chrome></Suspense>;
}
