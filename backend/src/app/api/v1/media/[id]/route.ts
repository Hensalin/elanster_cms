import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

/** Public image file. Anyone with the link can view it (the id is random), like an image on a website. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [m] = await db.select({ data: schema.media.data, type: schema.media.mimeType }).from(schema.media)
    .where(and(eq(schema.media.id, id), isNull(schema.media.deletedAt)));
  if (!m?.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), { headers: {
    "Content-Type": m.type, "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" } });
}
