import { isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { admin, json } from "@/lib/http";

export const GET = admin(async () => {
  const us = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, active: schema.users.active, createdAt: schema.users.createdAt })
    .from(schema.users).where(isNull(schema.users.deletedAt)).orderBy(schema.users.createdAt);
  const wu = await db.select().from(schema.websiteUsers);
  return json(us.map((u) => ({ ...u, sites: wu.filter((w) => w.userId === u.id).map((w) => ({ websiteId: w.websiteId, role: w.role })) })));
}, { superOnly: true });
