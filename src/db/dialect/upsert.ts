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
