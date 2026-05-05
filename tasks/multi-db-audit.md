# Multi-DB audit — acoplamientos a Postgres

> Output de la **Tarea 6** del plan multi-dialect (Postgres + MySQL).
> Catálogo de archivos a tocar y tipo de cambio que requiere cada uno.
> Sirve de input a las tareas 7–14 (diseño, schema, queries, adapters).

---

## 1. Schema base (`src/db/schema.ts` — único archivo, ~1700 LOC)

| Acoplamiento | Ocurrencias | Equivalente MySQL | Estrategia |
|---|---|---|---|
| `pgTable(...)` | 78 | `mysqlTable(...)` | Schema dual (factory por dialect) |
| `pgEnum(...)` + `enumValues` | 43 | `mysqlEnum(...)` | Tabla de mapeo. Ojo: pgEnum es un TYPE separado en Postgres; mysqlEnum es inline en columna |
| `jsonb(...)` | 62 | `json(...)` | Idéntico API en Drizzle. MySQL acepta paths con JSON_EXTRACT |
| `uuid(...)` (PKs) | ~80 (todas las tablas) | `varchar(36)` con default crypto.randomUUID() en app | Drizzle MySQL no tiene `uuid` nativo |
| `text("...").array()` | 11 (líneas: 404, 617, 857, 967, 968, 1064, 1474, 1520, 1524, 1566, 1617) | Tabla normalizada N:M con FK | **El cambio más invasivo**. Cada array → `*_locales`, `*_mentions`, `*_tags`, etc. |
| `default(sql\`ARRAY['x']::text[]\`)` | 5 (líneas 404, 1474, 1520, 1566, 1617) | App-level default tras INSERT | Mover defaults al código que crea el row |
| `timestamp(...)` con default | 179 | `datetime(...)` o `timestamp(...)` | Drizzle abstrae; default `NOW()` funciona en ambos |
| `uniqueIndex` / `index` / `primaryKey` | 209 | Idénticos | Drizzle MySQL los soporta |

**Imports a cambiar:**
- `src/db/schema.ts:16` → `from "drizzle-orm/pg-core"` → factory `from "@/db/dialect/columns"`
- `src/api/query.ts:20` → `import type { AnyPgColumn }` → tipo unión

---

## 2. Cliente DB (`src/db/client.ts`)

| Acoplamiento | Equivalente MySQL | Estrategia |
|---|---|---|
| `drizzle from "drizzle-orm/postgres-js"` | `drizzle from "drizzle-orm/mysql2"` | Factory que detecta `postgres://` vs `mysql://` y devuelve el driver correcto |

---

## 3. Full-text search (`src/search/index.ts` — único archivo)

| Acoplamiento | Equivalente MySQL | Estrategia |
|---|---|---|
| `to_tsvector('spanish', body)` | `MATCH(body) AGAINST('...' IN BOOLEAN MODE)` | Adapter `FtsEngine` con 2 implementations |
| `to_tsquery('spanish', $1)` | Procesado en código + `MATCH AGAINST` | Adapter |
| `setweight(...)` | Sin equivalente directo (rank columna numérica) | Tabla `entry_search_weights` con rank pre-calculado |
| `tsvector` columna generada | `FULLTEXT INDEX (title, body, ...)` | DDL específico por dialect |

---

## 4. Vector search (`src/search/index.ts`, `src/ai/embeddings.ts`)

| Acoplamiento | Equivalente MySQL | Estrategia |
|---|---|---|
| `vector(N)` columna pgvector | `VECTOR(N)` (MySQL 9+) o servicio externo | Adapter `VectorIndex` con 3 implementations: pgvector / mysqlVector / qdrant |
| `<=>` (cosine), `<->` (L2), `<#>` (inner product) | Funciones MySQL: `VECTOR_COSINE_DISTANCE`, `VECTOR_DISTANCE` | Adapter wrappea |
| Index HNSW / IVFFlat | MySQL 9.0+ tiene índices vector básicos | Si no MySQL 9+, fallback Qdrant (servicio externo opcional) |

**Nota:** `src/components/marketing/*.tsx` usan literal `vector` pero como string en marketing copy — no acoplamiento real.

---

## 5. Pubsub LISTEN/NOTIFY (`src/lib/pubsub.ts` + 7 callers)

