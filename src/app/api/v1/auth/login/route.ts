import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { fail, json } from "@/lib/http";

const body = z.object({ email: z.string().email(), password: z.string().min(1) });

// Tiny in-memory throttle: 8 failed tries per email+IP per 10 minutes.
const fails = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter a valid email and password", 422);
  const email = parsed.data.email.toLowerCase();
  const key = email + "|" + (req.headers.get("x-forwarded-for") ?? "local");
  const f = fails.get(key);
  if (f && Date.now() - f.t < 600_000 && f.n >= 8) return fail("Too many attempts. Try again in a few minutes.", 429);

  const [u] = await db.select().from(schema.users)
    .where(and(eq(schema.users.email, email), eq(schema.users.active, true), isNull(schema.users.deletedAt)));
  const ok = u ? await verifyPassword(parsed.data.password, u.passwordHash) : await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok) {
    fails.set(key, { n: (f && Date.now() - f.t < 600_000 ? f.n : 0) + 1, t: Date.now() });
    return fail("Wrong email or password", 401);
  }
  fails.delete(key);
  await createSession(u.id);
  await db.insert(schema.activityLogs).values({ userId: u.id, action: "LOGIN", summary: `${u.name} signed in` });
  return json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}
