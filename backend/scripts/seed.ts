// Creates the first Super Admin and your websites. Safe to run more than once.
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@elanster.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_ADMIN_PASSWORD (10+ characters) before seeding.");

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!existing) {
    await db.insert(schema.users).values({ email, name: "Super Admin", passwordHash: await hashPassword(password), role: "SUPER_ADMIN" });
    console.log("Created Super Admin:", email);
  } else console.log("Super Admin already exists:", email);

  const sites = [
    { name: "Elanster Technologies", slug: "elanster", domain: "https://www.elanster.com" },
    { name: "We Are Zion", slug: "we-are-zion", domain: "" },
    { name: "Indzara", slug: "indzara", domain: "" },
  ];
  for (const s of sites) {
    const [x] = await db.select().from(schema.websites).where(eq(schema.websites.slug, s.slug));
    if (!x) { await db.insert(schema.websites).values(s); console.log("Created website:", s.name); }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
