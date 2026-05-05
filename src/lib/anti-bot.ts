/**
 * Verificación anti-bot centralizada.
 *
 * Tres capas de defensa, ortogonales entre sí:
 *
 * 1. **Honeypot** (siempre activo): campo `hp` o `website` que un bot rellena
 *    automáticamente. Server descarta silenciosamente al detectarlo.
 * 2. **Cloudflare Turnstile** (env `TURNSTILE_SECRET`): captcha invisible si
 *    el cliente envía `csm_captcha`. Free, sin tracking de Google.
 *    https://developers.cloudflare.com/turnstile/
 * 3. **hCaptcha** (env `HCAPTCHA_SECRET`): alternativa con UI visible.
 *
 * Vercel BotID (GA junio 2025) es la opción platform-native y será integrada
 * cuando `@vercel/botid` esté instalado: detecta bots automáticamente sin
 * captcha visible. Si el env `VERCEL_BOTID_ENABLED=1` está activo, este
 * helper hace un dynamic import — si la dep no existe, cae a Turnstile/hp.
 *
 * **Convención de uso**: cualquier endpoint público (forms, subscribe, comments,
 * branch preview password) debe llamar `verifyAntiBot({ token, ip })` antes de
 * procesar. El honeypot se chequea por separado a nivel de campo del payload.
 */

export type AntiBotResult =
  | { ok: true; provider: "turnstile" | "hcaptcha" | "botid" | "none"; reason?: undefined }
  | {
      ok: false;
      provider: "turnstile" | "hcaptcha" | "botid";
      reason: "missing_token" | "verify_failed" | "verify_error";
    };

export type AntiBotInput = {
  /** Token devuelto por el widget client-side. Para BotID puede ser null. */
  token?: string | null;
  /** IP del cliente (para anti-replay del provider). Puede ser null en dev. */
  ip?: string | null;
  /** Forzar provider; default = autodetect según env. */
  provider?: "turnstile" | "hcaptcha" | "botid";
};

export type AntiBotStatus = {
  turnstile: boolean;
  hcaptcha: boolean;
  botid: boolean;
};

/**
 * Devuelve qué providers están configurados en el environment. Útil para la
 * UI de `/admin/ajustes/seguridad/anti-spam` que muestra el estado al admin.
 */
export function getAntiBotStatus(): AntiBotStatus {
  return {
    turnstile: Boolean(process.env.TURNSTILE_SECRET),
    hcaptcha: Boolean(process.env.HCAPTCHA_SECRET),
    botid:
      process.env.VERCEL_BOTID_ENABLED === "1" ||
      process.env.VERCEL_BOTID_ENABLED?.toLowerCase() === "true",
  };
}

/**
 * Provider efectivo a usar dada una preference y el estado del env.
 * Resolución: explicit > turnstile > hcaptcha > botid > none.
 *
 * Devolver "none" significa que no hay verificación adicional disponible —
 * el endpoint debe seguir confiando en honeypot + rate-limit.
 */
export function resolveAntiBotProvider(
  preferred?: "turnstile" | "hcaptcha" | "botid",
): "turnstile" | "hcaptcha" | "botid" | "none" {
  const status = getAntiBotStatus();
  if (preferred && status[preferred]) return preferred;
  if (status.turnstile) return "turnstile";
  if (status.hcaptcha) return "hcaptcha";
  if (status.botid) return "botid";
  return "none";
}

export async function verifyAntiBot(input: AntiBotInput): Promise<AntiBotResult> {
  const provider = resolveAntiBotProvider(input.provider);
  if (provider === "none") return { ok: true, provider: "none" };

  if (provider === "turnstile") return verifyTurnstile(input.token, input.ip ?? null);
  if (provider === "hcaptcha") return verifyHcaptcha(input.token, input.ip ?? null);
  if (provider === "botid") return verifyVercelBotId(input.token, input.ip ?? null);

  return { ok: true, provider: "none" };
}

async function verifyTurnstile(
  token: string | null | undefined,
  ip: string | null,
): Promise<AntiBotResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true, provider: "none" };
  if (!token) return { ok: false, provider: "turnstile", reason: "missing_token" };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }).toString(),
    });
    if (!res.ok) return { ok: false, provider: "turnstile", reason: "verify_failed" };
    const json = (await res.json()) as { success?: boolean };
    if (json.success) return { ok: true, provider: "turnstile" };
    return { ok: false, provider: "turnstile", reason: "verify_failed" };
  } catch {
    return { ok: false, provider: "turnstile", reason: "verify_error" };
  }
}

async function verifyHcaptcha(
  token: string | null | undefined,
  ip: string | null,
): Promise<AntiBotResult> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return { ok: true, provider: "none" };
  if (!token) return { ok: false, provider: "hcaptcha", reason: "missing_token" };
  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }).toString(),
    });
    if (!res.ok) return { ok: false, provider: "hcaptcha", reason: "verify_failed" };
    const json = (await res.json()) as { success?: boolean };
    if (json.success) return { ok: true, provider: "hcaptcha" };
    return { ok: false, provider: "hcaptcha", reason: "verify_failed" };
  } catch {
    return { ok: false, provider: "hcaptcha", reason: "verify_error" };
  }
}

/**
 * Vercel BotID — verificación platform-native. Sin token client-side: el
 * runtime de Vercel inserta un header firmado en cada request humana validada,
 * y `checkBotId()` (de `@vercel/botid`) lo verifica server-side.
 *
 * Si `@vercel/botid` no está instalado todavía, dejamos pasar con
 * `provider: "none"` (downgrade silencioso). Cuando el user instale el
 * paquete + active `VERCEL_BOTID_ENABLED=1`, este helper empieza a aplicar.
 */
async function verifyVercelBotId(
  _token: string | null | undefined,
  _ip: string | null,
): Promise<AntiBotResult> {
  try {
    // Dynamic import (string indirect) — si `@vercel/botid` no está instalado,
    // el import falla en runtime y caemos a `none`. La indirección por variable
    // evita que TS exija la dep en tiempo de tipos antes de instalarla.
    const moduleId = "@vercel/botid";
    const mod = (await import(/* @vite-ignore */ /* webpackIgnore: true */ moduleId).catch(
      () => null,
    )) as { checkBotId?: () => Promise<{ isBot: boolean }> } | null;
    if (!mod?.checkBotId) return { ok: true, provider: "none" };
    const result = await mod.checkBotId();
    if (result.isBot) return { ok: false, provider: "botid", reason: "verify_failed" };
    return { ok: true, provider: "botid" };
  } catch {
    return { ok: false, provider: "botid", reason: "verify_error" };
  }
}
