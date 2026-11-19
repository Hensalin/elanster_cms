import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { admin, fail, json } from "@/lib/http";

/** The signed-in person changes their own name, email or password. Current password is always required. */
export const PATCH = admin(async (req, _c, me) => {
  const d = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(200),
    currentPassword: z.string().min(1), newPassword: z.string().min(10).max(100).optional().or(z.literal("")) }).parse(await req.json());
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, me.id));
  if (!u || !(await verifyPassword(d.currentPassword, u.passwordHash))) return fail("Your current password is not correct", 400);
  const email = d.email.toLowerCase();
  const [dup] = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.email, email), ne(schema.users.id, me.id)));
  if (dup) return fail("Another account already uses that email", 409);
  await db.update(schema.users).set({ name: d.name, email, ...(d.newPassword ? { passwordHash: await hashPassword(d.newPassword) } : {}) }).where(eq(schema.users.id, me.id));
  await db.insert(schema.activityLogs).values({ userId: me.id, action: "ACCOUNT_UPDATE", summary: `${d.name} updated their account${d.newPassword ? " and password" : ""}` });
  return json({ ok: true });
});
