/**
 * Helpers para construir URLs públicas que aparecen en emails.
 * Resuelve workspace.customDomain primero (preferido para deliverability —
 * los enlaces deben apuntar al dominio del workspace, no al admin) y cae a
 * NEXT_PUBLIC_APP_URL.
 */

import { env } from "@/env";

export function publicOriginFromWorkspace(ws: { customDomain?: string | null } | null): string {
  if (ws?.customDomain) {
    const cd = ws.customDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${cd}`;
  }
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

export function buildSubscribeUrls(
  origin: string,
  tokens: {
    confirm?: string;
    unsub?: string;
    prefs?: string;
  },
) {
  return {
    confirm: tokens.confirm ? `${origin}/suscribir/confirmar/${tokens.confirm}` : undefined,
    unsub: tokens.unsub ? `${origin}/suscribir/baja/${tokens.unsub}` : undefined,
    prefs: tokens.prefs ? `${origin}/suscribir/preferencias/${tokens.prefs}` : undefined,
  };
}

export function buildOpenPixelUrl(origin: string, token: string): string {
  return `${origin}/api/email/open/${token}.gif`;
}

export function buildClickProxyUrl(origin: string, token: string): string {
  return `${origin}/api/email/click/${token}`;
}
