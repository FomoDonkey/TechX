# Multi-DB design — Postgres + MySQL

> **Tarea 7** del plan multi-dialect.
> Decisiones arquitectónicas para soportar Postgres y MySQL como BD principal sin perder features.

## Contexto

CSM acopla a Postgres en 9 capas distintas (ver `tasks/multi-db-audit.md`). Necesitamos abstracciones que permitan elegir la BD desde `DATABASE_URL` sin reescribir el resto del código. El criterio: el desarrollo diario de features nuevas no debería duplicarse 2x.

---

## ADR-001: Schemas paralelos `schema.pg.ts` + `schema.mysql.ts`

### Decisión

Mantener el schema actual como `schema.pg.ts` y crear `schema.mysql.ts` paralelo. `schema.ts` re-exporta SIEMPRE de `schema.pg.ts` para que TypeScript vea types Postgres. Drizzle cliente carga el schema correcto en runtime.

### Por qué no factory unificado

Verificado en `node_modules/drizzle-orm/{mysql,pg}-core/table.d.ts`:
- `pgTable(...)` y `mysqlTable(...)` tienen tipos **completamente distintos** (`PgTableFn` vs `MySqlTableFn`).
- Una función `csmTable(...)` que dispatcha en runtime daría tipo `PgTable | MySqlTable`. Cada query (`db.select().from(users)`) tendría que castear o el tipo se rompe.
- Drizzle interno usa fingerprinting de tipos para validar joins, comparaciones, etc. Un union rompe esa validación.

### Por qué schemas paralelos funciona

Los **types lógicos** (`$inferSelect`, `$inferInsert`) son **idénticos** entre dialectos porque representan los mismos campos:

```ts
// schema.pg.ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});
export type User = typeof users.$inferSelect;
//   = { id: string; email: string; ... }

// schema.mysql.ts
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: text("email").notNull(),
});
export type User = typeof users.$inferSelect;
//   = { id: string; email: string; ... }   ← IDÉNTICO
```

Por eso `schema.ts` puede re-exportar SIEMPRE Postgres types y el resto del código compila sin saber que existe MySQL. En runtime, `db/client.ts` decide qué schema cargar.

### Coste de mantenimiento

11 arrays normalizados + 78 tablas en MySQL. Estimado: ~1.5 días para crear `schema.mysql.ts` desde cero. Tras eso, cada feature nueva requiere editar AMBOS files. Mitigación: script `scripts/check-schema-parity.ts` en CI que valida que `schema.pg.ts` y `schema.mysql.ts` tienen las mismas tablas con campos equivalentes.

### Alternativa rechazada

`tsconfig` paths con condicional para que `@/db/schema` resuelva a `pg` o `mysql` en build. Funciona pero requiere build distinto para Postgres vs MySQL — incompatible con un solo `npm run build` que pueda servir ambos. Descartado.

---

## ADR-002: Arrays normalizados a tablas auxiliares

### Decisión

Las 11 columnas array de Postgres se normalizan a tablas auxiliares con FK al padre. Helper `arrayCol(parentTable, name)` para read/write transparente.

### Tablas a crear

| Original | Tabla normalizada | Cardinality |
|---|---|---|
| `workspaces.locales` | `workspace_locales` (workspace_id, locale, position) | 1:N |
| `editorial_threads.mentions` | `editorial_thread_mentions` (thread_id, user_id) | 1:N |
| `editorial_messages.mentions` | `editorial_message_mentions` (message_id, user_id) | 1:N |
| `entries.ai_tags` | `entry_ai_tags` (entry_id, tag, weight) | 1:N |
| `entries.tags_manual` | `entry_tags_manual` (entry_id, tag) | 1:N |
| `comments.tags` | `comment_tags` (comment_id, tag) | 1:N |
| `forms.notification_emails` | `form_notification_emails` (form_id, email) | 1:N |
| `submissions.attachments` | `submission_attachments` (submission_id, media_id, position) | 1:N |
| `submissions.spam_reasons` | `submission_spam_reasons` (submission_id, reason) | 1:N |
| `api_keys.scopes` | `api_key_scopes` (api_key_id, scope) | 1:N |
| `webhooks.events` | `webhook_events` (webhook_id, event) | 1:N |

### En Postgres

Mantener `text("...").array()` original. El helper `arrayCol(table, name)` detecta dialect:
- Postgres → traduce a la columna array directa.
- MySQL → traduce a join + read del side table.

### Helpers

