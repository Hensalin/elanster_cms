"use client";
import { LogoMark } from "@/components/Logo";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/v1/auth/login", { method: "POST", body: { email, password } }); router.push("/"); router.refresh(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div className="auth">
      <form onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}><LogoMark size={32} /> Elanster CMS</div>
        <h1 style={{ fontSize: 24 }}>Sign in</h1>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>Manage content for all your websites.</p>
        <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn dark" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p style={{ textAlign: "center", marginTop: 14 }}>New here? <Link href="/signup"><b>Create an account</b></Link></p>
      </form>
    </div>
  );
}
