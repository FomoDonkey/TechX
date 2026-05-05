/**
 * Vector search helpers cross-dialect.
 *
 * Tres backends posibles:
 *
 *  | Backend       | Storage                | Distance op                              |
 *  |---------------|------------------------|------------------------------------------|
 *  | pgvector      | `vector(N)` col        | `col <=> '[v]'::vector` (cosine distance)|
 *  | MySQL 9+      | `VECTOR(N)` col        | `VEC_DISTANCE(col, ?, "COSINE")`         |
 *  | MySQL <9      | (sin soporte nativo)   | NO soportado — usar Qdrant external      |
 *
 * **Por qué fragmentos SQL en vez de un adapter completo:** el call-site
 * tiene queries complejas (joins, where compuesto, paginación) que cambian
 * por feature. Encapsular toda la query forzaría una API enorme. En cambio,
 * solo extraemos las dos primitivas dialect-specific:
 *
 *  - `cosineDistance(col, vec)` — SQL fragment para SELECT/WHERE/ORDER BY.
 *  - `vectorLiteral(vec)`       — SQL fragment para `.set({ embedding: ... })`.
 *
 * Los call-sites usan Drizzle normal con estos fragments.
 *
 * **MySQL 9 VEC_DISTANCE:**
 *   Toma vector como string `[0.1, 0.2, ...]`. Distance type "COSINE", "EUCLIDEAN",
 *   "DOT". Devuelve FLOAT entre 0 (idéntico) y 2 (opuesto) para COSINE.
 *
 * **pgvector `<=>`:**
 *   Toma vector como `'[0.1,0.2,...]'::vector`. Devuelve double 0..2 para cosine.
 *
 * Score normalizado en JS: ambos backends devuelven distance 0..2,
 * `similarity = 1 - distance / 2` está en [0, 1].
 */

import { dialect } from "@/db/client";
import { type SQL, sql } from "drizzle-orm";

/** Serializa un `number[]` al formato que ambos backends parsean: `[0.1,0.2,...]`. */
export function vectorToString(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * SQL fragment para distancia coseno entre `column` y `vec`.
 * Devuelve un valor 0..2 (0 = idéntico). Usar en SELECT/WHERE/ORDER BY.
 *
 * Postgres: `column <=> '[v]'::vector`
 * MySQL 9+: `VEC_DISTANCE(column, ?, "COSINE")`
 */
export function cosineDistance(column: SQL | unknown, vec: number[]): SQL<number> {
  const literal = vectorToString(vec);
  if (dialect === "mysql") {
    return sql<number>`VEC_DISTANCE(${column}, ${literal}, "COSINE")`;
  }
  return sql<number>`${column} <=> ${literal}::vector`;
}

/**
 * SQL fragment para asignar un vector a una column embedding.
 * Usar dentro de `.set({ embedding: vectorLiteral(vec) as never })` (cast porque
 * Drizzle column type es vector(N) typed como `unknown`).
 *
 * Postgres: `'[v]'::vector`
 * MySQL 9+: `STRING_TO_VEC('[v]')` — MySQL acepta el literal directamente como
 * string en columnas VECTOR, pero `STRING_TO_VEC` es la forma explícita
 * recomendada y futureproof.
 */
export function vectorLiteral(vec: number[]): SQL {
  const literal = vectorToString(vec);
  if (dialect === "mysql") {
    return sql`STRING_TO_VEC(${literal})`;
  }
  return sql`${literal}::vector`;
}

/**
 * Convierte distance a similarity score [0, 1]. Mismo cálculo en ambos
 * backends — la distance está normalizada a [0, 2] en COSINE.
 */
export function distanceToSimilarity(distance: number): number {
  return Math.max(0, 1 - distance / 2);
}
