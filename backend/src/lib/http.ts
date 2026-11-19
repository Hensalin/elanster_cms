import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getUser, type SessionUser } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400, extra?: object) =>
  NextResponse.json({ error: message, ...extra }, { status });

type Handler<C> = (req: Request, ctx: C, user: SessionUser) => Promise<Response>;
/** Wrap an admin route: requires login, turns thrown errors into clean JSON. */
export function admin<C = unknown>(h: Handler<C>, opts?: { superOnly?: boolean }) {
  return async (req: Request, ctx: C) => {
    try {
      // Changes only accept JSON (or a file upload). A form or plain-text request from another website is refused (CSRF defence).
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const ct = (req.headers.get("content-type") || "").toLowerCase();
        if (ct && !ct.startsWith("application/json") && !ct.startsWith("multipart/form-data")) return fail("Unsupported request", 415);
        const site = req.headers.get("sec-fetch-site");
        if (site === "cross-site") return fail("Forbidden", 403);
      }
      const user = await getUser();
      if (!user) return fail("Not signed in", 401);
      if (opts?.superOnly && user.role !== "SUPER_ADMIN") return fail("Forbidden", 403);
      return await h(req, ctx, user);
    } catch (e) {
      // Next.js tests at build time whether a route can be made static; reading the sign-in cookie says "no". Let Next.js handle that quietly.
      if (e instanceof Error && /prerender|dynamic server usage|HANGING_PROMISE/i.test(e.message + (e as { digest?: string }).digest)) throw e;
      if (e instanceof ZodError) return fail("Invalid data", 422, { details: e.flatten().fieldErrors });
      console.error(e);
      return fail("Server error", 500);
    }
  };
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

/** "HTTPS://Site.com/" → "https://site.com" so the same address is always written the same way. */
export const normDomain = (d: string) => { const t = d.trim().replace(/\/+$/, ""); if (!t) return ""; try { const u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t); return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`; } catch { return t; } };
