/**
 * POST /api/stripe/webhook
 *
 * Endpoint de webhooks de Stripe. Verifica firma, idempotencia atómica vía
 * `member_events.stripe_event_id` UNIQUE (claim-then-process), y maneja:
 *   - checkout.session.completed
 *   - customer.subscription.created / updated / deleted
 *   - invoice.payment_succeeded / payment_failed
 *
 * IMPORTANTE: Stripe necesita el RAW body para verificar la firma. Siempre
 * `req.text()` y parseamos dentro de `verifyAndParseWebhook`.
 *
 * Ordering: Stripe NO garantiza orden entre eventos. Si llega
 * customer.subscription.created antes que checkout.session.completed (la
 * membership aún no existe), devolvemos 5xx para que Stripe reintente más
 * tarde — el event.id NO se consume hasta procesarlo de verdad.
 */

import { db } from "@/db/client";
import { memberships } from "@/db/schema";
import { env } from "@/env";
import {
  getMembershipByStripeSubscription,
  getTierByStripePrice,
  grantMembership,
  recordMemberEvent,
  stripeEventAlreadyProcessed,
  updateMembershipFromSubscription,
} from "@/payments/memberships";
import {
  type StripeEvent,
  type StripeSubscription,
  mapSubscriptionStatus,
  retrieveSubscription,
  verifyAndParseWebhook,
} from "@/payments/stripe";
import { paymentTokens } from "@/payments/tokens";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Excepción interna: el evento llegó fuera de orden — Stripe debe reintentar. */
class StripeEventDeferred extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StripeEventDeferred";
  }
}

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const event = verifyAndParseWebhook(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Pre-check rápido: si el event.id ya está consumido en member_events,
  // devolvemos 200 sin hacer trabajo. La idempotencia REAL la garantiza el
  // claim atómico dentro de cada handler (recordMemberEvent.inserted=false).
  if (await stripeEventAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    if (err instanceof StripeEventDeferred) {
      // Out-of-order: NO consumimos event.id; Stripe reintentará en backoff.
      console.warn("stripe webhook deferred", event.type, event.id, err.message);
      return NextResponse.json({ deferred: err.message }, { status: 503 });
    }
    console.error("stripe webhook handler failed", event.type, event.id, err);
    // 500 → Stripe reintentará. Si la falla es por bug persistente, los logs
    // lo evidencian; preferimos reintentos a perder el evento.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ============================================================
// Handlers
// ============================================================
async function handleEvent(event: StripeEvent): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event);
      break;
    default:
      // Eventos no manejados → ack 200 sin grabar (no inflamos audit log con
      // tipos que ignoramos). Stripe no reintenta.
      console.log("stripe webhook ignored", event.type, event.id);
  }
}

/**
 * checkout.session.completed: el usuario completó el pago.
 * Recupera la subscription si mode=subscription, mappea tier por priceId,
 * upsertea membership idempotente, reclama el event.id atomicamente.
 */
async function handleCheckoutCompleted(event: StripeEvent): Promise<void> {
  const session = event.data.object as {
    id: string;
    mode: "payment" | "subscription";
    customer?: string | null;
    customer_email?: string | null;
    customer_details?: { email?: string | null } | null;
    subscription?: string | null;
    client_reference_id?: string | null;
    metadata?: Record<string, string>;
  };

  const meta = session.metadata ?? {};
  const ref = session.client_reference_id
    ? paymentTokens.verifyStripeRef(session.client_reference_id)
    : null;

  const workspaceId = ref?.ws ?? meta.workspaceId;
  const tierIdFromMeta = ref?.tier ?? meta.tierId;
  const email =
    session.customer_email ??
    session.customer_details?.email ??
    meta.memberEmail ??
    ref?.email ??
    null;

  if (!workspaceId || !email) {
    // Payload corrupto / sin atribución posible. Ack 200 — Stripe no reintenta.
    console.warn("checkout.session.completed sin ws/email", session.id);
    return;
  }

  let tierId = tierIdFromMeta ?? null;
  const stripeSubscriptionId: string | null = session.subscription ?? null;
  let subscription: StripeSubscription | null = null;

  if (session.mode === "subscription" && stripeSubscriptionId) {
    subscription = await retrieveSubscription(stripeSubscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId) {
      const tier = await getTierByStripePrice(workspaceId, priceId);
      if (tier) tierId = tier.id;
    }
  }

  const now = new Date();
  const membership = await grantMembership({
    workspaceId,
    email,
    tierId: tierId ?? null,
    status: subscription ? mapSubscriptionStatus(subscription.status) : "active",
    stripeCustomerId: session.customer ?? null,
    stripeSubscriptionId,
    currentPeriodStart: subPeriodStart(subscription, now),
    currentPeriodEnd: subPeriodEnd(subscription, null),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    trialEnd: subscription?.trial_end ? new Date(subscription.trial_end * 1000) : null,
    source: "checkout",
  });

  // Reclamamos el event.id. Si dos webhooks paralelos del mismo event llegan,
  // el segundo recibe inserted:false y termina sin doble-procesar.
  await recordMemberEvent({
    workspaceId,
    membershipId: membership.id,
    email,
    type: "membership_created",
    stripeEventId: event.id,
    data: { sessionId: session.id, mode: session.mode, subscriptionId: stripeSubscriptionId },
  });
}

