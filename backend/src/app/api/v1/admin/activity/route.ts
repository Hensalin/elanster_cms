import { and, desc, eq, gte, ilike, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessibleWebsiteIds } from "@/lib/auth";
import { admin, json } from "@/lib/http";

export const GET = admin(async (req, _c, user) => {
  const u = new URL(req.url); const ids = await accessibleWebsiteIds(user);
  const site = u.searchParams.get("website"), who = u.searchParams.get("user"), q = u.searchParams.get("q"), days = Number(u.searchParams.get("days") || 0);
  const where = and(
    user.role === "SUPER_ADMIN" ? or(isNull(schema.activityLogs.websiteId), inArray(schema.activityLogs.websiteId, ids === "all" || !ids.length ? ["-"] : ids))
      : inArray(schema.activityLogs.websiteId, ids === "all" || !ids.length ? ["-"] : ids),
    site ? or(eq(schema.activityLogs.websiteId, site), isNull(schema.activityLogs.websiteId)) : undefined,
    who ? eq(schema.activityLogs.userId, who) : undefined, q ? ilike(schema.activityLogs.summary, `%${q}%`) : undefined,
    days > 0 ? gte(schema.activityLogs.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined);
  const rows = await db.query.activityLogs.findMany({ where, orderBy: desc(schema.activityLogs.createdAt), limit: 300, with: { user: { columns: { name: true } } } });
  if (u.searchParams.get("format") === "csv") {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return new Response(["Date,Person,Action,Summary", ...rows.map((r) => [r.createdAt.toISOString(), r.user?.name ?? "System", r.action, r.summary].map(cell).join(","))].join("\n"),
      { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=activity.csv" } });
  }
  return json(rows);
});