```ts
// db/array-col.ts
export async function readArrayCol<T>(
  table: PgTable | MySqlTable,
  parentId: string,
  colName: string,
): Promise<T[]> {
  if (dialect === "postgres") {
    const [row] = await db.select({ vals: table[colName] })
      .from(table).where(eq(table.id, parentId));
    return row?.vals ?? [];
  }
  // MySQL: SELECT value FROM <table>_<col> WHERE parent_id = ?
  const auxTable = arrayAuxTable(table, colName);
  const rows = await db.select({ value: auxTable.value })
    .from(auxTable).where(eq(auxTable.parentId, parentId))
    .orderBy(auxTable.position);
  return rows.map(r => r.value);
}
```

Migrar callers que hacen `row.locales` → `await readArrayCol(workspaces, row.id, "locales")`. Coste: ~30 sites en codebase.

### Alternativa rechazada

Guardar arrays como JSON en MySQL (`json` column con `JSON_ARRAY`). Pros: cero cambio de schema. Contras: queries `WHERE locale IN array` se vuelven JSON_CONTAINS y son lentas sin índice — y no se puede indexar bien en MySQL. Para ~80 workspaces con 1-3 locales OK, pero para `entry.tags_manual` con búsquedas frecuentes degrada. Descartado.

---

## ADR-003: UUIDs siempre app-side con `crypto.randomUUID()`

### Decisión

Eliminar `default(sql\`gen_random_uuid()\`)` de `schema.pg.ts`. Generar UUIDs con `crypto.randomUUID()` en el código que llama `INSERT`. Aplica a Postgres y MySQL idénticamente.

### Por qué

1. MySQL no tiene `gen_random_uuid()` built-in. El equivalente es `UUID()` pero formato distinto (con guiones). Inconsistente.
2. Generar app-side hace que `INSERT` no necesite `RETURNING` para conocer el id (sabemos el id ANTES del insert). Esto resuelve el 80% del problema de `RETURNING`.
3. UUID v4 vía `crypto.randomUUID()` está disponible en Node 20+ y bun nativamente. Sin deps.

### Migration

Para cada `default(sql\`gen_random_uuid()\`)` en schema:
- Quitar el default
- En el helper `createX()` (`src/lib/entries.ts`, `pages.ts`, etc.) añadir `id: crypto.randomUUID()` al insert

Coste: tocar ~30-40 helpers `createX/insertX`. Mecánico.

### Compatibilidad backwards

Postgres acepta UUIDs en formato string al insertar — no rompe nada. MySQL guarda en `varchar(36)`.

---

## ADR-004: Eliminar dependencia de `RETURNING`

### Decisión

Refactor mecánico de los 133 sites con `.returning()`:
- Si el INSERT genera id app-side (ADR-003) → no necesita RETURNING. Construir el row en memoria con los valores que ya conocemos.
- Si el INSERT depende de defaults SQL (timestamps, secuencias) → patrón "INSERT + SELECT" (2 queries):

```ts
// helpers/insert-returning.ts
export async function insertReturning<T extends Table>(
  table: T,
  values: TableInsert<T>,
): Promise<TableSelect<T>> {
  if (dialect === "postgres") {
    const [row] = await db.insert(table).values(values).returning();
    return row;
  }
  // MySQL: insert + select por id (asumiendo id en values via crypto.randomUUID)
  await db.insert(table).values(values);
  const [row] = await db.select().from(table).where(eq(table.id, values.id));
  return row;
}
```

### Coste

~50% de los `.returning()` calls se eliminan completamente (el id ya se conoce). Los otros ~70 se cambian a `insertReturning(...)`. Mecánico.

### Por qué no Drizzle's MySQL `.returning()` polyfill

Drizzle 0.45 NO emula `.returning()` en MySQL — falla en runtime. Vamos manual.

---

## ADR-005: Pubsub adapter con auto-detección

### Decisión

Crear `src/realtime/pubsub.ts` con interface unificado y 2 implementations:

```ts
export interface Pubsub {
  publish(channel: string, payload: string): Promise<void>;
  subscribe(channel: string, handler: (payload: string) => void): () => void;
  close(): Promise<void>;
}
```

Auto-detección al boot:

| `DB_DIALECT` | `REDIS_URL` | Pubsub usado |
|---|---|---|
| postgres | (no set) | `postgresPubsub` (LISTEN/NOTIFY) — comportamiento actual |
| postgres | set | `redisPubsub` — opt-in para Postgres si quieren escalar |
| mysql | (no set) | **disabled stub** — realtime features muestran banner "configura REDIS_URL" |
| mysql | set | `redisPubsub` |

