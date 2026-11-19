// Sets a new password for a CMS user (and makes them an active Super Admin).
// The password is typed here in this window only. Run: npm run db:set-password
import readline from "node:readline";
import bcrypt from "bcryptjs";
import pg from "pg";

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write("*"); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

const email = ((await ask("Email [hensalin131@gmail.com]: ")) || "hensalin131@gmail.com").toLowerCase();
const pw = await ask("New password (10+ characters, hidden): ", true);
const pw2 = await ask("Type it again: ", true);
if (pw.length < 10) { console.error("Password must be at least 10 characters."); process.exit(1); }
if (pw !== pw2) { console.error("The two passwords are different. Nothing changed."); process.exit(1); }

const url = process.env.DATABASE_URL || undefined;
const local = /localhost|127\.0\.0\.1|host=\//.test(url ?? "");
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const hash = await bcrypt.hash(pw, 12);
  const r = await client.query(
    "UPDATE users SET password_hash = $1, active = true, deleted_at = NULL, role = 'SUPER_ADMIN' WHERE lower(email) = $2",
    [hash, email]);
  if (r.rowCount === 0) {
    const { randomBytes } = await import("node:crypto");
    await client.query("INSERT INTO users (id, email, name, password_hash, role, active) VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', true)",
      [randomBytes(12).toString("hex"), email, "Super Admin", hash]);
    console.log("Created Super Admin", email);
  } else console.log("Password changed for", email);
  await client.query("DELETE FROM rate_limits WHERE key LIKE 'login%'").catch(() => {});
  console.log("You can sign in now at http://localhost:3000");
} catch (e) {
  console.error("Failed:", e.message); process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
