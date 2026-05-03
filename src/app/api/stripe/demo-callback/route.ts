/**
 * GET /api/stripe/demo-callback?token=...
 *
 * Concede membresía sin Stripe (modo demo o tier free). El token HMAC firma
 * (workspaceId, tierId, email, exp, jti). El `jti` se usa como
 * `member_events.stripe_event_id` (con prefijo "demo:") garantizando que cada
 * token vale para UNA sola concesión — los reintentos del mismo token devuelven
 * 200 sin tocar la membresía.
 */

import { db } from "@/db/client";
import { getCurrentMemberSession } from "@/payments/member-auth";
import {
  getTier,
  grantMembership,
  recordMemberEvent,
  stripeEventAlreadyProcessed,
} from "@/payments/memberships";
import { resolvePublicWorkspace } from "@/payments/public-workspace";
import { paymentTokens } from "@/payments/tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const isFree = url.searchParams.get("free") === "1";

  const payload = paymentTokens.verifyDemoCheckout(token);
  if (!payload) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  // Defensa: la sesión actual debe coincidir con el email del token.
  const ws = await resolvePublicWorkspace(req);
  if (!ws || ws.id !== payload.ws) {
    return NextResponse.json({ error: "workspace_mismatch" }, { status: 400 });
  }
  const session = await getCurrentMemberSession(ws.id);
  if (!session || session.email !== payload.email) {
    return NextResponse.json({ error: "session_mismatch" }, { status: 401 });
  }

  // Anti-replay: si el jti ya fue consumido, redirigimos al portal sin
  // re-conceder. La membresía ya existe (idempotente).
  const dedupeKey = `demo:${payload.jti}`;
  if (await stripeEventAlreadyProcessed(dedupeKey)) {
    return NextResponse.redirect(new URL("/miembros/portal?welcome=1", req.url), 303);
  }

  const tier = await getTier(ws.id, payload.tier);
  if (!tier) return NextResponse.json({ error: "tier_not_found" }, { status: 404 });

  // Para tiers de pago en demo mode: período "ficticio" de 1 mes/año.
  const now = new Date();
  const periodEnd = new Date(now);
  if (tier.interval === "month") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else if (tier.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 100); // lifetime

  const membership = await grantMembership({
    workspaceId: ws.id,
    email: session.email,
    tierId: tier.id,
    status: tier.trialDays > 0 ? "trialing" : "active",
    source: isFree || tier.isFree ? "free" : "demo",
    currentPeriodStart: now,
    currentPeriodEnd: tier.interval === "lifetime" ? null : periodEnd,
    trialEnd:
      tier.trialDays > 0 ? new Date(now.getTime() + tier.trialDays * 24 * 60 * 60 * 1000) : null,
  });

  // Reclamamos el jti vía dedup-key. Si dos requests entran en paralelo, el
  // segundo recibe inserted:false y igual redirige al portal (idempotente).
  await recordMemberEvent({
    workspaceId: ws.id,
    membershipId: membership.id,
    email: session.email,
    type: "membership_created",
    stripeEventId: dedupeKey,
    data: { source: isFree || tier.isFree ? "free" : "demo", tierId: tier.id, jti: payload.jti },
  });

  return NextResponse.redirect(new URL("/miembros/portal?welcome=1", req.url), 303);
}
