/**
 * Tokens firmados HMAC para confirmación double-opt-in y para webhook_in
 * triggers de automations. No usamos JWT entero — un payload corto base64url +
 * HMAC sha256 truncado es suficiente y más compacto en URL.
 *
 * Formato: `${payloadB64}.${sigB64}` donde payload es JSON {sid, exp}.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

function getSecret(): string {
  // Reutilizamos API_KEY_PEPPER (ya es un secret server-side existente).
  return env.API_KEY_PEPPER;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export type ConfirmationPayload = {
  /** submission id. */
  sid: string;
  /** expiration epoch sec. */
  exp: number;
};

export function signConfirmationToken(payload: ConfirmationPayload): string {
  const json = JSON.stringify(payload);
  const payloadB64 = b64url(Buffer.from(json, "utf8"));
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export function verifyConfirmationToken(token: string): ConfirmationPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts as [string, string];
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  let givenSig: Buffer;
  try {
    givenSig = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (givenSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(expectedSig, givenSig)) return null;

  try {
    const json = fromB64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as ConfirmationPayload;
    if (typeof parsed.sid !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function defaultConfirmationExpiry(days = 7): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}
