/**
 * Helpers de fecha/hora cross-dialect (PG ↔ MySQL).
 *
 * Se usan en agregaciones por intervalos (dashboard, calendar, A/B analytics)
 * donde Postgres tiene `date_trunc()` + `to_char()` y MySQL tiene
 * `DATE_FORMAT()` con sintaxis distinta.
 *
 * Patrón típico:
 *
 *   db.select({
 *     day: dateTrunc("day", entries.createdAt),
 *     count: count(),
 *   }).from(entries).groupBy(dateTrunc("day", entries.createdAt));
 */

import { dialect } from "@/db/client";
import { type SQL, sql } from "drizzle-orm";

/**
 * Granularidades soportadas por ambos motores.
 *  - hour:  Postgres `date_trunc('hour', col)` / MySQL `DATE_FORMAT(col, '%Y-%m-%d %H:00:00')`
 *  - day:   Postgres `date_trunc('day', col)`  / MySQL `DATE(col)`
 *  - week:  Postgres `date_trunc('week', col)` / MySQL `DATE_SUB(DATE(col), INTERVAL WEEKDAY(col) DAY)` (lunes ISO)
 *  - month: Postgres `date_trunc('month', col)`/ MySQL `DATE_FORMAT(col, '%Y-%m-01')`
 *  - year:  Postgres `date_trunc('year', col)` / MySQL `DATE_FORMAT(col, '%Y-01-01')`
 */
export type DateUnit = "hour" | "day" | "week" | "month" | "year";

/**
 * Trunca un timestamp/date a la granularidad indicada. Devuelve un SQL
 * fragment usable en SELECT, GROUP BY, ORDER BY, WHERE.
 *
 * Para `unit:"day"` el resultado es `DATE` en MySQL (sin hora) y
 * `timestamp` (con hora 00:00:00) en Postgres. Si el caller necesita
 * normalizar a string para JS, usa `formatDate(col, "iso-day")`.
 */
export function dateTrunc(unit: DateUnit, column: SQL | unknown): SQL<Date> {
  if (dialect === "postgres") {
    // El unit DEBE inlinearse (no parametrizarse) para que el planner reconozca
    // la misma expresión en SELECT y GROUP BY. `${unit}` lo convierte en `$N`,
    // y entonces SELECT `date_trunc('day', col)` ≠ GROUP BY `date_trunc($N, col)`
    // → "column must appear in GROUP BY". Switch sobre enum cerrado.
    switch (unit) {
      case "hour":
        return sql<Date>`date_trunc('hour', ${column})`;
      case "day":
        return sql<Date>`date_trunc('day', ${column})`;
      case "week":
        return sql<Date>`date_trunc('week', ${column})`;
      case "month":
        return sql<Date>`date_trunc('month', ${column})`;
      case "year":
        return sql<Date>`date_trunc('year', ${column})`;
    }
  }
  // MySQL — sin date_trunc nativo, mapeo a DATE_FORMAT/DATE/INTERVAL
  switch (unit) {
    case "hour":
      return sql<Date>`DATE_FORMAT(${column}, '%Y-%m-%d %H:00:00')`;
    case "day":
      return sql<Date>`DATE(${column})`;
    case "week":
      // ISO week starting on Monday — equivalente a date_trunc('week', col)
      return sql<Date>`DATE_SUB(DATE(${column}), INTERVAL WEEKDAY(${column}) DAY)`;
    case "month":
      return sql<Date>`DATE_FORMAT(${column}, '%Y-%m-01')`;
    case "year":
      return sql<Date>`DATE_FORMAT(${column}, '%Y-01-01')`;
  }
}

/**
 * Formatea una fecha a string ISO `YYYY-MM-DD`. Devuelve un SQL fragment
 * tipado como string. Postgres usa `to_char(date_trunc(...))`; MySQL usa
 * `DATE_FORMAT(...)` directo.
 */
export function formatDateIso(column: SQL | unknown): SQL<string> {
  if (dialect === "postgres") {
    return sql<string>`to_char(date_trunc('day', ${column}), 'YYYY-MM-DD')`;
  }
  return sql<string>`DATE_FORMAT(${column}, '%Y-%m-%d')`;
}

/**
 * `EXTRACT(DOW FROM col)` cross-dialect.
 *
 * Postgres `EXTRACT(DOW FROM ts)` → 0-6 (domingo=0, sábado=6). Cast `::int`.
 * MySQL `DAYOFWEEK(ts)` → 1-7 (domingo=1, sábado=7). Restamos 1 para igualar
 * el rango Postgres (0-6). El consumidor de la query no nota la diferencia.
 */
export function extractDayOfWeek(column: SQL | unknown): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`EXTRACT(DOW FROM ${column})::int`;
  }
  return sql<number>`(DAYOFWEEK(${column}) - 1)`;
}

/**
 * `EXTRACT(HOUR FROM col)` cross-dialect.
 *
 * Postgres `EXTRACT(HOUR FROM ts)` → 0-23. Cast `::int`.
 * MySQL `HOUR(ts)` → 0-23. Idéntico.
 */
export function extractHour(column: SQL | unknown): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`EXTRACT(HOUR FROM ${column})::int`;
  }
  return sql<number>`HOUR(${column})`;
}

/**
 * `COUNT(*)::int` cross-dialect (devuelve number garantizado).
 *
 * Postgres-js devuelve bigint como string si no se castea. `::int` lo
 * convierte a int4 antes de salir → JS number directo.
 * MySQL2 devuelve BIGINT como number si cabe en MAX_SAFE_INTEGER, y como
 * string si supera. `CAST(... AS SIGNED)` es idempotente y deja el
 * comportamiento estable.
 *
 * Nota: drizzle-orm tiene `count()` pero no aplica el cast `::int`,
 * por lo que en Postgres puede devolver string.
 */
export function countInt(): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`count(*)::int`;
  }
  return sql<number>`CAST(COUNT(*) AS SIGNED)`;
}

/**
 * `SUM(col)::int` cross-dialect (devuelve number).
 * Útil para agregaciones de columnas integer/bigint que devolverían string
 * en postgres-js sin cast.
 */
export function sumInt(column: SQL | unknown): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`COALESCE(SUM(${column}), 0)::int`;
  }
  return sql<number>`COALESCE(CAST(SUM(${column}) AS SIGNED), 0)`;
}

/**
 * `COUNT(DISTINCT col)::int` cross-dialect.
 */
export function countDistinctInt(column: SQL | unknown): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`COUNT(DISTINCT ${column})::int`;
  }
  return sql<number>`CAST(COUNT(DISTINCT ${column}) AS SIGNED)`;
}

/**
 * `COUNT(*) FILTER (WHERE cond)::int` cross-dialect.
 *
 * Postgres: sintaxis `FILTER (WHERE ...)` SQL-2003 estándar pero solo PG y
 *           pocos motores la implementan.
 * MySQL: equivalente con `SUM(CASE WHEN cond THEN 1 ELSE 0 END)`.
 *
 * Útil para agregaciones por estado en una sola query (`stats.sent`,
 * `stats.failed`, etc. en campaigns/imports).
 *
 * Pattern:
 *   {
 *     sent: countFilterInt(sql\`${col} = 'sent'\`),
 *     failed: countFilterInt(sql\`${col} = 'failed'\`),
 *   }
 */
export function countFilterInt(condition: SQL): SQL<number> {
  if (dialect === "postgres") {
    return sql<number>`count(*) filter (where ${condition})::int`;
  }
  return sql<number>`CAST(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END) AS SIGNED)`;
}
