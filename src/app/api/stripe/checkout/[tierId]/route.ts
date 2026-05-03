/**
 * POST /api/stripe/checkout/[tierId]
 *
 * Crea una Stripe Checkout Session para que un miembro autenticado se
 * suscriba al tier. En modo demo (sin STRIPE_SECRET_KEY) genera una URL
 * propia /api/stripe/demo-callback que concede la membresía sin cobrar.
 *
 * Auth: requiere member session activa (cookie csm.member). Si no, redirige
 * a /miembros?next=/miembros/portal&tier=ID.
 */

import { db } from "@/db/client";
import { features } from "@/env";
import { getCurrentMemberSession } from "@/payments/member-auth";
import { getTier } from "@/payments/memberships";
import { publicOrigin, resolvePublicWorkspace } from "@/payments/public-workspace";
import { StripeApiError, createCheckoutSession, stripeAvailable } from "@/payments/stripe";
import { paymentTokens } from "@/payments/tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ tierId: string }> }) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  const { tierId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(tierId)) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  const ws = await resolvePublicWorkspace(req);
  if (!ws) return NextResponse.json({ error: "workspace_unresolved" }, { status: 400 });

  const tier = await getTier(ws.id, tierId);
  if (!tier || !tier.isActive) {
    return NextResponse.json({ error: "tier_not_available" }, { status: 404 });
  }

  const session = await getCurrentMemberSession(ws.id);
  if (!session) {
    const next = encodeURIComponent(`/miembros/portal?tier=${tierId}`);
    return NextResponse.redirect(new URL(`/miembros?next=${next}`, req.url), 303);
  }

  const origin = publicOrigin(ws);
  const returnUrl = `${origin}/miembros/portal?welcome=1`;
  const cancelUrl = `${origin}/miembros/portal?canceled=1`;

  // Free tier → grant directo, sin Stripe
  if (tier.isFree || tier.priceCents === 0) {
    const token = paymentTokens.signDemoCheckout(ws.id, tier.id, session.email);
    return NextResponse.redirect(
      new URL(`/api/stripe/demo-callback?token=${token}&free=1`, req.url),
      303,
    );
  }

  // Demo mode (no Stripe key) → callback directo
  if (!stripeAvailable() || !features.stripe) {
    const token = paymentTokens.signDemoCheckout(ws.id, tier.id, session.email);
    return NextResponse.redirect(new URL(`/api/stripe/demo-callback?token=${token}`, req.url), 303);
  }

  if (!tier.stripePriceId) {
    return NextResponse.json(
      { error: "tier_not_synced", message: "Sincroniza el tier con Stripe primero." },
      { status: 409 },
    );
  }

  try {
    const checkoutSession = await createCheckoutSession({
      priceId: tier.stripePriceId,
      mode: tier.interval === "lifetime" ? "payment" : "subscription",
      customerEmail: session.email,
      successUrl: `${returnUrl}&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
      trialDays: tier.trialDays,
      clientReferenceId: paymentTokens.signStripeRef(ws.id, tier.id, session.email),
      metadata: {
        workspaceId: ws.id,
        tierId: tier.id,
        memberEmail: session.email,
      },
      allowPromotionCodes: true,
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
    }

    return NextResponse.redirect(checkoutSession.url, 303);
  } catch (err) {
    console.error("createCheckoutSession failed", err);
    if (err instanceof StripeApiError) {
      return NextResponse.json(
        { error: "stripe_error", message: err.message, code: err.code },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// NOTA: NO exponemos GET. Permitirlo abriría CSRF (un <img src=...> en otro
// sitio podría iniciar checkout sin consentimiento). Para enlaces directos
// desde emails usar /miembros/portal?tier=ID que sí maneja redirect-on-mount.
