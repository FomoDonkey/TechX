/**
 * Construye el ViewerContext (F8b) para SSR a partir de la request actual.
 * Una sola query a DB cuando hay sesión de miembro; sin red en otro caso.
 *
 * Datos:
 *  - Sesión de miembro (cookie csm.member) → email, isActive, tierId
 *  - Geo (header x-vercel-ip-country) → country
 *  - User-Agent → device (mobile/tablet/desktop/bot)
 *  - Cookies (csm_tz) → hour local
 *  - Search params (utm_*) → utm
 */

import type { ViewerContext } from "@/blocks/types";
import { getCurrentMemberSession } from "@/payments/member-auth";
import { getMembershipByEmail, isMembershipActive } from "@/payments/memberships";
import { cookies, headers } from "next/headers";
import { z } from "zod";

/** Acepta IANA timezones simples (Region/City) — rechaza paths exóticos. */
const IANA_TZ_RE = /^[A-Za-z][A-Za-z_+/-]{0,49}$/;

const UtmCookieSchema = z
  .object({
    source: z.string().max(120).optional(),
    medium: z.string().max(120).optional(),
    campaign: z.string().max(120).optional(),
  })
  .strict();

const BOT_RE =
  /(bot|spider|crawl|slurp|baidu|duckduckbot|yandex|sogou|exabot|facebot|ia_archiver|googlebot|bingbot|applebot|petalbot|ahrefsbot|mj12bot|semrushbot|seznam|prerender)/i;

const MOBILE_RE =
  /(iphone|ipod|android.*mobile|windows phone|opera mini|blackberry|silk.*mobile|kindle)/i;
const TABLET_RE = /(ipad|android(?!.*mobile)|tablet|playbook|silk|kindle.*fire)/i;

function detectDevice(ua: string | null): "mobile" | "tablet" | "desktop" | "bot" {
  if (!ua) return "desktop";
  if (BOT_RE.test(ua)) return "bot";
  if (TABLET_RE.test(ua)) return "tablet";
  if (MOBILE_RE.test(ua)) return "mobile";
  return "desktop";
}

function parseUtmFromRequest(): { source?: string; medium?: string; campaign?: string } {
  // En SSR de RSC no tenemos acceso directo a searchParams sin pasarlos.
  // Patrón pragmático: leer cookie `csm_utm` (set por middleware o JS).
  // Si no existe, devolvemos {} y el caller puede mergear con sus propios searchParams.
  return {};
}

export async function getViewerContext(workspaceId: string): Promise<ViewerContext> {
  const h = await headers();
  const ua = h.get("user-agent");
  const country =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country") ?? null;

  const device = detectDevice(ua);

  const jar = await cookies();
  const tz = jar.get("csm_tz")?.value;
  let hour: number | null = null;
  if (tz && IANA_TZ_RE.test(tz)) {
    try {
      // `Intl.DateTimeFormat` lanza con TZ inválido; lo capturamos.
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
      });
      const parts = fmt.formatToParts(new Date());
      const hourPart = parts.find((p) => p.type === "hour")?.value;
      const h24 = hourPart ? Number.parseInt(hourPart, 10) : Number.NaN;
      if (Number.isFinite(h24) && h24 >= 0 && h24 <= 23) hour = h24;
    } catch {
      hour = null;
    }
  }

  let utm = parseUtmFromRequest();
  const cookieUtm = jar.get("csm_utm")?.value;
  if (cookieUtm && cookieUtm.length < 2048) {
    try {
      const parsed = UtmCookieSchema.safeParse(JSON.parse(cookieUtm));
      if (parsed.success) utm = { ...utm, ...parsed.data };
    } catch {
      /* JSON inválido — ignorar silenciosamente */
    }
  }

  // Sesión + membresía
  const session = await getCurrentMemberSession(workspaceId);
  if (!session) {
    return {
      isAuthenticated: false,
      email: null,
      isActive: false,
      tierId: null,
      country,
      device,
      utm,
      hour,
    };
  }
  const m = await getMembershipByEmail(workspaceId, session.email);
  return {
    isAuthenticated: true,
    email: session.email,
    isActive: isMembershipActive(m),
    tierId: m?.tierId ?? null,
    country,
    device,
    utm,
    hour,
  };
}

/**
 * Versión "guest" — para callers que no quieren tocar DB. Útil en preview admin.
 */
export function guestViewerContext(): ViewerContext {
  return {
    isAuthenticated: false,
    email: null,
    isActive: false,
    tierId: null,
    country: null,
    device: "desktop",
    utm: {},
    hour: null,
  };
}
