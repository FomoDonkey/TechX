/**
 * Helpers para INSERT que devuelven la fila completa cross-dialect.
 *
 * Problema: MySQL **no soporta `RETURNING`** en INSERT/UPDATE. El patrón
 * estándar es:
 *   1. Generar el id app-side (`crypto.randomUUID()`)
 *   2. INSERT con ese id
 *   3. SELECT * WHERE id = <id_generado>
 *
 * Postgres tiene `RETURNING` nativo y es más eficiente (1 round-trip).
 *
 * Estos helpers abstraen ambos casos. El call-site usa la misma API:
 *
 *   const row = await insertReturning(users, { id: crypto.randomUUID(), email: "..." });
 *
 * Reglas:
 *  - El caller DEBE pasar `id` en `values` (o cualquier columna PK).
 *    Si no, el helper falla con error claro porque MySQL no podría hacer
 *    el SELECT post-INSERT.
 *  - Los defaults SQL (createdAt, updatedAt) se obtienen via SELECT
 *    posterior, así que el row devuelto tiene los timestamps reales.
 */

import { db, dialect } from "@/db/client";
import { eq, inArray } from "drizzle-orm";

// Drizzle's table types son demasiado complejos para tipar genéricamente
// aquí. Los call-sites pasan tablas tipadas (`users`, `pages`, etc.) y el
// helper hace runtime dispatch. La type safety viene del callsite, no del
// helper.
// biome-ignore lint/suspicious/noExplicitAny: helper genérico runtime-agnostic
type AnyDrizzleTable = any;
type Row = Record<string, unknown>;

/**
 * INSERT + return de la fila resultante. Funciona en Postgres y MySQL.
 *
 * @param table — tabla Drizzle (importada del schema barrel)
 * @param values — valores a insertar. DEBE incluir `id` (string o número PK).
 * @returns la fila completa con todos los campos resueltos (incluidos defaults SQL)
 *
 * @throws Si `db` no está configurada o `values.id` no está presente.
 */
export async function insertReturning(table: AnyDrizzleTable, values: Row): Promise<Row> {
  if (!db) throw new Error("db_not_configured");
  if (!("id" in values) || values.id === undefined || values.id === null) {
    throw new Error(
      "insertReturning requires `id` in values. Generate with crypto.randomUUID() before insert.",
    );
  }

  if (dialect === "postgres") {
    const [row] = await db.insert(table).values(values).returning();
    if (!row) throw new Error("insert_failed_no_row_returned");
    return row as Row;
  }

  // MySQL: 2 queries (INSERT + SELECT por id)
  await db.insert(table).values(values);
  const [row] = await db.select().from(table).where(eq(table.id, values.id)).limit(1);
  if (!row) throw new Error("insert_succeeded_but_select_failed");
  return row as Row;
}

/**
 * Variante para INSERT batch que devuelve TODAS las filas insertadas.
 * Cada elemento de `values` DEBE tener `id`.
 *
 * En MySQL hace SELECT con `IN (...ids)` para una sola query post-INSERT.
 */
export async function insertReturningMany(table: AnyDrizzleTable, values: Row[]): Promise<Row[]> {
  if (!db) throw new Error("db_not_configured");
  if (values.length === 0) return [];
  for (const v of values) {
    if (!("id" in v) || v.id === undefined || v.id === null) {
      throw new Error("insertReturningMany requires `id` in every value");
    }
  }

  if (dialect === "postgres") {
    return (await db.insert(table).values(values).returning()) as Row[];
  }

  // MySQL: insert batch + select por ids
  await db.insert(table).values(values);
  const ids = values.map((v) => v.id) as string[];
  return (await db.select().from(table).where(inArray(table.id, ids))) as Row[];
}
