/**
 * Cliente Drizzle dialect-aware.
 *
 * Detecta el dialect del `DATABASE_URL`:
 *  - `postgres://` o `postgresql://`  → driver `postgres-js` + schema.pg
 *  - `mysql://`                        → driver `mysql2` + schema.mysql
 *
 * El export `db` queda tipado como **Postgres** siempre (porque schema.ts
 * re-exporta de schema.pg). Esto es intencional: Drizzle MySQL en runtime
 * ejecuta queries idénticamente porque los types lógicos coinciden — solo
 * cambia el SQL generado.
 *
 * En sitios donde TypeScript se queja de signatures distintas (raros tras
 * Tarea 10 que normaliza queries), usar `if (dialect === "mysql") ...`.
 *
 * Lazy init + global cache (`globalThis.__csmDb`) en dev para evitar
 * recrear pools tras Hot Module Reload de Next.js.
 */

import { env, features } from "@/env";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import mysql from "mysql2/promise";
import postgres from "postgres";
import * as schemaMysql from "./schema.mysql";
import * as schemaPg from "./schema.pg";

export type Dialect = "postgres" | "mysql";

/**
 * Detecta dialect del URL. Default: postgres si no hay URL o no parsea.
 */
export function detectDialect(url: string | undefined | null): Dialect {
  if (!url) return "postgres";
  if (/^mysql:\/\//i.test(url)) return "mysql";
  if (/^postgres(?:ql)?:\/\//i.test(url)) return "postgres";
  // URL inválido — default a postgres (schemaPg) y dejar que postgres-js
  // genere el error claro al intentar conectar.
  return "postgres";
}

export const dialect: Dialect = detectDialect(env.DATABASE_URL);

declare global {
  var __csmDb: unknown;
}

// Tipo del cliente. La unión es necesaria en runtime, pero el code de
// consumers usa los exports de `schema.ts` que están tipados como Postgres
// (drizzle MySQL acepta los mismos métodos `.select`/`.insert`/`.update`).
type DrizzlePgClient = ReturnType<typeof drizzlePg<typeof schemaPg>>;
type DrizzleMysqlClient = ReturnType<typeof drizzleMysql<typeof schemaMysql>>;

function createPgClient(): DrizzlePgClient {
  // postgres-js — comportamiento idéntico al original
  const client = postgres(env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });
  return drizzlePg(client, {
    schema: schemaPg,
    logger: env.NODE_ENV === "development",
  });
}

function createMysqlClient(): DrizzleMysqlClient {
  // mysql2 pool — equivalente a postgres-js connection pool. El cast a
  // `unknown` evita un type clash entre `Pool` de mysql2 (callback) y
  // `Pool` de mysql2/promise dentro de los d.ts de drizzle-orm. En runtime
  // mysql.createPool de mysql2/promise devuelve la API correcta.
  const pool = mysql.createPool({
    uri: env.DATABASE_URL!,
    connectionLimit: 10,
    idleTimeout: 20_000, // ms (vs postgres-js que usa segundos)
    waitForConnections: true,
  });
  return drizzleMysql(pool as unknown as never, {
    schema: schemaMysql,
    logger: env.NODE_ENV === "development",
    mode: "default",
  }) as unknown as DrizzleMysqlClient;
}

function createDb(): unknown {
  if (!features.database || !env.DATABASE_URL) {
    return null;
  }
  return dialect === "mysql" ? createMysqlClient() : createPgClient();
}

function getOrCreateDb(): unknown {
  if (globalThis.__csmDb !== undefined) return globalThis.__csmDb;
  const instance = createDb();
  if (env.NODE_ENV !== "production") {
    globalThis.__csmDb = instance;
  }
  return instance;
}

/**
 * Cliente Drizzle. Tipado como Postgres pero en runtime puede ser MySQL.
 * Cast vía `unknown` intermediate porque Drizzle Pg/MySQL son tipos
 * estructuralmente distintos pese a tener la misma API pública. En runtime
 * los métodos `.select`/`.insert`/`.update` funcionan idénticos — solo
 * cambia el SQL que generan.
 */
export const db = getOrCreateDb() as unknown as DrizzlePgClient | null;

/**
 * Re-export del schema (Postgres como verdad de tipos). En runtime,
 * `db` puede usar schema MySQL si dialect=mysql, pero los consumers
 * nunca lo notan porque los nombres y campos lógicos son idénticos.
 */
export { schemaPg as schema };
