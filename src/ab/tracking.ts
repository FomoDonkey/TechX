/**
 * Recording de events A/B (F8c).
 *
 * - Impressions: insertadas server-side post-render desde el RSC (fire-and-
 *   forget tras enviar la response no es posible en RSC, así que se inserta
 *   antes del flush; la inserción es 1 batch INSERT).
 * - Conversions: vienen vía /api/ab/event POST desde cliente (window.csm.ab)
 *   o desde hooks server (formularios, Stripe webhook).
 *
 * Anti-spam: rate limit blando — máx 1 impression por (test, anon) por hora.
 * Para v1 no aplicamos dedup duro porque el dashboard puede agrupar por
 * COUNT(DISTINCT anon_id). Si el volumen crece, materializamos a stats.
 */

import type { AbResolutionMap } from "@/ab/types";
import { consume } from "@/api/rate-limit";
import { db } from "@/db/client";
import { abEvents } from "@/db/schema";

/**
 * Cap defensivo de impressions/IP en SSR para evitar inflación de stats por
 * rotación de cookie csm_aid. Un IP normal hace ~10-50 PVs/h × N tests
 * activos. 1500/h da margen amplio para users con muchos tabs/refresh.
 *
 * NO bloquea el render (response sale igual); sólo deja de grabar events
 * cuando se excede.
 */
const IP_IMPRESSION_LIMIT = 1500;
const IP_IMPRESSION_WINDOW_MS = 60 * 60 * 1000;

export type ImpressionInput = {
  testId: string;
  variantId: string;
  workspaceId: string;
  anonId: string;
};

/** Inserta impressions en batch. Silencia errores (no debe romper render). */
export async function recordImpressions(rows: ImpressionInput[]): Promise<void> {
  if (!db || rows.length === 0) return;
  try {
    await db.insert(abEvents).values(
      rows.map((r) => ({
        testId: r.testId,
        workspaceId: r.workspaceId,
        variantId: r.variantId,
        anonId: r.anonId,
        kind: "impression" as const,
      })),
    );
  } catch {
    // Best-effort: tracking no debe bloquear render
  }
}

/** Helper conveniente: recibe el resolution map del render y graba uno por test.
 *
 * `clientIp` se usa SÓLO para rate-limit defensivo (anti-inflado por rotación
 * de cookie). Si excede el bucket, se omite el insert silenciosamente.
 */
export async function recordImpressionsFromMap(
  resolutions: AbResolutionMap,
  workspaceId: string,
  anonId: string,
  clientIp?: string | null,
): Promise<void> {
  if (resolutions.size === 0) return;
  // Rate limit por IP: protege contra atacantes que rotan csm_aid para inflar
  // stats. El bucket cuesta `resolutions.size` (1 por test) — multi-test
  // pages consumen proporcionalmente.
  if (clientIp) {
    const rl = consume(
      `ab:imp:ip:${clientIp}`,
      IP_IMPRESSION_LIMIT,
      IP_IMPRESSION_WINDOW_MS,
      resolutions.size,
    );
    if (!rl.ok) return;
  }
  const rows: ImpressionInput[] = [];
  for (const r of resolutions.values()) {
    rows.push({
      testId: r.testId,
      variantId: r.variantId,
      workspaceId,
      anonId,
    });
  }
  await recordImpressions(rows);
}

/** Extrae IP cliente del header (Vercel/Cloudflare lo ponen en x-forwarded-for). */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null;
}

export type ConversionInput = {
  testId: string;
  variantId: string;
  workspaceId: string;
  anonId: string;
  clientIp?: string | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
};

const IP_CONVERSION_LIMIT = 200; // /h
const IP_CONVERSION_WINDOW_MS = 60 * 60 * 1000;

export async function recordConversion(input: ConversionInput): Promise<void> {
  if (!db) return;
  if (input.clientIp) {
    const rl = consume(
      `ab:conv:ip:${input.clientIp}`,
      IP_CONVERSION_LIMIT,
      IP_CONVERSION_WINDOW_MS,
    );
    if (!rl.ok) return;
  }
  try {
    await db.insert(abEvents).values({
      testId: input.testId,
      workspaceId: input.workspaceId,
      variantId: input.variantId,
      anonId: input.anonId,
      kind: "conversion",
      value: input.value ?? null,
      meta: input.meta ?? null,
    });
  } catch {
    // Best-effort
  }
}
