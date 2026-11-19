import { NextResponse } from "next/server";

/** Safe self-check: says how the database address is set and which host it points to. Never shows the password. */
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  const pg = { PGHOST: !!process.env.PGHOST, PGPORT: !!process.env.PGPORT, PGUSER: !!process.env.PGUSER, PGDATABASE: !!process.env.PGDATABASE, PGPASSWORD: !!process.env.PGPASSWORD };
  let host = "", port = "", problem = "", mode = "";
  if (raw) {
    mode = "DATABASE_URL";
    try { const u = new URL(raw); host = u.hostname; port = u.port; if ((raw.match(/@/g) ?? []).length > 1) problem = "The address has more than one @ sign (the password probably contains @)"; }
    catch { problem = "DATABASE_URL is not a valid address (special characters in the password?)"; }
  } else if (pg.PGHOST) {
    mode = "PG variables"; host = process.env.PGHOST ?? ""; port = process.env.PGPORT ?? "5432";
    const missing = Object.entries(pg).filter(([, v]) => !v).map(([k]) => k); if (missing.length) problem = "Missing: " + missing.join(", ");
  } else problem = "No database settings found. Add PGHOST, PGPORT, PGUSER, PGDATABASE and PGPASSWORD (or DATABASE_URL) for Production, then Redeploy.";
  let canConnect: boolean | string = "not tested";
  try { const { db } = await import("@/db"); const { sql } = await import("drizzle-orm"); await db.execute(sql`select 1`); canConnect = true; } catch (e) { canConnect = false; problem = problem || "Could not connect: " + ((e as { cause?: { code?: string; message?: string } }).cause?.code ?? (e as Error).message).toString().slice(0, 120); }
  return NextResponse.json({ mode, host, port, sessionSecretSet: !!process.env.SESSION_SECRET, canConnect, problem: problem || null });
}
