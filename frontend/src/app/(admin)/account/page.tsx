"use client";
import { useEffect, useState } from "react";
import { api, useToast } from "@/components/ui";

export default function Account() {
  const { toast, el } = useToast(); const [f, setF] = useState({ name: "", email: "", currentPassword: "", newPassword: "", confirm: "" }); const [busy, setBusy] = useState(false); const [role, setRole] = useState("");
  useEffect(() => { api("/api/v1/auth/me").then((m) => { setF((x) => ({ ...x, name: m.user.name, email: m.user.email })); setRole(m.user.role); }).catch(() => {}); }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.newPassword && f.newPassword !== f.confirm) { toast("The two new passwords do not match", true); return; }
    if (f.newPassword && f.newPassword.length < 10) { toast("The new password needs at least 10 characters", true); return; }
    setBusy(true);
    try { await api("/api/v1/admin/account", { method: "PATCH", body: { name: f.name, email: f.email, currentPassword: f.currentPassword, newPassword: f.newPassword } }); toast(f.newPassword ? "Saved. Use your new password next time you sign in." : "Saved"); setF({ ...f, currentPassword: "", newPassword: "", confirm: "" }); }
    catch (x) { toast((x as Error).message, true); } finally { setBusy(false); }
  }
  return (<>
    <div className="head"><div><h1>My account</h1><p>Your name, email and password. {role && <span className="role-chip">{role === "SUPER_ADMIN" ? "Super Admin" : role === "WEBSITE_ADMIN" ? "Website Admin" : "Editor"}</span>}</p></div></div>
    <form className="card narrow" onSubmit={save}>
      <div className="field"><label htmlFor="an">Full name</label><input id="an" type="text" required autoComplete="name" value={f.name} onChange={set("name")} /></div>
      <div className="field"><label htmlFor="ae">Email (used to sign in)</label><input id="ae" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></div>
      <h2 style={{ marginTop: 20 }}>Change password</h2><p className="mut" style={{ marginTop: -6 }}>Leave empty to keep your current password.</p>
      <div className="field"><label htmlFor="np">New password</label><input id="np" type="password" autoComplete="new-password" minLength={10} value={f.newPassword} onChange={set("newPassword")} /><small>At least 10 characters.</small></div>
      <div className="field"><label htmlFor="nc">Type the new password again</label><input id="nc" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} /></div>
      <hr className="sep" />
      <div className="field"><label htmlFor="cp">Current password (required to save)</label><input id="cp" type="password" required autoComplete="current-password" value={f.currentPassword} onChange={set("currentPassword")} /></div>
      <button className="btn dark" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form>{el}</>);
}
