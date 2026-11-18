// Sets (or creates) the admin login from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.
// Use it if you forgot the admin password:  npm run db:reset-admin
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@elanster.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_ADMIN_PASSWORD (10+ characters) in .env first.");
  const passwordHash = await hashPassword(password);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (u) { await db.update(schema.users).set({ passwordHash, active: true, deletedAt: null, role: "SUPER_ADMIN" }).where(eq(schema.users.id, u.id)); console.log("Password reset for", email); }
  else { await db.insert(schema.users).values({ email, name: "Super Admin", passwordHash, role: "SUPER_ADMIN" }); console.log("Created admin", email); }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
