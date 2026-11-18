import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Chrome } from "@/components/Chrome";
import { ToLogin } from "@/components/ToLogin";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getUser(); // reads the login cookie, so it must render at request time
  if (!user) return <ToLogin />;
  return <Chrome user={user}>{children}</Chrome>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="shell"><div className="frame"><main className="main">Loading…</main></div></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
