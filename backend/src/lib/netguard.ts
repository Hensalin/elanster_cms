import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/* Everything the server downloads from addresses people type (website sync, connection check, image links)
   goes through here, so the server can never be pointed at its own private network (SSRF). */

/** True for addresses that must never be fetched from the server: loopback, private, link-local, cloud metadata, multicast. */
export function isPrivateIp(ip: string): boolean {
  let v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v); if (mapped) v = mapped[1];
  if (v.includes(":")) {
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")
      || v.startsWith("ff") || v.startsWith("64:ff9b") || v.startsWith("2001:db8") || v.startsWith("::ffff:");
  }
  const [a, b] = v.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** Throws if the address is not a public http(s) address. Local test setups can allow private addresses with ALLOW_PRIVATE_FETCH=1. */
export async function assertPublicUrl(u: URL, httpsOnly = false) {
  const local = !!process.env.ALLOW_PRIVATE_FETCH;
  if (u.protocol !== "https:" && !(u.protocol === "http:" && (!httpsOnly || local))) throw new Error(httpsOnly ? "Use an https:// link" : "Use an http(s):// address");
  if (u.username || u.password) throw new Error("Addresses with a user name or password are not allowed");
  if (local) return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("That address is not allowed");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("That address is not allowed");
}

/** Fetches a public address: checks every redirect, stops after `timeoutMs`, and never reads more than `maxBytes`. */
export async function safeFetch(url: string | URL, opts: { maxBytes?: number; timeoutMs?: number; headers?: Record<string, string>; httpsOnly?: boolean } = {}) {
  const max = opts.maxBytes ?? 5_000_000;
  let u = new URL(url); let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(u, opts.httpsOnly);
    res = await fetch(u, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 9000), headers: opts.headers });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u); res = null; continue; }
    break;
  }
  if (!res) throw new Error("Too many redirects");
  const len = Number(res.headers.get("content-length") || 0);
  if (len > max) throw new Error("The file is too large");
  // Read the body in pieces and stop as soon as it is too large (a missing or false content-length cannot exhaust memory).
  const chunks: Uint8Array[] = []; let size = 0;
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel().catch(() => {}); throw new Error("The file is too large"); } chunks.push(value); }
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { ok: res.ok, status: res.status, headers: res.headers, url: u, buf, text: () => buf.toString("utf8") };
}

/** The real type of an image, read from its first bytes (the name or the browser's claim is not trusted). */
export function sniffImage(b: Uint8Array): string | null {
  const s = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0x89 && s(1, 3) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (s(0, 6) === "GIF87a" || s(0, 6) === "GIF89a") return "image/gif";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "image/webp";
  if (s(4, 4) === "ftyp" && /^(avif|avis)$/.test(s(8, 4))) return "image/avif";
  return null;
}
