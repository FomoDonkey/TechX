/**
 * Gate de verificación de email para acciones que requieren cuenta confirmada.
 *
 * Política F10a parte 2 bloque 2 (2026-05-04):
 *  - Acciones libres (signup, signin, navegar admin, crear contenido): NO exigen verificación.
 *    Reduce fricción del onboarding y permite probar el producto.
 *  - Acciones sensibles (upgradear a plan paid, export GDPR completo, recibir alertas
 *    de seguridad): SÍ exigen verificación.
 *    Razón: previene abuso de cuentas con emails throwaway que cargan tarjetas
 *    robadas, y garantiza que la persona que solicita un export de datos personales
 *    es quien dice ser.
 *
 * El helper `requireVerifiedEmailForPaidPlan` se llama desde server actions que
 * van a mutar a paid; si falla, retorna {ok:false, reason:"email_unverified"}.
 * El caller decide qué error UI mostrar.
 */

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type VerifyGateResult =
  | { ok: true; email: string }
  | { ok: false; reason: "email_unverified" | "user_missing"; email: string | null };

export async function requireVerifiedEmailForPaidPlan(userId: string): Promise<VerifyGateResult> {
  if (!db) return { ok: false, reason: "user_missing", email: null };
  const [u] = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return { ok: false, reason: "user_missing", email: null };
  if (!u.emailVerified) return { ok: false, reason: "email_unverified", email: u.email };
  return { ok: true, email: u.email };
}
