/**
 * Engine de resolución sticky de tests A/B (F8c).
 *
 * Flujo SSR:
 *  1. resolveTestsForKeys(workspaceId, anonId, keys) — devuelve un mapa
 *     testKey → variantId, leyendo o creando assignments.
 *  2. RenderLayout consume el mapa via RenderContext.abMap.
 *  3. Impressions se registran async post-render con `recordImpressions`.
 *
 * Garantías:
 *  - Sticky por (testId, anonId): mismo anon recibe SIEMPRE la misma variant
 *    aunque cambien los pesos (el assignment se persiste).
 *  - Atomic insert con onConflictDoNothing: si dos requests del mismo anon
 *    llegan a la vez, solo una persiste; la otra lee la ya creada.
 *  - Hash determinista como fallback cuando no podemos persistir (DB
 *    desconectada): mismo anon → misma variant en esa sesión.
 */

import type { AbResolution, AbResolutionMap, AbVariant } from "@/ab/types";
import { consume } from "@/api/rate-limit";
import { db } from "@/db/client";
import { abAssignments, abTests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Rate-limit defensivo de NUEVOS assignments por IP. Sin esto, un atacante
 * que rota la cookie csm_aid podría crear ilimitadas filas en `ab_assignments`
 * (DoS-económico en DB). 2000 nuevos assignments/h por IP es suficientemente
 * generoso para usuarios legítimos en multi-test pages.
 */
const IP_ASSIGNMENT_LIMIT = 2000;
const IP_ASSIGNMENT_WINDOW_MS = 60 * 60 * 1000;

export type ActiveTest = {
  id: string;
  key: string;
  variants: AbVariant[];
};

/**
 * Lee tests activos (status=running) por keys. Filtrado por workspace.
 * Devuelve sólo tests con variants válidos (>=2 variants, suma 100).
 */
export async function loadActiveTestsByKeys(
  workspaceId: string,
  keys: string[],
): Promise<ActiveTest[]> {
  if (!db || keys.length === 0) return [];
  const rows = await db
    .select({
      id: abTests.id,
      key: abTests.key,
      variants: abTests.variants,
      status: abTests.status,
    })
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), inArray(abTests.key, keys)));
  const out: ActiveTest[] = [];
  for (const r of rows) {
    if (r.status !== "running") continue;
    const variants = parseVariants(r.variants);
    if (variants.length < 2) continue;
    out.push({ id: r.id, key: r.key, variants });
  }
  return out;
}

/** Parsea + valida variants de un jsonb. Devuelve [] si inválido. */
export function parseVariants(raw: unknown): AbVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: AbVariant[] = [];
  let totalWeight = 0;
  for (const v of raw) {
    if (!v || typeof v !== "object") return [];
    const obj = v as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : null;
    const label = typeof obj.label === "string" ? obj.label : null;
    const weight = typeof obj.weight === "number" ? Math.floor(obj.weight) : null;
    const isControl = obj.isControl === true;
    const pageId = typeof obj.pageId === "string" && obj.pageId.length === 36 ? obj.pageId : null;
    if (!id || !label || weight === null || weight < 0 || weight > 100) return [];
    if (!/^[a-z0-9_-]{1,32}$/i.test(id)) return [];
    out.push({ id, label, weight, isControl, pageId });
    totalWeight += weight;
  }
  if (out.length < 2) return [];
  // Validación estricta: pesos DEBEN sumar 100. Las server actions de admin
  // ya enforce esto en createAbTestAction/updateAbTestAction. Si llega aquí
  // con suma distinta, la config es inconsistente — devolvemos [] y el
  // engine no incluye este test en el resolution map (caller hace fallback
  // al primer child=control).
  if (totalWeight !== 100) return [];
  return out;
}

/**
 * Hash determinista 32-bit (FNV-1a) sobre `${testId}:${anonId}`. Mapea a
 * 0..99 para selección por pesos. Mismo input → mismo bucket SIEMPRE,
 * independiente de la versión del Node runtime.
 */
