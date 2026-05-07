/**
 * Helpers para búsqueda case-insensitive cross-dialect.
 *
 * Postgres: `ILIKE` (case-insensitive built-in).
 * MySQL: `LIKE` con collation `*_ci` (case-insensitive por default en MySQL 8).
 *        Si la collation es _bin/_cs, forzamos LOWER() en ambos lados.
 *
 * Patrón típico de uso:
 *   .where(iLike(users.email, `%${q}%`))
 *   .where(ciContains(users.email, q))    // alias claro para "contiene"
 */

import { dialect } from "@/db/client";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * SQL fragment `<column> ILIKE <pattern>` (Postgres) o
 * `LOWER(<column>) LIKE LOWER(<pattern>)` (MySQL — más portable que
 * confiar en collation).
 *
 * `pattern` debe incluir los wildcards `%` y `_` ya escapados si vienen
 * de input de usuario (no escape automático aquí — responsabilidad del
 * caller para evitar SQL injection vía template strings).
 */
export function iLike(column: SQL.Aliased | SQL | unknown, pattern: string): SQL {
  if (dialect === "postgres") {
    return sql`${column} ILIKE ${pattern}`;
  }
  return sql`LOWER(${column}) LIKE LOWER(${pattern})`;
}

/**
 * Helper más legible que envuelve `%term%` automáticamente.
 * Equivalente a `iLike(col, \`%${term}%\`)`.
 *
 * Hace escape básico de `%` y `_` en `term` para que el wildcard solo
 * actúe en los `%` añadidos por el helper, no en los del input.
 */
export function ciContains(column: SQL.Aliased | SQL | unknown, term: string): SQL {
  // Escape de wildcards que un user podría inyectar en su query
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const pattern = `%${escaped}%`;
  if (dialect === "postgres") {
    return sql`${column} ILIKE ${pattern}`;
  }
  return sql`LOWER(${column}) LIKE LOWER(${pattern})`;
}

/**
 * Búsqueda fuzzy case-insensitive sobre columnas JSON/JSONB.
 *
 * Postgres: `${col}::text ILIKE ${pattern}` — el cast a text serializa el
 * JSON entero y permite buscar substrings.
 * MySQL: `LOWER(CAST(${col} AS CHAR)) LIKE LOWER(${pattern})` — `CAST AS
 * CHAR` produce la representación JSON-formateada como string. Suficiente
 * para inboxes pequeños / búsqueda admin (no es un FTS).
 *
 * `pattern` debe incluir wildcards (`%foo%`). Para escape automático,
 * usa `ciContainsJson` análogo a `ciContains`.
 */
export function iLikeJson(column: SQL.Aliased | SQL | unknown, pattern: string): SQL {
  if (dialect === "postgres") {
    return sql`${column}::text ILIKE ${pattern}`;
  }
  return sql`LOWER(CAST(${column} AS CHAR)) LIKE LOWER(${pattern})`;
}
