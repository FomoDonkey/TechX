/**
 * POST /api/auth/passkey/login-options
 *
 * Genera las opciones WebAuthn para login con passkey **sin** conocer el usuario
 * todavía (resident credential / discoverable credential). El navegador presenta
 * todas las passkeys que el authenticator tenga para este RP y el user elige.
 *
 * Sin auth previa. Anti-bot: rate-limit por IP en `auth.rateLimit` (fallback)
 * + el reto criptográfico por sí mismo es prueba-de-trabajo.
 */

import { generatePasskeyAuthenticationOptions } from "@/auth/passkeys";
import { rateLimit, readClientIp } from "@/auth/rate-limit";
import { db } from "@/db/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  const limit = await rateLimit({
    endpoint: "passkey-login-options",
    ip: readClientIp(req),
    max: 20,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  try {
    const opts = await generatePasskeyAuthenticationOptions({});
    return NextResponse.json(opts);
  } catch (err) {
    console.error("passkey login-options failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
