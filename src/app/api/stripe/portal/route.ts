/**
 * POST /api/stripe/portal
 *
 * Crea sesión del Stripe Billing Portal y redirige. Requiere member session
 * con membresía activa que tenga `stripeCustomerId`. En demo mode redirige
 * directamente a /miembros/portal con un toast (no hay portal real).
 */

import { db } from "@/db/client";
import { getCurrentMemberSession } from "@/payments/member-auth";
import { getMembershipByEmail } from "@/payments/memberships";
import { publicOrigin, resolvePublicWorkspace } from "@/payments/public-workspace";
import { StripeApiError, createBillingPortalSession, stripeAvailable } from "@/payments/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  const ws = await resolvePublicWorkspace(req);
  if (!ws) return NextResponse.json({ error: "workspace_unresolved" }, { status: 400 });

  const session = await getCurrentMemberSession(ws.id);
  if (!session) {
    return NextResponse.redirect(new URL("/miembros", req.url), 303);
  }

  if (!stripeAvailable()) {
    return NextResponse.redirect(new URL("/miembros/portal?demo_portal=1", req.url), 303);
  }

  const membership = await getMembershipByEmail(ws.id, session.email);
  if (!membership || !membership.stripeCustomerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 409 });
  }

  const origin = publicOrigin(ws);
  try {
    const portal = await createBillingPortalSession({
      customerId: membership.stripeCustomerId,
      returnUrl: `${origin}/miembros/portal`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (err) {
    console.error("createBillingPortalSession failed", err);
    if (err instanceof StripeApiError) {
      return NextResponse.json({ error: "stripe_error", message: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// NOTA: NO exponemos GET. La UI siempre llama a /api/stripe/portal con un
// <form method="post"> que respeta sameSite=lax CSRF. Permitir GET abriría
// posibilidad de redirección forzada vía <img>/<a>.
