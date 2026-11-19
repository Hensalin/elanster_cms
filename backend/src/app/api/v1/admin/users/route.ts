import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { admin, json } from "@/lib/http";

/** People who can be chosen as an article author. */
export const GET = admin(async () => {
  const rows = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users)
    .where(and(eq(schema.users.active, true), isNull(schema.users.deletedAt))).orderBy(asc(schema.users.name));
  return json(rows);
});
