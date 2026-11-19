import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { db, schema } from "@/db";
import { canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

// Imports a picture from a web link into the Media Library (the CMS stores its own copy).
const OK = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]; // no SVG: it can carry scripts
const MAX = 3_500_000;
const body = z.object({ websiteId: z.string().min(1), url: z.string().url().max(2000), alt: z.string().max(300).optional() });

/** True for addresses that must never be fetched from the server (internal networks). */
function isPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function checkHost(u: URL) {
  if (u.protocol !== "https:" && !(process.env.ALLOW_PRIVATE_FETCH && u.protocol === "http:")) throw new Error("Use an https:// image link");
  if (process.env.ALLOW_PRIVATE_FETCH) return; // local testing only
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivate)) throw new Error("That address is not allowed");
}

export const POST = admin(async (req, _c, user) => {
  const { websiteId, url, alt } = body.parse(await req.json());
  if (!canEdit(await websiteRole(user, websiteId))) return fail("Forbidden", 403);
  let res: Response | null = null; let u = new URL(url);
  try {
    for (let hop = 0; hop < 4; hop++) {                    // follow a few redirects, checking every address
      await checkHost(u);
      res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { accept: "image/*", "user-agent": "ElansterCMS/1.0" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { u = new URL(res.headers.get("location")!, u); res = null; continue; }
      break;
    }
  } catch (e) { return fail((e as Error).message || "Could not open that link", 400); }
  if (!res || !res.ok) return fail("Could not download that image (the link did not return a picture)", 400);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!OK.includes(type)) return fail("That link is not a PNG, JPG, WebP, GIF or AVIF image", 400);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) return fail("Image is too large. Keep it under 3.5 MB (add ?w=1600 to the link to make it smaller).", 400);
  const name = decodeURIComponent(u.pathname.split("/").pop() || "image").slice(0, 120) || "image";
  const [m] = await db.insert(schema.media).values({ websiteId, filename: "db", originalName: name, mimeType: type, size: buf.length, altText: alt || "", data: buf })
    .returning({ id: schema.media.id, originalName: schema.media.originalName, altText: schema.media.altText, size: schema.media.size });
  return json({ ...m, url: `${new URL(req.url).origin}/api/v1/media/${m.id}` }, 201);
});
