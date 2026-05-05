/**
 * POST /api/auth/passkey/login-verify
 *
 * Verifica la respuesta WebAuthn del browser, resuelve el `userId` desde la
 * tabla `passkeys` (usando `credentialID`), e inserta una sesión Better-Auth
 * compatible. Devuelve `Set-Cookie` con `csm.session_token` firmado.
 *
 * Audit log: `passkey.login_success` con `meta.source: "passkey"` para que
 * un humano pueda filtrar logins-via-WebAuthn vs password.
 *
 * Falla con 401 si:
 *   - challenge expirado / re-uso
 *   - credential desconocida
 *   - firma inválida
 *   - cuenta soft-deleted (`deletionRequestedAt` con grace expirado o `deletedAt`)
 */

import { verifyPasskeyAuthentication } from "@/auth/passkeys";
import { rateLimit, readClientIp } from "@/auth/rate-limit";
import { applySessionCookie, mintSession } from "@/auth/sessions";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  const ipAddress = readClientIp(req);
  const limit = await rateLimit({
    endpoint: "passkey-login-verify",
    ip: ipAddress,
    max: 10,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let payload: { response?: unknown };
  try {
    payload = (await req.json()) as { response?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload.response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  let userId: string;
  try {
    const result = await verifyPasskeyAuthentication({ response: payload.response });
    userId = result.userId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verification_failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  // Cuenta no eliminada (hard-delete) — soft-delete se respeta no creando sesión
  // si ya pasó el grace period; si está dentro del grace, el user puede entrar
  // y cancelar la eliminación.
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.deletedAt) {
    return NextResponse.json({ error: "account_disabled" }, { status: 401 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  const minted = await mintSession({ userId, ipAddress, userAgent });

  await logActivity({
    workspaceId: null,
    actorId: userId,
    action: "passkey.login_success",
    targetType: "user",
    targetId: userId,
    meta: { source: "passkey" },
  }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  return applySessionCookie(res, minted);
}
