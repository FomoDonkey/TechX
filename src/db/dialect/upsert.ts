/**
 * Helper unificado para UPSERT (INSERT con conflict resolution).
 *
 * Postgres: `INSERT ... ON CONFLICT (target) DO UPDATE SET ...`
 * MySQL:    `INSERT ... ON DUPLICATE KEY UPDATE ...`
 *
 * MySQL no permite especificar el target del conflict — siempre dispara
 * sobre cualquier UNIQUE o PRIMARY KEY. Postgres sí permite especificar.
 * El helper exige `target` por consistencia, pero solo lo usa en Postgres.
 *
 * Patrón típico:
 *   await upsert(users, {
 *     values: { id, email, name },
 *     target: users.email,   // qué columna provoca el conflict (PG only)
 *     set: { name }           // qué actualizar si conflict
 *   });
 */

import { db, dialect } from "@/db/client";
import type { PgTable } from "drizzle-orm/pg-core";

type AnyTable = PgTable;
// biome-ignore lint/suspicious/noExplicitAny: target column type varies per table
type ColumnRef = any;

export async function upsert<T extends AnyTable>(
  table: T,
  args: {
    values: Record<string, unknown> | Array<Record<string, unknown>>;
    target: ColumnRef | ColumnRef[];
    set: Record<string, unknown>;
  },
): Promise<void> {
  if (!db) throw new Error("db_not_configured");

  if (dialect === "postgres") {
    await db
      .insert(table)
      .values(args.values as never)
      .onConflictDoUpdate({
        target: args.target,
        set: args.set as never,
      });
    return;
  }

  // MySQL: ON DUPLICATE KEY UPDATE
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle MySQL chain typing
  await (db.insert(table).values(args.values as never) as any).onDuplicateKeyUpdate({
    set: args.set,
  });
}

/**
 * Helper unificado para INSERT que ignora duplicados (no actualiza).
 *
 * Postgres: `INSERT ... ON CONFLICT [(target)] DO NOTHING`
 * MySQL:    `INSERT IGNORE ...` (ignora silenciosamente PK/UNIQUE conflicts)
 *
 * Útil para seeds idempotentes: si el row ya existe, lo dejas como está.
 *
 * **`target` es opcional.** Si se omite:
 *   - Postgres dispara con cualquier UNIQUE/PK del table (válido y suficiente
 *     en la mayoría de casos race-safe).
 *   - MySQL ignora target siempre (INSERT IGNORE captura cualquier conflict).
 *
 * Patrones:
 *   // Con target (recomendado para claridad):
 *   await upsertNothing(collections, {
 *     values: { workspaceId, slug, name },
 *     target: [collections.workspaceId, collections.slug],
 *   });
 *
 *   // Sin target (cualquier UNIQUE/PK del table):
 *   await upsertNothing(abAssignments, { values: rows });
 */
export async function upsertNothing<T extends AnyTable>(
  table: T,
  args: {
    values: Record<string, unknown> | Array<Record<string, unknown>>;
    target?: ColumnRef | ColumnRef[];
  },
): Promise<void> {
  if (!db) throw new Error("db_not_configured");

  if (dialect === "postgres") {
    const q = db.insert(table).values(args.values as never);
    if (args.target) {
      await q.onConflictDoNothing({ target: args.target });
    } else {
      await q.onConflictDoNothing();
    }
    return;
  }

  // MySQL: INSERT IGNORE — silencia conflictos PK/UNIQUE sin tocar la fila
  // existente. Equivalente cross-dialect a onConflictDoNothing.
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle MySQL chain typing
  await (db.insert(table).values(args.values as never) as any).ignore();
}
