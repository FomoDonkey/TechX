/**
 * Schema barrel — re-export del dialect activo en TIPOS.
 *
 * Diseño multi-dialect (ver `docs/architecture/multi-db-design.md`):
 *
 *  - El TYPESCRIPT siempre ve types Postgres (`schema.pg.ts` es la fuente
 *    de verdad para `$inferSelect` / `$inferInsert`). Los types lógicos son
 *    idénticos en MySQL — solo cambia el storage layer.
 *  - El RUNTIME carga `schema.pg.ts` o `schema.mysql.ts` según `DATABASE_URL`
 *    (ver `src/db/client.ts`). Drizzle internamente despacha al driver
 *    correcto.
 *
 * Por qué esta indirección: `pgTable` y `mysqlTable` tienen tipos distintos
 * en Drizzle. Un re-export condicional rompería type checking. Re-exportando
 * SIEMPRE Postgres mantenemos type safety completa, y el runtime resuelve
 * dialect correctamente porque las queries se evalúan contra el schema
 * cargado dinámicamente, no contra los types.
 *
 * Para usar MySQL en producción: configura `DATABASE_URL=mysql://...`. El
 * cliente detecta el dialect y carga `schema.mysql.ts`. Los types siguen
 * mostrando Postgres (cosmético — los datos son idénticos).
 */

export * from "./schema.pg";
