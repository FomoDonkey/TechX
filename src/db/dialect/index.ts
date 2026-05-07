/**
 * Helpers cross-dialect para queries que tienen sintaxis distinta en
 * Postgres vs MySQL. Cada helper detecta `dialect` desde `db/client.ts`
 * y devuelve el SQL fragment o ejecuta la operación correcta.
 *
 * Diseñado para que los call-sites NO necesiten if/else por dialect —
 * importan el helper y funciona en ambas BDs.
 *
 * Patrones cubiertos (ver `docs/architecture/returning-migration-pattern.md`):
 *
 *  | Pattern | Helper                            | Caso de uso                        |
 *  | A       | `insertReturning(table, values)`  | INSERT + RETURNING simple          |
 *  | B       | (inline en transactions)           | INSERT + RETURNING dentro de tx    |
 *  | C       | (inline UPDATE + SELECT)           | UPDATE + RETURNING simple          |
 *  | D       | `insertReturningMany`              | BATCH INSERT + RETURNING           |
 *  | E       | `iLike` (alias de `ilike`)         | case-insensitive LIKE              |
 *  | F       | `deleteReturningCount/Rows`        | DELETE + count/rows borrados       |
 *  | G       | `upsertReturning`                  | INSERT...ON CONFLICT + RETURNING   |
 *  | H       | `atomicClaim` / `atomicClaimMany` | UPDATE atomic con precondición     |
 *
 * Para queries simples sin patterns especiales, los call-sites siguen
 * usando Drizzle directamente — no se necesita helper.
 */

export { iLike, iLikeJson, ciContains } from "./ilike";
export {
  dateTrunc,
  formatDateIso,
  extractDayOfWeek,
  extractHour,
  countInt,
  sumInt,
  countDistinctInt,
  countFilterInt,
  type DateUnit,
} from "./datetime";
export { insertReturning, insertReturningMany } from "./insert-returning";
export { upsert, upsertNothing } from "./upsert";
export { deleteReturningCount, deleteReturningRows } from "./delete-returning";
export { upsertReturning, type UpsertArgs } from "./upsert-returning";
export { atomicClaim, atomicClaimMany, type AtomicClaimArgs } from "./atomic-claim";
export {
  cosineDistance,
  distanceToSimilarity,
  vectorLiteral,
  vectorToString,
} from "./vector";
