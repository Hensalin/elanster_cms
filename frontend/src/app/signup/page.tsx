"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/ui";

export default function Signup() {
  const [f, setF] = useState({ name: "", email: "", password: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/v1/auth/signup", { method: "POST", body: f }); setDone(true); } catch (x) { setErr((x as Error).message); } setBusy(false); }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (<div className="auth"><form onSubmit={submit}>
    <div className="brand" style={{ padding: 0, marginBottom: 18 }}><i>E</i> Elanster CMS</div>
    {done ? <><h1 style={{ fontSize: 24 }}>Request sent</h1><p style={{ color: "var(--muted)" }}>Thanks! A Super Admin must approve your account before you can sign in. You will have access to the websites they choose for you.</p><Link className="btn dark" style={{ width: "100%", justifyContent: "center" }} href="/login">Back to sign in</Link></>
    : <><h1 style={{ fontSize: 24 }}>Create account</h1><p style={{ color: "var(--muted)", marginTop: 4 }}>New accounts start as Editor and need approval.</p>
      <div className="field"><label htmlFor="n">Full name</label><input id="n" type="text" required autoComplete="name" value={f.name} onChange={set("name")} /></div>
      <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={set("password")} /><small style={{ color: "var(--muted)" }}>At least 10 characters.</small></div>
      {err && <p className="err-text" role="alert">{err}</p>}
      <button className="btn dark" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>{busy ? "Sending…" : "Request account"}</button>
      <p style={{ textAlign: "center", marginTop: 14 }}>Already have an account? <Link href="/login"><b>Sign in</b></Link></p></>}
  </form></div>);
}