function bucketHash(testId: string, anonId: string): number {
  const s = `${testId}:${anonId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Forzamos a unsigned 32-bit y mapeamos a 0..99
  return (h >>> 0) % 100;
}

/** Selecciona variant por hash determinista + pesos. */
export function pickVariantDeterministic(test: ActiveTest, anonId: string): AbVariant {
  const bucket = bucketHash(test.id, anonId); // 0..99
  let acc = 0;
  for (const v of test.variants) {
    acc += v.weight;
    if (bucket < acc) return v;
  }
  // Fallback (suma redondeada): última variant
  const last = test.variants[test.variants.length - 1];
  if (!last) throw new Error("AbTest sin variants — no debería llegar aquí");
  return last;
}

/**
 * Resuelve sticky variants para una lista de testKeys. Side-effect: persiste
 * assignments nuevos en DB. Devuelve `Map<testKey, AbResolution>`.
 *
 * - Lee assignments existentes (1 query).
 * - Para los faltantes calcula determinísticamente y los inserta con
 *   onConflictDoNothing (1 INSERT batched). Luego releemos por si race.
 */
export async function resolveTestsForKeys(
  workspaceId: string,
  anonId: string,
  keys: string[],
  clientIp?: string | null,
): Promise<AbResolutionMap> {
  const out: AbResolutionMap = new Map();
  if (!db || keys.length === 0) return out;

  const tests = await loadActiveTestsByKeys(workspaceId, keys);
  if (tests.length === 0) return out;

  const testIds = tests.map((t) => t.id);

  // 1) Lee assignments existentes para este anon
  const existing = await db
    .select({
      testId: abAssignments.testId,
      variantId: abAssignments.variantId,
    })
    .from(abAssignments)
    .where(and(eq(abAssignments.anonId, anonId), inArray(abAssignments.testId, testIds)));

  const existingMap = new Map(existing.map((e) => [e.testId, e.variantId] as const));

  // 2) Categoriza:
  //    a) tests sin assignment → calculamos y INSERT con DO NOTHING
  //       (race entre dos requests del mismo anon: hash determinista garantiza
  //        misma variant, sólo uno persiste).
  //    b) tests con assignment a variant inexistente (variant fue borrada
  //       después de iniciar test) → re-calculamos y UPDATE atómico para
  //       mantener consistencia entre `ab_assignments.variantId` y la
  //       resolución actual. Sin esto, `/api/ab/event` rechaza conversions
  //       silenciosamente porque `variantExists=false` (H3 de auditoría).
  const toInsert: Array<{
    testId: string;
    anonId: string;
    variantId: string;
    workspaceId: string;
  }> = [];
  const toUpdate: Array<{ testId: string; variantId: string }> = [];
  for (const t of tests) {
    const existingVar = existingMap.get(t.id);
    if (existingVar) {
      if (t.variants.some((v) => v.id === existingVar)) {
        out.set(t.key, {
          testId: t.id,
          testKey: t.key,
          variantId: existingVar,
          isFresh: false,
        });
        continue;
      }
      // Variant ya no existe — re-asigna determinísticamente y UPDATE
      const v = pickVariantDeterministic(t, anonId);
      toUpdate.push({ testId: t.id, variantId: v.id });
      out.set(t.key, { testId: t.id, testKey: t.key, variantId: v.id, isFresh: true });
      continue;
    }
    const v = pickVariantDeterministic(t, anonId);
    toInsert.push({ testId: t.id, anonId, variantId: v.id, workspaceId });
    out.set(t.key, { testId: t.id, testKey: t.key, variantId: v.id, isFresh: true });
  }

  if (toInsert.length > 0) {
    // Rate-limit por IP antes de persistir nuevos assignments. Si excede,
    // omitimos el insert (la response contiene el variant calculado en
    // memoria, así que el visitante ve la misma variant pero no consumimos
    // espacio en DB). Defensa anti DoS-económico de DB.
    let allowInsert = true;
    if (clientIp) {
      const rl = consume(
        `ab:assign:ip:${clientIp}`,
        IP_ASSIGNMENT_LIMIT,
        IP_ASSIGNMENT_WINDOW_MS,
        toInsert.length,
      );
      if (!rl.ok) allowInsert = false;
    }
    if (allowInsert) {
      // onConflictDoNothing — si otra request paralela ya insertó, ignoramos.
      await db.insert(abAssignments).values(toInsert).onConflictDoNothing();
    }
  }
  if (toUpdate.length > 0) {
    // Updates uno-a-uno: son raros (sólo cuando un admin borra variant en
    // un test running). Promise.all para paralelizar.
    const dbRef = db;
    await Promise.all(
      toUpdate.map(({ testId, variantId }) =>
        dbRef
          .update(abAssignments)
          .set({ variantId })
          .where(and(eq(abAssignments.testId, testId), eq(abAssignments.anonId, anonId))),
      ),
    );
  }

  return out;
}

/**
 * Versión "guest" para builders/preview cuando no hay DB o queremos cero
 * side-effects. Determinístico pero no persiste.
 */
export function resolveTestsEphemeral(tests: ActiveTest[], anonId: string): AbResolutionMap {
  const out: AbResolutionMap = new Map();
  for (const t of tests) {
    const v = pickVariantDeterministic(t, anonId);
    out.set(t.key, { testId: t.id, testKey: t.key, variantId: v.id, isFresh: false });
  }
  return out;
}

/** Resolución vacía — para callers que quieren render sin A/B. */
export function emptyResolutions(): AbResolutionMap {
  return new Map();
}

export type { AbResolution, AbResolutionMap } from "@/ab/types";
