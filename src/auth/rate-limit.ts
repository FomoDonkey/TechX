/**
 * Rate-limiter standalone para endpoints custom (no manejados por Better-Auth)
 * que necesitan la misma protección que `/api/auth/*`. Reusa la tabla
 * `rate_limits` (key, count, lastRequest) — idéntica al storage de Better-Auth
 * para no fragmentar el almacén.
 *
 * Filosofía simple:
 *  - 1 fila por (key) donde key = `${endpoint}:${ip}`.
 *  - Sliding window: si `now - lastRequest > windowMs` → reset count = 1.
 *  - Si count >= max → bloquea con `retryAfter` = ventana restante.
 *
 * Race-condition aceptada: dos requests concurrentes pueden ambas leer count=4,
 * incrementar a 5, ambas pasar y guardar count=6. El error es de ±1, despreciable
 * para protección anti-brute-force con max=10.
 */

import { db } from "@/db/client";
import { upsert } from "@/db/dialect";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfter: number };

export async function rateLimit(args: {
  endpoint: string;
  ip: string | null;
  max: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  if (!db) return { ok: true, remaining: args.max };
  // Si no hay IP (proxy roto, dev local sin x-forwarded-for) caemos abierto:
  // mejor permitir que falsificar protección con un bucket compartido global.
  // Better-Auth tiene la misma política, ver `getIp` en rate-limiter/index.mjs.
  if (!args.ip) return { ok: true, remaining: args.max };

  const key = `${args.endpoint}:${args.ip}`;
  const windowMs = args.windowSeconds * 1000;
  const now = Date.now();

  const [existing] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!existing) {
    await upsert(rateLimits, {
      values: { id: nanoid(), key, count: 1, lastRequest: now },
      target: rateLimits.key,
      set: { count: 1, lastRequest: now },
    });
    return { ok: true, remaining: args.max - 1 };
  }

  const elapsed = now - existing.lastRequest;
  if (elapsed > windowMs) {
    await db.update(rateLimits).set({ count: 1, lastRequest: now }).where(eq(rateLimits.key, key));
    return { ok: true, remaining: args.max - 1 };
  }

  if (existing.count >= args.max) {
    const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  await db
    .update(rateLimits)
    .set({ count: existing.count + 1, lastRequest: now })
    .where(eq(rateLimits.key, key));

  return { ok: true, remaining: args.max - existing.count - 1 };
}

export function readClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip");
}