| Archivo | Uso |
|---|---|
| `src/lib/pubsub.ts` | Implementación core con `postgres.listen()` |
| `src/collab/provider.ts` | Y.js update broadcast multi-instancia |
| `src/collab/server.ts` | Recepción updates → otros clientes SSE |
| `src/presence/server.ts` | Cursor sharing + online users |
| `src/editorial/reactions.ts` | Reacciones live en threads |
| `src/editorial/notifications.ts` | Bell SSE notif fanout |

**`src/lib/security-headers.ts`** y **`src/db/schema.ts`** matchean por las palabras LISTEN/NOTIFY pero NO usan pubsub (false positives — son strings de docstring o comentarios).

| Estrategia | Refactor |
|---|---|
| Crear `src/realtime/pubsub.ts` con interface | `Pubsub { publish(channel, payload), subscribe(channel, handler) }` |
| Implementación postgres (existente) | Mantener como está, solo extraer detrás del interface |
| Implementación redis | `ioredis` con `subscribe()` / `publish()`. Auto-detect via `REDIS_URL` env |
| Migrar 6 callers | Cambiar `import { listen, notify } from "@/lib/pubsub"` → `import { pubsub } from "@/realtime"` |

---

## 6. Queries con sintaxis Postgres-only

### 6.1. `RETURNING` (133 ocurrencias en 47 archivos)

MySQL 8+ **no soporta `RETURNING`** en `INSERT`/`UPDATE`/`DELETE`. Patrón estándar:

```ts
// Postgres
const [created] = await db.insert(table).values({...}).returning();

// MySQL — 2 queries
const result = await db.insert(table).values({ id, ...other });
const [created] = await db.select().from(table).where(eq(table.id, id));
```

**Estrategia:** helper `insertReturning(table, values)` en dialect adapter. Drizzle puede tener su propia abstracción que vale la pena evaluar primero.

**Archivos top con muchos returning():**
- `src/newsletter/subscribers.ts` (9)
- `src/imports/engine.ts` (7)
- `src/payments/memberships.ts` (6)
- `src/forms/lib.ts` (6)
- `src/newsletter/drip.ts` (6)
- `src/newsletter/dispatcher.ts` (5)
- `src/lib/media.ts` (5)
- `src/editorial/comments.ts` (5)

### 6.2. `ON CONFLICT` / `onConflictDoUpdate` (33 ocurrencias en 20 archivos)

MySQL usa `ON DUPLICATE KEY UPDATE` con sintaxis distinta. Drizzle abstrae con `.onDuplicateKeyUpdate()` para MySQL.

**Estrategia:** helper `upsert(table, values, onConflict, set)` que dispatchea por dialect. Drizzle ya lo hace si usas la sintaxis correcta — verificar.

### 6.3. `ILIKE` (22 ocurrencias en 12 archivos)

Postgres-only. MySQL usa `LIKE` que ya es case-insensitive con collations `_ci` (default).

**Estrategia:**
```ts
// Helper
const ciLike = (col, pattern) =>
  isPostgres ? sql`${col} ILIKE ${pattern}` : sql`${col} LIKE ${pattern}`;
```

### 6.4. Casts Postgres `::tipo` (85 ocurrencias en 33 archivos)

Sintaxis `valor::text`, `count(*)::int`, etc. Postgres-only.

**Estrategia:** mayoría son `::int` para counts → `CAST(... AS UNSIGNED)` MySQL, o más limpio: que Drizzle aplique el cast vía `sql.raw` con detect dialect. Reescritura mecánica.

### 6.5. JSON path operators (`->`, `->>`)

**Solo 1 archivo:** `src/editorial/sla.ts`

MySQL usa `->>` (compatible) y `JSON_EXTRACT()`. Drizzle tiene helpers `sql<T>\`${col} ->> 'key'\`` que funcionan en ambos.

### 6.6. `WITH RECURSIVE`

**0 ocurrencias** en código actual. Branching probablemente usa joins iterativos en lugar de CTE. Re-validar al ejecutar tarea 14.

### 6.7. Postgres array literals (`ARRAY[...]`)

**5 ocurrencias** todas en `src/db/schema.ts` (defaults de columnas array). Se eliminan al normalizar arrays a tablas (apartado 1).

### 6.8. JSON_BUILD_OBJECT

