import { defineConfig } from "drizzle-kit";

/**
 * Drizzle-kit config dialect-aware.
 *
 * Detecta el dialect del `DATABASE_URL`:
 *  - postgres:// | postgresql://  → schema.pg.ts (default)
 *  - mysql://                     → schema.mysql.ts
 *
 * Apuntamos a archivos específicos (no schema.ts barrel) porque
 * drizzle-kit hace introspección estática del fichero y no resuelve
 * `export *` recursivo de forma confiable.
 */

const isMysql = (process.env.DATABASE_URL ?? "").startsWith("mysql://");

export default defineConfig({
  schema: isMysql ? "./src/db/schema.mysql.ts" : "./src/db/schema.pg.ts",
  out: isMysql ? "./drizzle/mysql" : "./drizzle",
  dialect: isMysql ? "mysql" : "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