async function handleSubscriptionUpsert(event: StripeEvent): Promise<void> {
  const sub = event.data.object as StripeSubscription;
  const existing = await getMembershipByStripeSubscription(sub.id);
  if (!existing) {
    // Out-of-order: subscription.* llegó antes que checkout.completed.
    // NO consumimos event.id — Stripe reintentará y eventualmente la membership
    // existirá. Esto puede tardar segundos a minutos.
    throw new StripeEventDeferred(`subscription ${sub.id} not yet linked to membership`);
  }

  const priceId = sub.items.data[0]?.price.id;
  let tierId = existing.tierId;
  if (priceId) {
    const tier = await getTierByStripePrice(existing.workspaceId, priceId);
    if (tier) tierId = tier.id;
  }

  await updateMembershipFromSubscription({
    workspaceId: existing.workspaceId,
    membershipId: existing.id,
    status: mapSubscriptionStatus(sub.status),
    tierId,
    currentPeriodStart: subPeriodStart(sub, null),
    currentPeriodEnd: subPeriodEnd(sub, null),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });

  await recordMemberEvent({
    workspaceId: existing.workspaceId,
    membershipId: existing.id,
    email: existing.email,
    type:
      sub.status === "canceled"
        ? "membership_canceled"
        : tierId !== existing.tierId
          ? "tier_changed"
          : "membership_updated",
    stripeEventId: event.id,
    data: { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end },
  });
}

async function handleSubscriptionDeleted(event: StripeEvent): Promise<void> {
  const sub = event.data.object as StripeSubscription;
  const existing = await getMembershipByStripeSubscription(sub.id);
  if (!existing) {
    // Sin membership conocida — ack 200 silencioso (no es deferrable: si nunca
    // existió, no va a aparecer).
    console.log("subscription.deleted for unknown sub", sub.id);
    return;
  }
  if (!db) return;
  await db
    .update(memberships)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      currentPeriodEnd: subPeriodEnd(sub, new Date()),
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, existing.id));
  await recordMemberEvent({
    workspaceId: existing.workspaceId,
    membershipId: existing.id,
    email: existing.email,
    type: "membership_canceled",
    stripeEventId: event.id,
    data: { sub: sub.id },
  });
}

async function handleInvoicePaymentSucceeded(event: StripeEvent): Promise<void> {
  const invoice = event.data.object as { customer?: string; subscription?: string | null };
  if (!invoice.subscription) {
    // Pagos one-shot sin subscription (ej. Lifetime via payment mode) — ya se
    // grant en checkout.completed. Ack silencioso.
    return;
  }
  const existing = await getMembershipByStripeSubscription(invoice.subscription);
  if (!existing) {
    throw new StripeEventDeferred(
      `invoice.payment_succeeded for unknown sub ${invoice.subscription}`,
    );
  }
  await recordMemberEvent({
    workspaceId: existing.workspaceId,
    membershipId: existing.id,
    email: existing.email,
    type: "payment_succeeded",
    stripeEventId: event.id,
    data: { customer: invoice.customer, sub: invoice.subscription },
  });
}

async function handleInvoicePaymentFailed(event: StripeEvent): Promise<void> {
  const invoice = event.data.object as { customer?: string; subscription?: string | null };
  if (!invoice.subscription) return;
  const existing = await getMembershipByStripeSubscription(invoice.subscription);
  if (!existing) {
    throw new StripeEventDeferred(`invoice.payment_failed for unknown sub ${invoice.subscription}`);
  }
  // No marcamos canceled aquí — Stripe enviará subscription.updated con
  // status="past_due"/"unpaid". Solo dejamos audit log.
  await recordMemberEvent({
    workspaceId: existing.workspaceId,
    membershipId: existing.id,
    email: existing.email,
    type: "payment_failed",
    stripeEventId: event.id,
    data: { customer: invoice.customer, sub: invoice.subscription },
  });
}

/**
 * Helpers para current_period_start/end. Stripe puede devolver null en estados
 * "incomplete" / "incomplete_expired" — null * 1000 = NaN → Invalid Date.
 */
function subPeriodStart(sub: StripeSubscription | null, fallback: Date | null): Date | null {
  if (!sub) return fallback;
  const v = sub.current_period_start;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
  return new Date(v * 1000);
}
function subPeriodEnd(sub: StripeSubscription | null, fallback: Date | null): Date | null {
  if (!sub) return fallback;
  const v = sub.current_period_end;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
  return new Date(v * 1000);
}
