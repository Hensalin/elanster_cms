// Writes the .env file for a first-time setup. Called by setup.bat.
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) { console.log(".env already exists - keeping it."); process.exit(0); }
const { DBURL, PGPASS, ADMINPASS, PGUSER = "postgres", PGPORT = "5432", ADMINEMAIL = "admin@elanster.com" } = process.env;
if (/['\r\n]/.test(ADMINPASS || "")) { console.error("Admin password must not contain a single quote ('). Please choose another."); process.exit(1); }
if (!(DBURL || PGPASS) || !ADMINPASS || ADMINPASS.length < 10) { console.error("Missing password, or admin password shorter than 10 characters."); process.exit(1); }
let databaseUrl = DBURL ? DBURL.trim().replace(/^["\']|["\']$/g, "") : `postgresql://${PGUSER}:${encodeURIComponent(PGPASS)}@localhost:${PGPORT}/elanster_cms`;
if (DBURL && !/sslmode=/.test(databaseUrl)) databaseUrl += (databaseUrl.includes("?") ? "&" : "?") + "sslmode=no-verify"; // hosted databases need SSL
if (DBURL && !/^postgres(ql)?:\/\//.test(databaseUrl)) { console.error("That does not look like a connection string (it should start with postgresql://)."); process.exit(1); }
writeFileSync(".env", [
  `DATABASE_URL="${databaseUrl}"`,
  `SESSION_SECRET="${randomBytes(32).toString("hex")}"`,
  `SEED_ADMIN_EMAIL="${ADMINEMAIL}"`,
  `SEED_ADMIN_PASSWORD='${ADMINPASS}'`, "",
].join("\n"));
console.log(".env created.");
