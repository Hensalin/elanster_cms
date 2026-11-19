import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

/** Super Admin gives someone a new temporary password (shown once). They change it under My account after signing in. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (_req, { params }, me) => {
  const { id } = await params;
  if (id === me.id) return fail("Change your own password under My account.", 400);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u || u.deletedAt) return fail("Not found", 404);
  const temp = "Tmp-" + randomBytes(9).toString("base64url");
  await db.update(schema.users).set({ passwordHash: await hashPassword(temp) }).where(eq(schema.users.id, id));
  await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, "login:" + u.email.toLowerCase())).catch(() => {});
  await db.insert(schema.activityLogs).values({ userId: me.id, action: "USER_UPDATE", summary: `${me.name} reset the password of ${u.name}` });
  return json({ password: temp });
}, { superOnly: true });
