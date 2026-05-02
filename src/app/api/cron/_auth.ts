import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Verifica que la request venga de Vercel Cron (Bearer CRON_SECRET).
 * Devuelve null si OK, Response 401 si no.
 */
export function requireCronAuth(req: Request): Response | null {
  const auth = req.headers.get("authorization");
  if (!auth) return new Response("Missing Authorization", { status: 401 });
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return new Response("Bad Authorization", { status: 401 });
  const provided = m[1] ?? "";
  const expected = env.CRON_SECRET;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return new Response("Forbidden", { status: 403 });
  if (!timingSafeEqual(a, b)) return new Response("Forbidden", { status: 403 });
  return null;
}