### Migración

7 archivos callers (`src/collab/*.ts`, `src/presence/server.ts`, `src/editorial/*.ts`):
- Actual: `import { listen, notify } from "@/lib/pubsub"`
- Nuevo: `import { pubsub } from "@/realtime"` + cambio de signature mínimo

Coste: ~1d.

### Dep nueva

`ioredis` (~600KB). Ya existe en muchos stacks. Solo se carga si `REDIS_URL` está set (lazy import).

---

## ADR-006: FTS adapter

### Decisión

Crear `src/search/fts/` con 2 implementations:
- `pg-fts.ts`: usa `to_tsvector` + GIN existente (mantiene comportamiento actual).
- `mysql-fts.ts`: usa `FULLTEXT INDEX` + `MATCH AGAINST`.

Interface unificado:

```ts
export interface FtsEngine {
  search(workspaceId: string, query: string, opts: SearchOpts): Promise<Hit[]>;
  // No expose indexEntry — el FTS index se mantiene automático con triggers o
  // con un campo computed (Postgres tsvector generated, MySQL FULLTEXT auto-update).
}
```

### Detalle MySQL

`FULLTEXT INDEX` en MySQL solo soporta InnoDB (ya por default desde 5.6) y mínimo 3 caracteres por defecto (configurable con `innodb_ft_min_token_size`). Multi-idioma con stop-words por idioma requiere `ngram` parser para CJK; latin-default OK para español.

Boolean mode: `MATCH(title, body) AGAINST('+laravel +tutorial' IN BOOLEAN MODE)`.

### Migration

`src/search/index.ts` actual cambia para llamar al adapter en lugar de tsquery directamente. ~50 LOC.

---

## ADR-007: Vector search adapter

### Decisión

`src/search/vector/` con 3 implementations:

| Backend | Cuándo se usa | Coste setup |
|---|---|---|
| `pgvector` | Postgres con extension instalada | Cero (ya funciona) |
| `mysql-vector` | MySQL 9+ con `VECTOR` type | Cero (built-in) |
| `qdrant` | Cualquier BD + `QDRANT_URL` env | Servicio externo (Docker container) |

Auto-select prioridad: `qdrant > mysql-vector > pgvector` (config explícita gana sobre auto).

### Funciones core

```ts
export interface VectorIndex {
  upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>;
  search(embedding: number[], opts: { limit: number; filter?: ... }): Promise<Hit[]>;
  delete(id: string): Promise<void>;
}
```

### Embeddings (`src/ai/embeddings.ts`)

No cambia. Sigue generando vectors en código vía adapter AI. Solo el storage cambia.

---

## Esqueleto de archivos a crear (Tarea 8 onwards)

```
src/db/
├── schema.ts              ← re-export de schema.pg (Postgres types como verdad TS)
├── schema.pg.ts           ← schema actual renombrado (no cambia ni una línea inicialmente)
├── schema.mysql.ts        ← NUEVO: schema MySQL paralelo
├── client.ts              ← MODIFICADO: factory que detecta dialect + carga schema correcto
├── array-col.ts           ← NUEVO: helpers para arrays normalizados
└── insert-returning.ts    ← NUEVO: helper para 2-query insert+select en MySQL

src/realtime/
├── pubsub.ts              ← NUEVO: interface Pubsub
├── pg-pubsub.ts           ← extracción de src/lib/pubsub.ts (Postgres LISTEN/NOTIFY)
├── redis-pubsub.ts        ← NUEVO: ioredis impl
└── index.ts               ← auto-detect + export `pubsub`

src/search/fts/
├── index.ts               ← interface FtsEngine + factory
├── pg-fts.ts              ← extraído de src/search/index.ts actual
└── mysql-fts.ts           ← NUEVO

src/search/vector/
├── index.ts               ← interface VectorIndex + factory
├── pgvector.ts            ← extraído (cuando exista)
├── mysql-vector.ts        ← NUEVO (MySQL 9+)
└── qdrant.ts              ← NUEVO (servicio externo)

scripts/
├── check-schema-parity.ts ← CI: valida schema.pg ↔ schema.mysql tienen mismas tablas
└── gen-mysql-schema.ts    ← NUEVO: scaffolding inicial schema.mysql desde schema.pg

docs/
├── DATABASE.md            ← guía: qué BD elegir, troubleshooting
└── REDIS.md               ← guía: cuándo y cómo añadir Redis
```

---

## Plan de migración respetando "no romper nada"

