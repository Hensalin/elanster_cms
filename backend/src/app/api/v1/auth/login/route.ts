import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { blocked, clear, hit, ipOf } from "@/lib/ratelimit";

const body = z.object({ email: z.string().email(), password: z.string().min(1) });

// 8 wrong tries lock the email for 15 minutes; 30 tries per IP per 15 minutes. Kept in the database.
export async function POST(req: Request) { try {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter a valid email and password", 422);
  const email = parsed.data.email.toLowerCase();
  const key = "login:" + email;
  if (await blocked(key, 8) || await hit("login-ip:" + ipOf(req), 30, 900_000)) return fail("Too many attempts. Try again in 15 minutes.", 429);

  const [u] = await db.select().from(schema.users)
    .where(and(eq(schema.users.email, email), eq(schema.users.active, true), isNull(schema.users.deletedAt)));
  const ok = u ? await verifyPassword(parsed.data.password, u.passwordHash) : await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok) {
    await hit(key, 8, 900_000);
    // Failed sign-ins are recorded (never the password), so repeated guessing is visible in the activity log.
    await db.insert(schema.activityLogs).values({ userId: u?.id ?? null, action: "LOGIN_FAILED", summary: `Failed sign-in for ${email.slice(0, 120)}` }).catch(() => {});
    return fail("Wrong email or password", 401);
  }
  await clear(key);
  await createSession(u.id);
  await db.insert(schema.activityLogs).values({ userId: u.id, action: "LOGIN", summary: `${u.name} signed in` });
  return json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  } catch (e) { console.error(e); return fail("The CMS cannot reach its database right now. Try again in a minute.", 503); }
}
