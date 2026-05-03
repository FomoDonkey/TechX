/**
 * Tokens HMAC firmados para flujos de pagos.
 *
 * Kinds:
 *  - "demo-checkout": demo mode — un token firma {ws, tierId, email, exp}
 *    para que el callback /api/stripe/demo-callback conceda la membership
 *    sin pasar por Stripe.
 *  - "stripe-ref": opcional, para firmar el `client_reference_id` que mandamos
 *    a Stripe checkout y verificar de vuelta en el webhook.
 *
 * Reusamos `API_KEY_PEPPER` como secret server-only.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const SECRET = () => env.API_KEY_PEPPER;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

type DemoCheckoutPayload = {
  k: "demo-checkout";
  ws: string;
  tier: string;
  email: string;
  exp: number;
  /** Nonce único para detectar replays vía dedup en `member_events.stripe_event_id`. */
  jti: string;
};

type StripeRefPayload = { k: "stripe-ref"; ws: string; tier: string; email: string; exp: number };

type AnyToken = DemoCheckoutPayload | StripeRefPayload;

function sign<T extends AnyToken>(payload: T): string {
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", SECRET()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

function verify<T extends AnyToken>(token: string, kind: T["k"]): T | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts as [string, string];
  if (!payloadB64 || !sigB64) return null;

  const expected = createHmac("sha256", SECRET()).update(payloadB64).digest();
  let given: Buffer;
  try {
    given = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const json = fromB64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as T;
    if (parsed.k !== kind) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const expiresIn = (minutes: number) => Math.floor(Date.now() / 1000) + minutes * 60;

function newJti(): string {
  return randomBytes(12).toString("hex");
}

export const paymentTokens = {
  signDemoCheckout: (workspaceId: string, tierId: string, email: string, minutes = 30) =>
    sign<DemoCheckoutPayload>({
      k: "demo-checkout",
      ws: workspaceId,
      tier: tierId,
      email: email.toLowerCase(),
      exp: expiresIn(minutes),
      jti: newJti(),
    }),
  verifyDemoCheckout: (token: string) => verify<DemoCheckoutPayload>(token, "demo-checkout"),

  signStripeRef: (workspaceId: string, tierId: string, email: string, minutes = 60) =>
    sign<StripeRefPayload>({
      k: "stripe-ref",
      ws: workspaceId,
      tier: tierId,
      email: email.toLowerCase(),
      exp: expiresIn(minutes),
    }),
  verifyStripeRef: (token: string) => verify<StripeRefPayload>(token, "stripe-ref"),
} as const;