Cada commit/tarea deja el repo:
- ✅ Build verde
- ✅ Typecheck verde
- ✅ Postgres funcionando idéntico (regresión zero)
- 🟡 MySQL parcialmente o totalmente funcional según fase

Orden:
1. **Tarea 8** — extraer `schema.pg.ts`, crear `schema.mysql.ts` mínimo (solo tablas core: users/workspaces/sessions). Postgres sigue trabajando.
2. **Tarea 9** — `db/client.ts` factory. Default Postgres si no hay `DATABASE_URL` mysql://. Postgres trabaja idéntico.
3. **Tarea 10** — refactor mecánico de queries Postgres-specific. Cada cambio testeado contra Postgres antes de pasar al siguiente.
4. **Tarea 11** — pubsub adapter. Postgres mantiene LISTEN/NOTIFY (cero cambio funcional). Redis-mode opt-in.
5. **Tarea 12-13** — FTS y vector adapters. Postgres usa los originales detrás del interface.
6. **Tarea 14** — branching: validar contra Postgres primero, después MySQL.
7. **Tarea 15** — completar `schema.mysql.ts` con TODAS las tablas. Docker compose MySQL funciona end-to-end.
8. **Tarea 16** — tests E2E matrix.

---

## Riesgos identificados y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `schema.pg.ts` y `schema.mysql.ts` divergen en silencio | Script `check-schema-parity.ts` en CI bloquea PR |
| Queries con sintaxis específica que no detecté en audit | Tests E2E (Tarea 16) hacen smoke test de cada flow crítico contra ambas BDs |
| MySQL FULLTEXT no encuentra resultados en español como Postgres tsvector | Documentar en `docs/DATABASE.md` el trade-off. Stemming menos sofisticado en MySQL |
| Drizzle 0.45 cambia API entre dialectos en update futuro | Pin version en package.json + tests E2E catch regresión |
| Performance MySQL vs Postgres para queries actuales | Benchmark básico en Tarea 16. Postgres suele ser más rápido para FTS/JSON ops |

---

## Próximo paso

**Tarea 8**: extraer `schema.pg.ts` (rename), crear `schema.mysql.ts` con las primeras 5 tablas (users, sessions, accounts, verifications, workspaces) como prueba de concepto. Verificar que typecheck sigue verde y que Postgres no se rompe.

---

## Estado real (cierre de tareas 8-16)

| Tarea | Estado | Entregables |
|---|---|---|
| 8 — Schema dual PG+MySQL | ✅ POC + 15 (port completo) | `schema.pg.ts` (77 tablas) + `schema.mysql.ts` |
| 9 — Cliente Drizzle multi-dialect | ✅ | `db/client.ts` con factory por dialect |
| 10 — Queries no triviales (RETURNING, ILIKE, vector) | ✅ | 8 patterns helpers en `src/db/dialect/*` (A-H) |
| 11 — Pubsub adapter (Redis o LISTEN/NOTIFY) | ✅ | `src/realtime/pubsub.ts` con auto-detect |
| 12 — FTS adapter (tsvector ↔ FULLTEXT) | ✅ | `src/search/fts/{postgres,mysql}.ts` |
| 13 — Vector search (pgvector ↔ MySQL 9 VECTOR ↔ Qdrant) | ✅ | `src/db/dialect/vector.ts` con `cosineDistance`/`vectorLiteral` |
| 14 — CTEs recursivos compatibles MySQL 8+ | ✅ | El código aplana árboles en JS — `src/lib/tree.ts` reutilizable. `WITH RECURSIVE` queda documentado |
| 15 — Docker compose Redis + MySQL funcional | ✅ | `docker-compose.{mysql,redis}.yml` + `.env.docker.example` actualizado |
| 16 — Tests E2E por dialect (CI matrix) | ✅ | `vitest` + 24 tests unit + `.github/workflows/ci.yml` con matrix [postgres, mysql] + redis service |

### Adapters activos resumen

```
src/realtime/pubsub.ts       → Redis | Postgres LISTEN/NOTIFY | in-memory (auto-detect)
src/search/fts/index.ts      → Postgres tsvector | MySQL MATCH...AGAINST (auto-detect)
src/db/dialect/vector.ts     → pgvector | MySQL 9 VECTOR (auto-detect; Qdrant doc'd)
src/db/dialect/index.ts      → 8 patterns A-H + ilike + vector + atomic claim helpers
```

Cada adapter tiene un `kind` campo que permite logs/diagnostics: `getPubsub().kind`, `getFts().kind`, etc.
