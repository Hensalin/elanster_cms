import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { ToLogin } from "@/components/ToLogin";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getUser(); // reads the login cookie, so it must render at request time
  if (!user) return <ToLogin />;
  return (<div className="shell"><Nav user={user} /><main className="main">{children}</main></div>);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="shell"><aside className="side" /><main className="main">Loading…</main></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
