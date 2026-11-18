import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";

// Who am I, and what role do I have on each website (the UI uses this only to show/hide buttons;
// the server re-checks every action).
export async function GET() {
  const user = await getUser();
  if (!user) return fail("Not signed in", 401);
  const rows = await db.select().from(schema.websiteUsers).where(eq(schema.websiteUsers.userId, user.id));
  return json({ user, websiteRoles: Object.fromEntries(rows.map((r) => [r.websiteId, r.role])) });
}
