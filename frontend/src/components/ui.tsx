"use client";
import { useEffect, useState } from "react";

/** fetch wrapper: sends the login cookie, throws a readable Error on failure. */
export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? "GET", credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details ? " " + Object.entries(data.details).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
    throw new Error((data.error ?? "Something went wrong") + detail);
  }
  return data as T;
}

export function useToast() {
  const [t, setT] = useState<{ msg: string; err?: boolean } | null>(null);
  useEffect(() => { if (t) { const x = setTimeout(() => setT(null), 3500); return () => clearTimeout(x); } }, [t]);
  const el = t ? <div className={"toast" + (t.err ? " err" : "")} role="status">{t.msg}</div> : null;
  return { toast: (msg: string, err = false) => setT({ msg, err }), el };
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", IN_REVIEW: "In review", SCHEDULED: "Scheduled", PUBLISHED: "Published", UNPUBLISHED: "Unpublished",
};
export const Status = ({ s }: { s: string }) => <span className={"badge " + s}>{STATUS_LABEL[s] ?? s}</span>;
export const fmt = (d?: string | null) => d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
