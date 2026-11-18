import { SignJWT } from "jose";
import { canEdit, websiteRole } from "@/lib/auth";
import { blogWithRelations } from "@/lib/blogs";
import { admin, fail, json } from "@/lib/http";

// Creates a private preview link that works for 30 minutes and only for this one article.
export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const b = await blogWithRelations((await params).id);
  if (!b || b.deletedAt) return fail("Not found", 404);
  if (!canEdit(await websiteRole(user, b.websiteId))) return fail("Forbidden", 403);
  const token = await new SignJWT({ blog: b.id, kind: "preview" }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m").sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
  return json({ url: `${new URL(req.url).origin}/preview/${token}` });
});
