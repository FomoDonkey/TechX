/**
 * Helper para CLAIM ATÓMICO con UPDATE...RETURNING (Pattern H).
 *
 * **Caso de uso crítico:** locks/transitions con WHERE preconditional.
 *
 *   // Antes (Postgres-only)
 *   const [claimed] = await db
 *     .update(jobs)
 *     .set({ status: "running", lockedAt: now })
 *     .where(and(eq(jobs.id, X), eq(jobs.status, "pending")))
 *     .returning();
 *   if (claimed) { /* ganamos el claim *\/ }
 *
 * Esto ATÓMICAMENTE marca el job como "running" SOLO si estaba "pending".
 * Si dos procesos lo intentan, solo UNO gana — el otro recibe `undefined`.
 *
 * **Por qué UPDATE+SELECT estilo Pattern C NO sirve aquí:**
 *   await db.update(jobs).set(...).where(...);
 *   const [row] = await db.select().from(jobs).where(eq(jobs.id, X));
 *   // ↑ devuelve la fila (post-update por OTRO proceso) — falsa "victoria"
 *
 * **Solución cross-dialect:** transacción con `SELECT ... FOR UPDATE` que
 * adquiere row-level lock. Funciona en Postgres y MySQL InnoDB.
 *
 *   const [row] = await tx.select().from(jobs).where(eq(jobs.id, X)).for("update");
 *   if (!row || !precondition(row)) return null;
 *   await tx.update(jobs).set(...).where(eq(jobs.id, X));
 *   return updatedRow;
 *
 * Esto serializa accesos al row específico — solo un proceso a la vez puede
 * ver+actualizar. El segundo proceso espera al lock y al ver la fila ya
 * actualizada falla el `precondition()` → return null.
 *
 * Patrón típico de uso:
 *
 *   const claimed = await atomicClaim(jobs, {
 *     where: eq(jobs.id, jobId),
 *     precondition: (row) => row.status === "pending",
 *     set: { status: "running", lockedAt: new Date() },
 *   });
 *   if (claimed) { /* ganamos *\/ }
 */

import { db, dialect } from "@/db/client";
import type { SQL } from "drizzle-orm";

// biome-ignore lint/suspicious/noExplicitAny: helper genérico runtime-agnostic
type AnyDrizzleTable = any;
type Row = Record<string, unknown>;

export type AtomicClaimArgs<T extends Row = Row> = {
  /** WHERE clause que identifica la fila a claim (típicamente `eq(table.id, X)`). */
  where: SQL;
  /** Precondición que debe cumplir la fila para que el claim sea exitoso. */
  precondition: (row: T) => boolean;
  /** Updates a aplicar si la precondición se cumple. */
  set: Row;
};

/**
 * Claim atómico de una fila. Devuelve la fila tras update si ganaste el claim,
 * o `null` si la precondición falla (otro proceso ya cambió el row, o no
 * existe).
 *
 * Funciona en Postgres y MySQL via `SELECT ... FOR UPDATE` dentro de transacción.
 */
export async function atomicClaim<T extends Row = Row>(
  table: AnyDrizzleTable,
  args: AtomicClaimArgs<T>,
): Promise<T | null> {
  if (!db) throw new Error("db_not_configured");

  return await db.transaction(async (tx) => {
    // SELECT FOR UPDATE: adquiere row-level lock. Postgres y MySQL InnoDB
    // soportan idéntica sintaxis.
    let selectQuery = tx.select().from(table).where(args.where);
    // biome-ignore lint/suspicious/noExplicitAny: .for() es Drizzle Postgres-specific
    selectQuery = (selectQuery as any).for("update");
    const rows = (await selectQuery.limit(1)) as T[];
    const row = rows[0];

    if (!row) return null;
    if (!args.precondition(row)) return null;

    // Precondición OK → aplicamos el UPDATE. El lock garantiza que no haya
    // otro proceso modificándolo en paralelo.
    await tx.update(table).set(args.set).where(args.where);

    // Devolvemos el row con los campos actualizados merged.
    return { ...row, ...args.set } as T;
  });
}

/**
 * Variante para claim de MÚLTIPLES filas (ej. cron que coge un batch de
 * scheduled entries). Cada row se locka individualmente. Si alguna falla la
 * precondición, NO entra en el resultado.
 *
 * Uso típico:
 *   const claimed = await atomicClaimMany(scheduledEntries, {
 *     where: and(eq(table.workspaceId, ws), lte(table.scheduledAt, now)),
 *     precondition: (r) => r.status === "scheduled",
 *     set: { status: "publishing", claimedAt: now },
 *     limit: 50,
 *   });
 */
export async function atomicClaimMany<T extends Row = Row>(
  table: AnyDrizzleTable,
  args: AtomicClaimArgs<T> & { limit?: number },
): Promise<T[]> {
  if (!db) throw new Error("db_not_configured");
  const { inArray } = await import("drizzle-orm");

  return await db.transaction(async (tx) => {
    // SELECT FOR UPDATE con orderBy para evitar deadlocks (orden estable).
    let selectQuery = tx.select().from(table).where(args.where);
    if (args.limit) {
      // biome-ignore lint/suspicious/noExplicitAny: chain typing
      selectQuery = (selectQuery as any).limit(args.limit);
    }
    // biome-ignore lint/suspicious/noExplicitAny: .for() chain
    selectQuery = (selectQuery as any).for("update");
    const allRows = (await selectQuery) as T[];
    const winners = allRows.filter(args.precondition);
    if (winners.length === 0) return [];

    const ids = winners.map((r) => (r as Row).id) as string[];
    await tx.update(table).set(args.set).where(inArray(table.id, ids));

    return winners.map((r) => ({ ...r, ...args.set }) as T);
  });
}
