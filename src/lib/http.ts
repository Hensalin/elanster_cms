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
      const user = await getUser();
      if (!user) return fail("Not signed in", 401);
      if (opts?.superOnly && user.role !== "SUPER_ADMIN") return fail("Forbidden", 403);
      return await h(req, ctx, user);
    } catch (e) {
      if (e instanceof ZodError) return fail("Invalid data", 422, { details: e.flatten().fieldErrors });
      console.error(e);
      return fail("Server error", 500);
    }
  };
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
