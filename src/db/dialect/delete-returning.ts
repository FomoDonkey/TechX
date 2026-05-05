/**
 * Helper para DELETE que devuelve número de filas borradas (Pattern F).
 *
 * Postgres soporta `db.delete(table).where(...).returning()` que devuelve
 * las filas borradas. MySQL NO. Patrón cross-dialect:
 *
 *   1. SELECT ids matching el WHERE
 *   2. DELETE WHERE id IN (...ids)
 *   3. Devolver count = ids.length
 *
 * Esto cuesta 1 query extra. Aceptable porque DELETE batch suele ser cleanup
 * (no hot path). Si necesitas las filas COMPLETAS borradas (no solo ids),
 * usa `deleteReturningRows`.
 *
 * Patrón típico de uso (refactor mecánico):
 *
 *   // Antes (Postgres-only)
 *   const result = await db.delete(jobs).where(...).returning({ id: jobs.id });
 *   const count = result.length;
 *
 *   // Después
 *   import { deleteReturningCount } from "@/db/dialect";
 *   const count = await deleteReturningCount(jobs, where);
 */

import { db, dialect } from "@/db/client";
import { type SQL, inArray } from "drizzle-orm";

// biome-ignore lint/suspicious/noExplicitAny: helper genérico runtime-agnostic
type AnyDrizzleTable = any;

/**
 * Borra filas matching `where` y devuelve el count de filas afectadas.
 * Cross-dialect-safe.
 */
export async function deleteReturningCount(table: AnyDrizzleTable, where: SQL): Promise<number> {
  if (!db) throw new Error("db_not_configured");

  if (dialect === "postgres") {
    // Postgres: 1 query con RETURNING (eficiente)
    const result = await db.delete(table).where(where).returning({ id: table.id });
    return result.length;
  }

  // MySQL: SELECT + DELETE. Hacemos en transacción para evitar race condition
  // donde otro proceso inserta entre SELECT y DELETE.
  return await db.transaction(async (tx) => {
    const rows = await tx.select({ id: table.id }).from(table).where(where);
    if (rows.length === 0) return 0;
    const ids = rows.map((r) => r.id) as string[];
    await tx.delete(table).where(inArray(table.id, ids));
    return ids.length;
  });
}

/**
 * Borra filas matching `where` y devuelve las FILAS COMPLETAS borradas.
 * Útil cuando necesitas más que el count (ej. emitir webhook con datos del row).
 */
export async function deleteReturningRows(
  table: AnyDrizzleTable,
  where: SQL,
): Promise<Array<Record<string, unknown>>> {
  if (!db) throw new Error("db_not_configured");

  if (dialect === "postgres") {
    return (await db.delete(table).where(where).returning()) as Array<Record<string, unknown>>;
  }

  return await db.transaction(async (tx) => {
    const rows = (await tx.select().from(table).where(where)) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id) as string[];
    await tx.delete(table).where(inArray(table.id, ids));
    return rows;
  });
}