**Solo 1 archivo:** `src/editorial/sla.ts`. Equivalente MySQL: `JSON_OBJECT(key, val, key, val)`. Drizzle helper `sql\`JSON_OBJECT(...)\`` adaptado.

---

## 7. Identidades (UUID generation)

| Lugar | Generación actual | Cambio |
|---|---|---|
| `src/db/schema.ts:1` | `default(sql\`gen_random_uuid()\`)` (Postgres) | App-level: `crypto.randomUUID()` en helper |
| `src/webhooks/dispatcher.ts` | `crypto.randomUUID()` (ya OK) | — |

**Estrategia:** todos los UUIDs generados desde la app, NO desde Postgres. Esto ya es parcialmente verdad — solo `src/db/schema.ts` tiene el default SQL. Quitarlo y forzar app-level (más portable).

---

## 8. Migrations / drizzle-kit

| Archivo | Cambio |
|---|---|
| `drizzle.config.ts` | Detectar dialect via env, devolver config correspondiente |
| `package.json db:push` | Mismo comando, drizzle-kit detecta dialect del schema |

Drizzle-kit ya soporta multi-dialect bien. El push debería funcionar sin más.

---

## 9. Ranges / advanced types

- `tstzrange`, `daterange`: **0 ocurrencias**. No se usan.
- `customType`: **1 ocurrencia** en `src/db/schema.ts`. Inspeccionar.

---

## Resumen ejecutivo

| Capa | Coste | Bloqueante |
|---|---|---|
| Schema dual (78 tablas, 11 arrays a normalizar) | **Medio** (1.5d) | Sí — base de todo |
| Cliente Drizzle factory | **Bajo** (0.5d) | Sí |
| Queries con `RETURNING` (47 files) | **Medio** (1.5d) | Sí |
| Queries con casts `::` y `ILIKE` | **Bajo** (0.5d, mecánico) | Sí |
| Pubsub adapter Redis | **Medio** (1d) | No (independent) |
| FTS adapter | **Bajo-medio** (0.5d) | No |
| Vector adapter | **Bajo-medio** (0.5d) | No |
| Branching CTEs | **Bajo** (0.5d, no hay WITH RECURSIVE actual) | No |

**Total ~6 días** alineado con estimación inicial de Opción 3 (6-8 días).

---

## Decisiones críticas para Tarea 7 (diseño abstracción)

1. **Schemas paralelos vs factory condicional**
   - **Recomendación: factory condicional** (un solo `schema.ts` que detecta dialect).
   - Por qué: 78 tablas × 2 schemas paralelos = riesgo de divergencia, double maintenance.
   - Contra: factory tiene sintaxis menos type-safe que tablas directas.
   - Mitigación: helpers tipados `csmTable(name, columns)` que internamente despachan.

2. **Arrays normalizados — esquema**
   - Cada `text("foo").array()` → tabla `<parent>_<col>` con `(parent_id, value, position)`.
   - 11 arrays → 11 tablas nuevas + helpers para read/write como si fuera array.
   - Helper `arrayColumn(parent, name)` que abstrae INSERT/SELECT.

3. **UUIDs**
   - Generar SIEMPRE en app con `crypto.randomUUID()`. Quitar `default(sql\`gen_random_uuid()\`)`.
   - Columna en MySQL: `varchar(36)` con índice. En Postgres mantener `uuid` para tamaño/perf.
   - Drizzle: tipo helper que hace lo correcto.

4. **`returning()`**
   - Para inserts simples con UUID generado en app, **no necesitamos returning()** — ya tenemos el id.
   - Refactor: pasar `id = crypto.randomUUID()` ANTES de insert, usar ese id directamente.
   - Solo donde se genera id por DB (rare en este codebase tras cambio 3) hace falta el patrón "insert + select".

5. **Pubsub default**
   - Si DB es Postgres y NO hay REDIS_URL → usar Postgres LISTEN/NOTIFY.
   - Si DB es MySQL O hay REDIS_URL → usar Redis.
   - Si DB es MySQL y NO hay REDIS_URL → realtime features deshabilitadas con mensaje claro.

---

## Próximo paso

Pasar a **Tarea 7** (diseño de la abstracción). Output esperado: `docs/architecture/multi-db-design.md` con ADR de las 5 decisiones de arriba + esqueleto de archivos a crear.
