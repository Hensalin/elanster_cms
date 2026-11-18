// Writes the .env file for a first-time setup. Called by setup.bat.
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) { console.log(".env already exists - keeping it."); process.exit(0); }
const { PGPASS, ADMINPASS, PGUSER = "postgres", PGPORT = "5432", ADMINEMAIL = "admin@elanster.com" } = process.env;
if (/['\r\n]/.test(ADMINPASS || "")) { console.error("Admin password must not contain a single quote ('). Please choose another."); process.exit(1); }
if (!PGPASS || !ADMINPASS || ADMINPASS.length < 10) { console.error("Missing password, or admin password shorter than 10 characters."); process.exit(1); }
writeFileSync(".env", [
  `DATABASE_URL="postgresql://${PGUSER}:${encodeURIComponent(PGPASS)}@localhost:${PGPORT}/elanster_cms"`,
  `SESSION_SECRET="${randomBytes(32).toString("hex")}"`,
  `SEED_ADMIN_EMAIL="${ADMINEMAIL}"`,
  `SEED_ADMIN_PASSWORD='${ADMINPASS}'`, "",
].join("\n"));
console.log(".env created.");
