/**
 * Crea una sesión Better-Auth compatible desde un flow custom (passkey login).
 *
 * Better-Auth no expone una API pública para mintar sesiones fuera de su pipeline
 * de endpoints. Reproducimos el contrato:
 *  1. Insertar fila en `sessions` con `token` único + `expiresAt`.
 *  2. Firmar el token con HMAC-SHA-256 (mismo secreto AUTH_SECRET).
 *  3. Setear cookie `csm.session_token` (o `__Secure-csm.session_token` en prod)
 *     con valor `${token}.${signatureBase64}` y atributos httpOnly/secure/lax.
 *
 * Verificado contra `node_modules/better-auth/dist/cookies/index.mjs`
 * (`setSessionCookie` → `setSignedCookie`) y `crypto/index.mjs::makeSignature`
 * que usa `btoa(String.fromCharCode(...sig))` (base64 padded estándar).
 *
 * Si Better-Auth cambia el formato de cookie en futura major, este helper
 * romperá silenciosamente: el test es "loguea con passkey, recarga /admin →
 * sesión activa". Cualquier cambio en `setSignedCookie` tira eso.
 */

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { env } from "@/env";
import { anonymizeIp } from "@/lib/ip-anon";
import { nanoid } from "nanoid";
import type { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "csm.session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d, igual que auth.session.expiresIn

export type MintedSession = {
  token: string;
  expiresAt: Date;
  cookieName: string;
  cookieValue: string;
  cookieAttributes: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
};

export async function mintSession(args: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<MintedSession> {
  if (!db) throw new Error("db_unavailable");

  // Token "estilo Better-Auth": opaque random URL-safe.
  const token = randomToken(32);
  const id = nanoid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    id,
    userId: args.userId,
    token,
    expiresAt,
    // GDPR: storage truncado (último octeto v4 o /48 v6) — ver `src/lib/ip-anon.ts`.
    // Conserva geolocalización aproximada para "session devices UI" sin re-identificación.
    ipAddress: anonymizeIp(args.ipAddress),
    userAgent: args.userAgent ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const signature = await hmacSign(token, env.AUTH_SECRET);
  const cookieValue = `${token}.${signature}`;

  const isProd = env.NODE_ENV === "production";
  const cookieName = isProd ? `__Secure-${SESSION_COOKIE_NAME}` : SESSION_COOKIE_NAME;

  return {
    token,
    expiresAt,
    cookieName,
    cookieValue,
    cookieAttributes: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export function applySessionCookie(res: NextResponse, minted: MintedSession): NextResponse {
  res.cookies.set(minted.cookieName, minted.cookieValue, {
    httpOnly: minted.cookieAttributes.httpOnly,
    secure: minted.cookieAttributes.secure,
    sameSite: minted.cookieAttributes.sameSite,
    path: minted.cookieAttributes.path,
    maxAge: minted.cookieAttributes.maxAge,
  });
  return res;
}

function randomToken(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  // base64url sin padding — formato típico de tokens opacos.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  // Better-Auth usa `btoa(String.fromCharCode(...sig))` → base64 estándar con padding.
  let bin = "";
  const u8 = new Uint8Array(sig);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i] ?? 0);
  return btoa(bin);
}
