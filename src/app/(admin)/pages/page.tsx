"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmt, Status, useToast } from "@/components/ui";

export default function Pages() {
  const [sites, setSites] = useState<any[]>([]); const [site, setSite] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const { toast, el } = useToast(); const file = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState(false); const [checks, setChecks] = useState<any[] | null>(null); const [open, setOpen] = useState(false); const [addr, setAddr] = useState("https://websiteelanster.vercel.app"); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setRows(await api("/api/v1/admin/pages" + (site ? "?website=" + site : ""))); } catch (e) { toast((e as Error).message, true); }
  }, [site]); // eslint-disable-line
  useEffect(() => { api("/api/v1/admin/websites").then((s) => { setSites(s); }); }, []);
  useEffect(() => { load(); }, [load]);
  const connect = async () => {
    const target = site || sites[0]?.id; if (!target) return toast("Add a website first", true);
    setBusy(true);
    try {
      await api(`/api/v1/admin/websites/${target}`, { method: "PUT", body: { domain: addr.trim().replace(/\/$/, "") } });
      const r = await api(`/api/v1/admin/websites/${target}/import-pages`, { method: "POST" });
      toast(`Connected. ${r.created} page(s) imported, ${r.updated} refreshed`); setDone(true); load();
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  const check = async () => {
    const target = site || sites[0]?.id; if (!target) return;
    setChecks([]); try { setChecks(await api(`/api/v1/admin/websites/${target}/check`)); } catch (e) { setChecks(null); toast((e as Error).message, true); }
  };
  const download = async () => {
    const target = site || sites[0]?.id;
    try {
      const r = await api(`/api/v1/admin/websites/${target}/connection-file`, { method: "POST" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([r.content], { type: "text/javascript" })); a.download = r.filename; a.click();
      toast("Downloaded cms-config.js");
    } catch (e) { toast((e as Error).message, true); }
  };
  const importFile = async (f: File) => {
    const target = site || sites[0]?.id;
    if (!target) return toast("Add a website first", true);
    try {
      const r = await api(`/api/v1/admin/websites/${target}/import-pages`, { method: "POST", body: JSON.parse(await f.text()) });
      toast(`Imported: ${r.created} new page(s), ${r.updated} refreshed`); load();
    } catch (e) { toast("Import failed: " + (e as Error).message, true); }
  };
  return (<>
    <div className="head"><div><h1>Pages</h1><p>Edit the text of your website pages. The design stays exactly as it is on your site.</p></div>
      <div><input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        <button className="btn" onClick={check}>Check live connection</button>{" "}<button className="btn" onClick={() => file.current?.click()}>Import from file</button>{" "}
        <button className="btn orange" onClick={() => { setDone(false); setOpen(true); }}>Connect website</button></div></div>
    <div className="toolbar"><select aria-label="Website" value={site} onChange={(e) => setSite(e.target.value)}><option value="">All websites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    {!rows ? <p>Loading…</p> : !rows.length ? <div className="empty">No pages yet. Click <b>Connect website</b> to bring in all the text from your site.</div> :
      <div className="card" style={{ padding: 0, overflowX: "auto" }}><table>
        <thead><tr><th>Page</th><th>Website</th><th>Status</th><th>Edited texts</th><th>Last published</th><th></th></tr></thead>
        <tbody>{rows.map((p) => (<tr key={p.id}>
          <td><Link href={`/pages/${p.id}`}><b>{p.title}</b></Link><br /><small style={{ color: "var(--muted)" }}>{p.slug === "_global" ? "Header & footer on every page" : "/" + p.slug}</small></td>
          <td>{p.website?.name}</td>
          <td><Status s={p.status} />{p.unpublished && <> <span className="badge IN_REVIEW">Unpublished changes</span></>}</td>
          <td>{p.editedCount} of {p.fieldCount}</td><td>{fmt(p.publishedAt)}</td>
          <td style={{ textAlign: "right" }}><Link className="btn sm" href={`/pages/${p.id}`}>Edit content</Link></td>
        </tr>))}</tbody></table></div>}
    {open && <div className="modal" onClick={() => setOpen(false)}><div onClick={(e) => e.stopPropagation()}>
      <h2>Connect your website</h2>
      {!done ? <>
        <p style={{ color: "var(--muted)" }}>Step 1 of 2. Enter your live website address. The CMS shows it in the editor and brings in every page&apos;s text. Your design is not changed.</p>
        <div className="field"><label htmlFor="addr">Website address</label><input id="addr" type="text" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="https://www.example.com" /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn orange" disabled={busy || !addr.trim()} onClick={connect}>{busy ? "Connecting…" : "Connect & import pages"}</button></div>
      </> : <>
        <p style={{ color: "var(--muted)" }}>Step 2 of 2. Make your live website read from this CMS, so everything you <b>Publish</b> appears on it:</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li><button className="btn sm orange" onClick={download}>Download cms-config.js</button></li>
          <li>Put the file in your website folder, inside <code>js</code>, replacing the one that is there.</li>
          <li>Push the website to GitHub. Vercel redeploys it.</li>
          <li>Come back here and press <b>Check live connection</b>.</li>
        </ol>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>You do this once. After that, Publish changes the live website instantly, with no redeploy.</p>
        <div style={{ textAlign: "right" }}><button className="btn" onClick={() => setOpen(false)}>Done</button></div>
      </>}
    </div></div>}
    {checks && <div className="modal" onClick={() => setChecks(null)}><div onClick={(e) => e.stopPropagation()}>
      <h2>Is the live website connected?</h2>
      {!checks.length ? <p>Checking…</p> : checks.map((c, i) => <div key={i} className="row"><div><b>{c.ok ? "✓" : "✗"} {c.label}</b>{!c.ok && c.hint && <small>{c.hint}</small>}</div></div>)}
      <div style={{ textAlign: "right", marginTop: 14 }}><button className="btn" onClick={() => setChecks(null)}>Close</button></div></div></div>}
    {el}
  </>);
}
