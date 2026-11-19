import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { hit, ipOf } from "@/lib/ratelimit";

const body = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(200), password: z.string().min(10).max(100) });

/** Anyone can ask for an account, but it stays switched off (no access at all) until a Super Admin approves it. */
export async function POST(req: Request) {
  try {
    if (await hit("signup:" + ipOf(req), 5, 3_600_000)) return fail("Too many requests. Try again later.", 429);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail("Enter your name, a valid email and a password of at least 10 characters", 422);
    const email = p.data.email.toLowerCase();
    const [dup] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    // Same answer whether or not the email exists, so nobody can discover who has an account.
    if (!dup) {
      const [u] = await db.insert(schema.users).values({ name: p.data.name, email, passwordHash: await hashPassword(p.data.password), role: "EDITOR", active: false }).returning({ id: schema.users.id });
      await db.insert(schema.activityLogs).values({ userId: u.id, action: "SIGNUP", summary: `${p.data.name} (${email}) asked for an account` });
    }
    return json({ ok: true });
  } catch (e) { console.error(e); return fail("Server error", 500); }
}
