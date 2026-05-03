/**
 * Cliente Stripe minimalista basado en fetch nativo.
 *
 * Por qué no usar el SDK oficial:
 *   1) Cero deps adicionales (~1 MB ahorrado).
 *   2) Cero bundle bleed al public — todo es server-only y arrancable solo
 *      si hay STRIPE_SECRET_KEY (lazy via getter).
 *   3) Cubrimos exactamente lo que necesitamos: Checkout Sessions, Billing
 *      Portal, Products, Prices, Subscriptions GET, Customers, y verify del
 *      webhook (HMAC SHA256 timing-safe).
 *
 * Demo mode (sin STRIPE_SECRET_KEY): createCheckoutSession devuelve una URL
 * de la propia app que simula el callback de Stripe; el resto de helpers
 * lanzan StripeNotConfiguredError, lo que el caller debe interpretar como
 * "no exponer botones de Stripe".
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-12-18.acacia";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY no configurado.");
    this.name = "StripeNotConfiguredError";
  }
}

export class StripeApiError extends Error {
  status: number;
  code: string | undefined;
  type: string | undefined;
  constructor(message: string, status: number, code?: string, type?: string) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
    this.type = type;
  }
}

export function stripeAvailable(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

/** Modo demo: hay claves dummy o ninguna; checkout simulado en localhost. */
export function stripeIsDemo(): boolean {
  return !stripeAvailable();
}

// ============================================================
// Encoder form-urlencoded estilo Stripe (con sub-objetos `metadata[key]`)
// ============================================================
type FormValue = string | number | boolean | null | undefined;
type FormObject = { [key: string]: FormValue | FormObject | FormValue[] };

function encode(obj: FormObject, prefix?: string): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v === null || v === undefined) return;
        if (typeof v === "object") {
          parts.push(...encode(v as FormObject, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(...encode(value as FormObject, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

export function encodeForm(obj: FormObject): string {
  return encode(obj).join("&");
}

// ============================================================
// HTTP helper
// ============================================================
async function stripeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: FormObject,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();
  const url = `${STRIPE_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  let init: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "DELETE")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init = { ...init, body: encodeForm(body) };
  }
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave as null */
  }
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string; type?: string } } | null)
      ?.error;
    throw new StripeApiError(
      err?.message ?? `Stripe ${res.status}`,
      res.status,
      err?.code,
      err?.type,
    );
  }
  return json as T;
}

// ============================================================
// Tipos mínimos
// ============================================================
export type StripeProduct = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

export type StripePrice = {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null;
  active: boolean;
  metadata?: Record<string, string>;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer: string | null;
  customer_email: string | null;
  client_reference_id: string | null;
  subscription: string | null;
  payment_status: string;
  mode: "payment" | "subscription" | "setup";
  metadata?: Record<string, string>;
};

export type StripeBillingPortalSession = { id: string; url: string };

export type StripeSubscription = {
  id: string;
  customer: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "paused";
  /** En estados incomplete/incomplete_expired Stripe devuelve null. */
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_end: number | null;
  items: { data: Array<{ price: { id: string; product: string } }> };
  metadata?: Record<string, string>;
};

// ============================================================
// API helpers
// ============================================================
export async function createProduct(input: { name: string; description?: string | null }) {
  return stripeRequest<StripeProduct>("POST", "/products", {
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
  });
}

export async function updateProduct(
  id: string,
  input: { name?: string; description?: string | null; active?: boolean },
) {
  const body: FormObject = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.active !== undefined) body.active = input.active;
  return stripeRequest<StripeProduct>("POST", `/products/${id}`, body);
}

export async function createPrice(input: {
  productId: string;
  unitAmount: number;
  currency: string;
  recurring: { interval: "month" | "year" } | null;
  metadata?: Record<string, string>;
}) {
  const body: FormObject = {
    product: input.productId,
    unit_amount: input.unitAmount,
    currency: input.currency,
  };
  if (input.recurring) body.recurring = { interval: input.recurring.interval };
  if (input.metadata) body.metadata = input.metadata as unknown as FormObject;
  return stripeRequest<StripePrice>("POST", "/prices", body);
}

export async function archivePrice(id: string) {
  return stripeRequest<StripePrice>("POST", `/prices/${id}`, { active: false });
}

export async function createCheckoutSession(input: {
  priceId: string;
  mode: "payment" | "subscription";
  customerEmail?: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
  allowPromotionCodes?: boolean;
}) {
  const body: FormObject = {
    mode: input.mode,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": 1,
  };
  if (input.customerId) body.customer = input.customerId;
  else if (input.customerEmail) body.customer_email = input.customerEmail;
  if (input.clientReferenceId) body.client_reference_id = input.clientReferenceId;
  if (input.allowPromotionCodes) body.allow_promotion_codes = true;
  if (input.metadata) body.metadata = input.metadata as unknown as FormObject;
  if (input.mode === "subscription" && input.trialDays && input.trialDays > 0) {
    body.subscription_data = { trial_period_days: input.trialDays };
  }
  return stripeRequest<StripeCheckoutSession>("POST", "/checkout/sessions", body);
}

export async function retrieveCheckoutSession(id: string) {
  return stripeRequest<StripeCheckoutSession>("GET", `/checkout/sessions/${id}`);
}

export async function createBillingPortalSession(input: { customerId: string; returnUrl: string }) {
  return stripeRequest<StripeBillingPortalSession>("POST", "/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

export async function retrieveSubscription(id: string) {
  return stripeRequest<StripeSubscription>("GET", `/subscriptions/${id}`);
}

export async function cancelSubscription(id: string, atPeriodEnd = true) {
  if (atPeriodEnd) {
    return stripeRequest<StripeSubscription>("POST", `/subscriptions/${id}`, {
      cancel_at_period_end: true,
    });
  }
  return stripeRequest<StripeSubscription>("DELETE", `/subscriptions/${id}`);
}

// ============================================================
// Webhook signature verify (Stripe-compatible)
// ============================================================
export type StripeEvent = {
  id: string;
  object: "event";
  type: string;
  created: number;
  livemode: boolean;
  api_version: string;
  data: { object: unknown; previous_attributes?: unknown };
  request?: { id?: string; idempotency_key?: string };
};

/**
 * Verifica firma estilo `Stripe-Signature: t=TS,v1=SIG[,v1=SIG2]`.
 * Devuelve el evento parseado o null si la firma es inválida o expirada.
 *
 * `tolerance` en segundos (default 5 min). Si la diferencia entre el `t` y
 * Date.now() supera la tolerancia, rechazamos para mitigar replay.
 */
export function verifyAndParseWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  tolerance = 300,
): StripeEvent | null {
  if (!signatureHeader || !secret) return null;
  if (rawBody.length === 0 || rawBody.length > 1_000_000) return null;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return null;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) return null;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  let matched = false;
  for (const sig of signatures) {
    if (sig.length !== expected.length) continue;
    const sigBuf = Buffer.from(sig, "utf8");
    if (sigBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(sigBuf, expectedBuf)) {
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  try {
    const parsed = JSON.parse(rawBody) as StripeEvent;
    if (!parsed || parsed.object !== "event" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Mapea status de Stripe → enum interno membership_status.
 * "incomplete_expired" no existe en nuestro enum: lo tratamos como canceled.
 */
export function mapSubscriptionStatus(
  stripeStatus: string,
): "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused" {
  switch (stripeStatus) {
    case "incomplete":
      return "incomplete";
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    default:
      return "canceled";
  }
}
