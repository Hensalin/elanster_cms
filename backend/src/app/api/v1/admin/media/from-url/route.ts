import { z } from "zod";
import { db, schema } from "@/db";
import { canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { safeFetch, sniffImage } from "@/lib/netguard";

// Imports a picture from a web link into the Media Library (the CMS stores its own copy).
const OK = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]; // no SVG: it can carry scripts
const MAX = 3_500_000;
const body = z.object({ websiteId: z.string().min(1), url: z.string().url().max(2000), alt: z.string().max(300).optional() });

export const POST = admin(async (req, _c, user) => {
  const { websiteId, url, alt } = body.parse(await req.json());
  if (!canEdit(await websiteRole(user, websiteId))) return fail("Forbidden", 403);
  let r: Awaited<ReturnType<typeof safeFetch>>;
  try { r = await safeFetch(url, { httpsOnly: true, maxBytes: MAX, timeoutMs: 10_000, headers: { accept: "image/*", "user-agent": "ElansterCMS/1.0" } }); }
  catch (e) { const m = (e as Error).message; return fail(/too large/i.test(m) ? "Image is too large. Keep it under 3.5 MB (add ?w=1600 to the link to make it smaller)." : m || "Could not open that link", 400); }
  if (!r.ok) return fail("Could not download that image (the link did not return a picture)", 400);
  const type = sniffImage(r.buf);   // the file itself must be a picture, whatever the server claims
  if (!type || !OK.includes(type)) return fail("That link is not a PNG, JPG, WebP, GIF or AVIF image", 400);
  const buf = r.buf; const u = r.url;
  const name = decodeURIComponent(u.pathname.split("/").pop() || "image").slice(0, 120) || "image";
  const [m] = await db.insert(schema.media).values({ websiteId, filename: "db", originalName: name, mimeType: type, size: buf.length, altText: alt || "", data: buf })
    .returning({ id: schema.media.id, originalName: schema.media.originalName, altText: schema.media.altText, size: schema.media.size });
  return json({ ...m, url: `${new URL(req.url).origin}/api/v1/media/${m.id}` }, 201);
});
