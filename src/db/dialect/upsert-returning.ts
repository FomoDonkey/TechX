/**
 * Helper para UPSERT (INSERT con conflict resolution) que devuelve la fila
 * resultante (Pattern G).
 *
 * Postgres: `INSERT ... ON CONFLICT (target) DO UPDATE SET ... RETURNING *`
 * MySQL: `INSERT ... ON DUPLICATE KEY UPDATE ...` (sin RETURNING) → SELECT por
 *        `uniqueKey` para obtener la fila (insertada o actualizada).
 *
 * Patrón típico de uso:
 *
 *   const row = await upsertReturning(memberships, {
 *     values: { id: crypto.randomUUID(), workspaceId, userId, tier: "pro" },
 *     target: [memberships.workspaceId, memberships.userId],
 *     uniqueKey: { workspaceId, userId },   // valores para SELECT post-upsert (MySQL)
 *     set: { tier: "pro", updatedAt: new Date() },
 *   });
 *
 * Reglas:
 *  - `target`: columnas que disparan ON CONFLICT (Postgres). MySQL ignora — usa
 *    cualquier UNIQUE/PK existente.
 *  - `uniqueKey`: objeto `{ col: valor }` con los campos que identifican la
 *    fila tras el upsert. En Postgres se ignora (usamos RETURNING). En MySQL
 *    es OBLIGATORIO para hacer el SELECT post-upsert.
 *  - `set`: campos a actualizar si ya existe.
 *
 * Variante DoNothing: si `set` es `null`, hace `ON CONFLICT DO NOTHING`
 * (Postgres) o `INSERT IGNORE` (MySQL). Devuelve la fila existente o nueva.
 */

import { db, dialect } from "@/db/client";
import { and, eq } from "drizzle-orm";

// biome-ignore lint/suspicious/noExplicitAny: helper genérico runtime-agnostic
type AnyDrizzleTable = any;
// biome-ignore lint/suspicious/noExplicitAny: target column type varies per table
type ColumnRef = any;
type Row = Record<string, unknown>;

export type UpsertArgs = {
  values: Row;
  target: ColumnRef | ColumnRef[];
  /** valores para SELECT post-upsert en MySQL. Ej: `{ workspaceId: ws, userId: u }` */
  uniqueKey: Row;
  /** Campos a actualizar si conflict. `null` = DO NOTHING / INSERT IGNORE. */
  set: Row | null;
};

export async function upsertReturning(table: AnyDrizzleTable, args: UpsertArgs): Promise<Row> {
  if (!db) throw new Error("db_not_configured");

  if (dialect === "postgres") {
    if (args.set === null) {
      // DO NOTHING + RETURNING devuelve [] si conflict, [row] si insert nuevo.
      // Para devolver row siempre, hacemos fallback SELECT si vacío.
      const inserted = await db
        .insert(table)
        .values(args.values)
        .onConflictDoNothing({ target: args.target })
        .returning();
      if (inserted.length > 0) return inserted[0] as Row;
      // Conflict → SELECT por uniqueKey
      return await selectByUniqueKey(table, args.uniqueKey);
    }
    const [row] = await db
      .insert(table)
      .values(args.values)
      .onConflictDoUpdate({
        target: args.target,
        set: args.set,
      })
      .returning();
    if (!row) throw new Error("upsert_returned_no_row");
    return row as Row;
  }

  // MySQL: INSERT ... ON DUPLICATE KEY UPDATE / INSERT IGNORE
  if (args.set === null) {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle MySQL chain typing
    await (db.insert(table).values(args.values) as any).onDuplicateKeyUpdate({
      // ON DUPLICATE KEY UPDATE id = id  → no-op pero evita error de duplicate key
      set: { id: args.uniqueKey.id ?? args.values.id },
    });
  } else {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle MySQL chain typing
    await (db.insert(table).values(args.values) as any).onDuplicateKeyUpdate({
      set: args.set,
    });
  }
  return await selectByUniqueKey(table, args.uniqueKey);
}

async function selectByUniqueKey(table: AnyDrizzleTable, uniqueKey: Row): Promise<Row> {
  if (!db) throw new Error("db_not_configured");
  const conds = Object.entries(uniqueKey).map(([col, val]) => eq(table[col], val));
  const where = conds.length === 1 ? conds[0] : and(...conds);
  const [row] = await db.select().from(table).where(where).limit(1);
  if (!row) throw new Error("upsert_select_returned_no_row");
  return row as Row;
}
