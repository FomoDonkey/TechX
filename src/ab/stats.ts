/**
 * Estadística de tests A/B (F8c).
 *
 * Sin dependencias externas. Implementa:
 *  - Conversion rate por variant (uniques: COUNT(DISTINCT anonId)).
 *  - Chi-squared test 2×2 (control vs cada variant) → p-value.
 *  - Lift (% mejora vs control).
 *  - Sample size mínimo alcanzado.
 *
 * Para v1 calculamos sobre `ab_events` directamente. La query agrupa por
 * variant + kind + DISTINCT anonId. Para volumen <100k events es fluido
 * (ms range con índices).
 */

import { db } from "@/db/client";
import { countDistinctInt } from "@/db/dialect";
import { abEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type VariantStats = {
  variantId: string;
  /** Visitantes únicos que vieron la variant (DISTINCT anonId con kind=impression). */
  uniqueImpressions: number;
  /** Visitantes únicos que convirtieron (DISTINCT anonId con kind=conversion). */
  uniqueConversions: number;
  /** Tasa de conversión: conversions/impressions (0..1). 0 si impressions=0. */
  conversionRate: number;
  /** Lift % vs control (control tiene 0 por definición). null si no hay datos suficientes. */
  liftVsControl: number | null;
  /** p-value chi-squared 2×2 vs control. null si insuficiente o es la control misma. */
  pValueVsControl: number | null;
  /** True si la variant alcanzó el sample size mínimo. */
  reachedMinSample: boolean;
  /** True si pValue < 0.05 y reached min sample. */
  isSignificant: boolean;
};

export type TestResults = {
  totalImpressions: number;
  totalConversions: number;
  variants: VariantStats[];
  /** Variant con mayor tasa de conversión (después de min sample). null si no hay. */
  leaderId: string | null;
  /** Variant ganadora estadísticamente (p<0.05 y > control). null si no hay. */
  significantWinnerId: string | null;
};

/**
 * Carga stats agregadas de un test desde DB. Ejecuta 2 queries (impressions +
 * conversions) con DISTINCT anonId para deduplicar. Devuelve VariantStats[]
 * en el orden de `variantIds` recibido.
 */
export async function computeTestResults(
  testId: string,
  variantIds: string[],
  controlId: string | null,
  minSampleSize: number,
): Promise<TestResults> {
  const empty: TestResults = {
    totalImpressions: 0,
    totalConversions: 0,
    variants: variantIds.map((id) => ({
      variantId: id,
      uniqueImpressions: 0,
      uniqueConversions: 0,
      conversionRate: 0,
      liftVsControl: id === controlId ? 0 : null,
      pValueVsControl: null,
      reachedMinSample: false,
      isSignificant: false,
    })),
    leaderId: null,
    significantWinnerId: null,
  };
  if (!db || variantIds.length === 0) return empty;

  // Una sola query agrupando por variant + kind, contando DISTINCT anonId.
  const rows = await db
    .select({
      variantId: abEvents.variantId,
      kind: abEvents.kind,
      uniques: countDistinctInt(abEvents.anonId),
    })
    .from(abEvents)
    .where(eq(abEvents.testId, testId))
    .groupBy(abEvents.variantId, abEvents.kind);

  const stats = new Map<string, { imp: number; conv: number }>();
  for (const id of variantIds) stats.set(id, { imp: 0, conv: 0 });
  for (const r of rows) {
    const cur = stats.get(r.variantId);
    if (!cur) continue;
    if (r.kind === "impression") cur.imp = r.uniques;
    else if (r.kind === "conversion") cur.conv = r.uniques;
  }

  const control = controlId ? stats.get(controlId) : null;
  const controlImp = control?.imp ?? 0;
  const controlConv = control?.conv ?? 0;
  const controlRate = controlImp > 0 ? controlConv / controlImp : 0;

  let totalImp = 0;
  let totalConv = 0;
  let leaderId: string | null = null;
  let leaderRate = -1;
  let bestSigId: string | null = null;
  let bestSigLift = 0;

  const variants: VariantStats[] = variantIds.map((id) => {
    const s = stats.get(id) ?? { imp: 0, conv: 0 };
    totalImp += s.imp;
    totalConv += s.conv;
    const rate = s.imp > 0 ? s.conv / s.imp : 0;
    const reached = s.imp >= minSampleSize;
    let liftVsControl: number | null = null;
    let pValue: number | null = null;
    let isSig = false;
    if (id === controlId) {
      liftVsControl = 0;
    } else if (controlRate > 0 && rate > 0) {
      liftVsControl = ((rate - controlRate) / controlRate) * 100;
    } else if (controlImp > 0 && s.imp > 0) {
      liftVsControl = rate > 0 ? Number.POSITIVE_INFINITY : 0;
    }
    if (controlId && id !== controlId && controlImp > 0 && s.imp > 0) {
      pValue = chiSquaredP2x2(controlConv, controlImp - controlConv, s.conv, s.imp - s.conv);
      isSig = pValue !== null && pValue < 0.05 && reached && rate > controlRate;
    }
    if (reached && rate > leaderRate) {
      leaderRate = rate;
      leaderId = id;
    }
    if (isSig && liftVsControl !== null && liftVsControl > bestSigLift) {
      bestSigLift = liftVsControl;
      bestSigId = id;
    }
    return {
      variantId: id,
      uniqueImpressions: s.imp,
      uniqueConversions: s.conv,
      conversionRate: rate,
      liftVsControl,
      pValueVsControl: pValue,
      reachedMinSample: reached,
      isSignificant: isSig,
    };
  });

  return {
    totalImpressions: totalImp,
    totalConversions: totalConv,
    variants,
    leaderId,
    significantWinnerId: bestSigId,
  };
}

/**
 * Chi-squared 2×2 con corrección de Yates. Tabla:
 *
 *           Convert  No-Convert
 *  Control     a         b
 *  Variant     c         d
 *
 * Devuelve p-value (two-tailed). null si alguna celda esperada < 5 (fórmula
 * inadecuada con esos sample sizes).
 */
export function chiSquaredP2x2(a: number, b: number, c: number, d: number): number | null {
  const n = a + b + c + d;
  if (n === 0) return null;
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const col2 = b + d;
  // Frecuencias esperadas
  const ea = (row1 * col1) / n;
  const eb = (row1 * col2) / n;
  const ec = (row2 * col1) / n;
  const ed = (row2 * col2) / n;
  if (ea < 5 || eb < 5 || ec < 5 || ed < 5) return null;
  // Yates' correction
  const yatesAdj = (o: number, e: number) => Math.max(0, Math.abs(o - e) - 0.5) ** 2 / e;
  const chi = yatesAdj(a, ea) + yatesAdj(b, eb) + yatesAdj(c, ec) + yatesAdj(d, ed);
  return pValueChiSquaredDf1(chi);
}

/**
 * P-value para chi-squared con df=1 = P(χ²>x) = erfc(sqrt(x/2)).
 * Implementación numérica de erfc (Abramowitz & Stegun 7.1.26, accuracy 1.5e-7).
 */
export function pValueChiSquaredDf1(chi: number): number {
  if (chi <= 0) return 1;
  if (!Number.isFinite(chi)) return 0;
  return erfc(Math.sqrt(chi / 2));
}

function erfc(x: number): number {
  // erfc(x) = 1 - erf(x). Para x>=0 usamos series compacta.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  // erf(-x) = -erf(x); erfc(-x) = 2 - erfc(x)
  const erfVal = sign * y;
  return 1 - erfVal;
}

/** Formatea p-value para UI: "<0.001", "0.023", "n/d". */
export function formatPValue(p: number | null): string {
  if (p === null) return "n/d";
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

/** Formatea conversion rate. */
export function formatRate(r: number): string {
  return `${(r * 100).toFixed(2)}%`;
}

/** Formatea lift %. */
export function formatLift(lift: number | null): string {
  if (lift === null) return "—";
  if (!Number.isFinite(lift)) return "+∞";
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${lift.toFixed(1)}%`;
}
