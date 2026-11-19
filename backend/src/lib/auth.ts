import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

const COOKIE = "cms_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
};

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export type SessionUser = {
  id: string; email: string; name: string; role: "SUPER_ADMIN" | "WEBSITE_ADMIN" | "EDITOR";
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId, t: Date.now() })   // t: when it was issued, in milliseconds
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 8,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

/** The logged-in user, re-read from the database on every request (so disabling a user works at once). */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await db.select().from(schema.users)
      .where(and(eq(schema.users.id, String(payload.sub)), eq(schema.users.active, true), isNull(schema.users.deletedAt)));
    if (!u) return null;
    // A sign-in from before a password change or reset is no longer valid.
    const issued = typeof payload.t === "number" ? payload.t : (payload.iat ?? 0) * 1000;
    if (u.sessionsValidAfter && issued < u.sessionsValidAfter.getTime()) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  } catch { return null; }
}

// ---- Permissions (enforced on the server for every admin request) ----

/** Role this user has on a website, or null if no access. */
export async function websiteRole(user: SessionUser, websiteId: string) {
  if (user.role === "SUPER_ADMIN") return "SUPER_ADMIN" as const;
  const [row] = await db.select().from(schema.websiteUsers).where(
    and(eq(schema.websiteUsers.userId, user.id), eq(schema.websiteUsers.websiteId, websiteId)));
  return row?.role ?? null;
}
export const canPublish = (r: string | null) => r === "SUPER_ADMIN" || r === "WEBSITE_ADMIN";
export const canEdit = (r: string | null) => r !== null;

/** Websites this user may see. */
/** The websites this person may see, never including removed websites. Super Admins: every website that still exists.
 *  (Still typed with "all" for older callers; it is no longer returned, so removed websites' content never shows up.) */
export async function accessibleWebsiteIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.role === "SUPER_ADMIN")
    return (await db.select({ id: schema.websites.id }).from(schema.websites).where(isNull(schema.websites.deletedAt))).map((r) => r.id);
  const rows = await db.select({ id: schema.websiteUsers.websiteId }).from(schema.websiteUsers)
    .innerJoin(schema.websites, eq(schema.websites.id, schema.websiteUsers.websiteId))
    .where(and(eq(schema.websiteUsers.userId, user.id), isNull(schema.websites.deletedAt)));
  return rows.map((r) => r.id);
}

/** Narrows the list to one website when the screen asks for it (?website=ID) and the person may see it. */
export function focusIds(ids: string[] | "all", req: Request): string[] {
  const list = ids === "all" ? [] : ids; const w = new URL(req.url).searchParams.get("website");
  return w ? (list.includes(w) ? [w] : ["-"]) : list.length ? list : ["-"];
}
