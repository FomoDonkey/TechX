/**
 * Tokens HMAC para newsletter — kinds:
 *   - "confirm"   doble opt-in inicial
 *   - "unsub"     one-click list-unsubscribe (RFC 8058)
 *   - "prefs"     gestión de preferencias del subscriber
 *   - "open"      pixel de apertura (campaign recipient)
 *   - "click"     reescritura de href (campaign recipient + url destino)
 *
 * Formato: `${payloadB64url}.${sigB64url}`. Payload = JSON corto.
 * Reusamos API_KEY_PEPPER como secret server-side.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const SECRET = () => env.API_KEY_PEPPER;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

type ConfirmPayload = { k: "confirm"; sid: string; exp: number };
type UnsubPayload = { k: "unsub"; sid: string; ws: string; exp?: number };
type PrefsPayload = { k: "prefs"; sid: string; ws: string; exp: number };
/** kind "c" = campaign-recipient, "d" = drip-enrollment. Discriminamos para
 *  no llamar al handler equivocado y evitar doble-conteo si UUIDs coinciden. */
type OpenPayload = { k: "open"; t: "c" | "d"; rid: string };
type ClickPayload = { k: "click"; t: "c" | "d"; rid: string; url: string };

export type NewsletterToken =
  | ConfirmPayload
  | UnsubPayload
  | PrefsPayload
  | OpenPayload
  | ClickPayload;

function sign<T extends NewsletterToken>(payload: T): string {
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", SECRET()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

function verify<T extends NewsletterToken>(token: string, kind: T["k"]): T | null {
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
    if ("exp" in parsed && typeof parsed.exp === "number" && parsed.exp > 0) {
      if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const DAY = 24 * 60 * 60;
const expiresIn = (days: number) => Math.floor(Date.now() / 1000) + days * DAY;

export const tokens = {
  // Confirmación de suscripción (doble opt-in). Caduca a 7 días.
  signConfirm: (subscriberId: string, days = 7) =>
    sign({ k: "confirm", sid: subscriberId, exp: expiresIn(days) }),
  verifyConfirm: (token: string) => verify<ConfirmPayload>(token, "confirm"),

  // Unsubscribe one-click. Sin exp por defecto (links permanentes en cada email).
  signUnsub: (subscriberId: string, workspaceId: string) =>
    sign({ k: "unsub", sid: subscriberId, ws: workspaceId }),
  verifyUnsub: (token: string) => verify<UnsubPayload>(token, "unsub"),

  // Preferencias. Caduca a 30 días para reducir riesgo si se filtra.
  signPrefs: (subscriberId: string, workspaceId: string, days = 30) =>
    sign({ k: "prefs", sid: subscriberId, ws: workspaceId, exp: expiresIn(days) }),
  verifyPrefs: (token: string) => verify<PrefsPayload>(token, "prefs"),

  // Open pixel. `t` discrimina campaign-recipient ("c") o drip-enrollment ("d").
  signOpen: (recipientId: string, kind: "c" | "d" = "c") =>
    sign({ k: "open", t: kind, rid: recipientId }),
  verifyOpen: (token: string) => verify<OpenPayload>(token, "open"),

  // Click. URL destino se firma para evitar open-redirect.
  signClick: (recipientId: string, url: string, kind: "c" | "d" = "c") =>
    sign({ k: "click", t: kind, rid: recipientId, url }),
  verifyClick: (token: string) => verify<ClickPayload>(token, "click"),
} as const;
