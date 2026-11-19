import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds, canEdit, websiteRole } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";
import { sniffImage } from "@/lib/netguard";

const OK = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]; // no SVG: it can carry scripts
const MAX = 3_500_000;                                                            // Vercel allows ~4.5 MB per request

const cols = { id: schema.media.id, websiteId: schema.media.websiteId, originalName: schema.media.originalName, mimeType: schema.media.mimeType,
  size: schema.media.size, altText: schema.media.altText, createdAt: schema.media.createdAt };

export const GET = admin(async (req, _c, user) => {
  const site = new URL(req.url).searchParams.get("website");
  const ids = await accessibleWebsiteIds(user);
  const conds = [isNull(schema.media.deletedAt)];
  if (ids !== "all") conds.push(inArray(schema.media.websiteId, ids.length ? ids : ["-"]));
  if (site) conds.push(eq(schema.media.websiteId, site));
  const rows = await db.select(cols).from(schema.media).where(and(...conds)).orderBy(desc(schema.media.createdAt)).limit(300);
  const origin = new URL(req.url).origin;
  return json(rows.map((m) => ({ ...m, url: `${origin}/api/v1/media/${m.id}` })));
});

export const POST = admin(async (req, _c, user) => {
  const form = await req.formData();
  const file = form.get("file"); const websiteId = String(form.get("websiteId") || "");
  if (!(file instanceof File) || !websiteId) return fail("Choose an image and a website", 400);
  if (!canEdit(await websiteRole(user, websiteId))) return fail("Forbidden", 403);
  if (!OK.includes(file.type)) return fail("Only PNG, JPG, WebP, GIF or AVIF images are allowed", 400);
  if (file.size > MAX) return fail("Image is too large. Keep it under 3.5 MB.", 400);
  const data = Buffer.from(await file.arrayBuffer());
  const real = sniffImage(data);   // check the file's own bytes: a renamed file or a fake image type is refused
  if (!real || !OK.includes(real)) return fail("That file is not a real PNG, JPG, WebP, GIF or AVIF image", 400);
  const [m] = await db.insert(schema.media).values({ websiteId, filename: "db", originalName: file.name.replace(/[\u0000-\u001f<>"]/g, "").slice(0, 200), mimeType: real,
    size: file.size, altText: String(form.get("alt") || ""), data }).returning(cols);
  return json({ ...m, url: `${new URL(req.url).origin}/api/v1/media/${m.id}` }, 201);
});
