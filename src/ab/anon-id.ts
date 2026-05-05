/**
 * Anon ID estable por visitante (F8c).
 *
 * - Cookie: `csm_aid` (httpOnly=false para que client tracking pueda leerlo,
 *   sameSite=lax, 1 año).
 * - Formato: 22 chars base64url (≈128 bits).
 *
 * El cookie se setea desde el middleware en cualquier request HTML; los page
 * RSC sólo LEEN. Si por algún motivo no hay cookie en SSR (primera visita,
 * cookie disabled, headless con dom-strip), generamos un id ephemeral SOLO
 * para esa request — la siguiente visita el middleware setea uno persistente.
 */

import { cookies } from "next/headers";

export const ANON_COOKIE = "csm_aid";

/** Regex anti-tampering: 22 chars base64url. */
const ANON_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function generateAnonId(): string {
  // 16 bytes random → base64url (sin padding)
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

export function base64UrlEncode(buf: Uint8Array): string {
  // btoa requiere binary string; preferimos un loop simple
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i] ?? 0);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function isValidAnonId(v: unknown): v is string {
  return typeof v === "string" && ANON_RE.test(v);
}

/**
 * Lee `csm_aid` de la request actual. Si no existe o es inválido, devuelve
 * un id ephemeral generado para esta request. NO setea la cookie (eso lo
 * hace el middleware).
 */
export async function getOrCreateAnonIdSSR(): Promise<{ anonId: string; ephemeral: boolean }> {
  const jar = await cookies();
  const raw = jar.get(ANON_COOKIE)?.value;
  if (raw && isValidAnonId(raw)) return { anonId: raw, ephemeral: false };
  return { anonId: generateAnonId(), ephemeral: true };
}
