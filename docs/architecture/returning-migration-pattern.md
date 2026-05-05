# Patrón de migración `.returning()` → multi-dialect

> Referencia para el refactor de Tarea 10. Aplicar mecánicamente a los archivos pendientes.

## Patrón A: INSERT con `.returning()` fuera de transaction

### Antes
```ts
const [created] = await db
  .insert(table)
  .values({ field1, field2, ... })
  .returning();
if (!created) throw new Error("...");
```

### Después
```ts
import { insertReturning } from "@/db/dialect";

const id = crypto.randomUUID();
const created = (await insertReturning(table, {
  id,
  field1, field2, ...
})) as TableType;  // TableType = typeof table.$inferSelect
if (!created) throw new Error("...");
```

**Notas:**
- Generar `id` con `crypto.randomUUID()` ANTES del insert.
- Cast `as TableType` necesario porque el helper devuelve `Record<string, unknown>`.
- Si el campo PK no se llama `id` (raro), el helper falla con error claro.

---

## Patrón B: INSERT con `.returning()` DENTRO de transaction

El helper `insertReturning` usa el `db` global, no funciona dentro de `db.transaction()`. Hacer inline:

### Antes
```ts
await db.transaction(async (tx) => {
  const [row] = await tx.insert(table).values({ ... }).returning();
  ...
});
```

### Después
```ts
await db.transaction(async (tx) => {
  const id = crypto.randomUUID();
  await tx.insert(table).values({ id, ... });
  const [row] = await tx.select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) throw new Error("...");
  ...
});
```

---

## Patrón C: UPDATE con `.returning()`

MySQL no soporta `UPDATE...RETURNING`. Usar 2 queries.

### Antes
```ts
const [updated] = await db
  .update(table)
  .set({ ... })
  .where(eq(table.id, id))
  .returning();
```

### Después
```ts
await db.update(table).set({ ... }).where(eq(table.id, id));
const [updated] = await db.select().from(table).where(eq(table.id, id)).limit(1);
```

---

## Patrón D: BATCH INSERT con `.returning()`

Para insertar múltiples rows y obtenerlas todas de vuelta:

### Antes
```ts
const rows = await db
  .insert(table)
  .values([item1, item2, item3])
  .returning();
```

### Después (fuera de transaction)
```ts
import { insertReturningMany } from "@/db/dialect";

const items = [item1, item2, item3].map((v) => ({ id: crypto.randomUUID(), ...v }));
const rows = (await insertReturningMany(table, items)) as TableType[];
```

### Después (dentro de transaction)
```ts
const items = [item1, item2, item3].map((v) => ({ id: crypto.randomUUID(), ...v }));
await tx.insert(table).values(items);
const ids = items.map((i) => i.id);
const rows = await tx.select().from(table).where(inArray(table.id, ids));
```

---

## Patrón F: `DELETE...RETURNING({ id })` para contar filas borradas

MySQL no soporta `DELETE...RETURNING`. Hacemos SELECT-then-DELETE en transacción.

### Antes
```ts
const result = await db.delete(jobs).where(...).returning({ id: jobs.id });
const count = result.length;
```

### Después
```ts
import { deleteReturningCount } from "@/db/dialect";
const count = await deleteReturningCount(jobs, where);
```

Si necesitas las **filas completas** borradas (para emitir webhook con datos):
```ts
import { deleteReturningRows } from "@/db/dialect";
const rows = (await deleteReturningRows(jobs, where)) as JobType[];
```

---

## Patrón G: UPSERT con returning (`onConflictDoUpdate.returning()`)

### Antes
```ts
const [row] = await db
  .insert(memberships)
  .values({ workspaceId, userId, tier: "pro" })
  .onConflictDoUpdate({
    target: [memberships.workspaceId, memberships.userId],
    set: { tier: "pro", updatedAt: new Date() },
  })
  .returning();
```

### Después
```ts
import { upsertReturning } from "@/db/dialect";

const row = (await upsertReturning(memberships, {
  values: { id: crypto.randomUUID(), workspaceId, userId, tier: "pro" },
  target: [memberships.workspaceId, memberships.userId],   // PG-only — ignorado en MySQL
  uniqueKey: { workspaceId, userId },                       // OBLIGATORIO para SELECT en MySQL
  set: { tier: "pro", updatedAt: new Date() },
})) as Membership;
```

**Variante DoNothing** (`set: null`): el helper hace `ON CONFLICT DO NOTHING` (Postgres) o `INSERT IGNORE`-equivalent (MySQL), y devuelve la fila existente si había conflict.

```ts
const row = (await upsertReturning(events, {
  values: { id, type, ... },
  target: events.dedupeKey,
  uniqueKey: { dedupeKey: someKey },
  set: null,   // DO NOTHING
})) as Event;
```

**Riesgo conocido:** `uniqueKey` debe corresponder a una UNIQUE constraint real (la misma que dispara el conflict). Si no, el SELECT post-upsert puede devolver una fila incorrecta o ninguna.

---

## Patrón H: ATOMIC CLAIM (UPDATE con precondición + RETURNING)

⚠️ **Crítico**: protege flows con race conditions. NO migrar a Pattern C.

### Antes (Postgres-only)
```ts
const [claimed] = await db
  .update(jobs)
  .set({ status: "running", lockedAt: now })
  .where(and(eq(jobs.id, jobId), eq(jobs.status, "pending")))
  .returning();
if (claimed) { /* ganamos el claim, otros recibieron undefined */ }
```

**Por qué Pattern C no sirve:** UPDATE + SELECT con mismo WHERE pierde la atomicidad. Si dos procesos hacen UPDATE simultáneamente, ambos podrían ver el row "actualizado" en su SELECT post-UPDATE → falsa victoria doble.

### Después
```ts
import { atomicClaim } from "@/db/dialect";

const claimed = await atomicClaim(jobs, {
  where: eq(jobs.id, jobId),
  precondition: (row) => row.status === "pending",
  set: { status: "running", lockedAt: new Date() },
});
if (claimed) { /* ganamos el claim */ }
```

El helper hace internamente:
1. `BEGIN TRANSACTION`
2. `SELECT ... FROM jobs WHERE id=X FOR UPDATE` — adquiere row-level lock
3. Evalúa `precondition(row)` en JS — si false, devuelve null
4. `UPDATE jobs SET ... WHERE id=X`
5. `COMMIT` y devuelve row con merge

`SELECT...FOR UPDATE` funciona idéntico en Postgres y MySQL InnoDB.

### Para múltiples filas (cron batch)

```ts
import { atomicClaimMany } from "@/db/dialect";

const claimed = await atomicClaimMany(scheduledEntries, {
  where: and(eq(table.workspaceId, ws), lte(table.scheduledAt, now)),
  precondition: (row) => row.status === "scheduled",
  set: { status: "publishing", claimedAt: now },
  limit: 50,
});
// Cada row en `claimed` es nuestra — el lock garantiza que ningún otro
// proceso tocó las mismas filas concurrentemente.
```

**Casos de uso reales en el codebase:**
- `app/api/cron/publish-scheduled` — no publicar 2× la misma entry
- `newsletter/dispatcher` — no enviar duplicados
- `branches/merge` — no merge concurrente
- `automations/engine` — no run duplicado de jobs
- `payments/member-auth` — no usar 2× el mismo magic-link
- `editorial/workflow` — no doble aprobación

---

## Patrón E: `ilike(col, pattern)` (drizzle-orm)

Drizzle's `ilike` es Postgres-only. Migrar a alias del helper cross-dialect:

### Antes
```ts
import { ilike, ... } from "drizzle-orm";
```

### Después
```ts
import { iLike as ilike } from "@/db/dialect";
import { ... } from "drizzle-orm";  // sin ilike
```

Los call-sites no cambian — siguen llamando `ilike(col, pattern)`.

---

## Lista de archivos pendientes (al cerrar sesión actual)

### Editorial (5 archivos)
- `src/editorial/assignments.ts` (2 returning)
- `src/editorial/ical.ts` (2)
- `src/editorial/workflow.ts` (2)
- `src/editorial/notifications.ts` (4)
- `src/editorial/comments.ts` (5)

### Branches (5 archivos)
- `src/branches/preview.ts` (1)
- `src/branches/cow.ts` (3)
- `src/branches/merge.ts` (3)
- `src/branches/comments.ts` (2)
- `src/branches/lib.ts` (3)

### Automations (3 archivos)
- `src/automations/lib.ts` (4)
- `src/automations/engine.ts` (3)
- `src/automations/actions.ts` (4)

### Newsletter (4 archivos)
- `src/newsletter/subscribers.ts` (9) — ⚠️ alto volumen
- `src/newsletter/segments-lib.ts` (3)
- `src/newsletter/drip.ts` (6)
- `src/newsletter/dispatcher.ts` (5)
- `src/newsletter/campaigns-lib.ts` (3)

### Payments (2 archivos)
- `src/payments/memberships.ts` (6)
- `src/payments/member-auth.ts` (3)

### Otros lib/
- `src/menus/lib.ts` (2)
- `src/redirects/lib.ts` (4) — ya tiene ilike migrado
- `src/forms/lib.ts` (6) — ya tiene ilike migrado
- `src/imports/engine.ts` (7)
- `src/webhooks/lib.ts` (1)
- `src/webhooks/dispatcher.ts` (1)
- `src/ab/queries.ts` (3)
- `src/presence/server.ts` (1)

### API (3 archivos)
- `src/api/keys.ts` (3)
- `src/api/v1/memberships.ts` (1)
- `src/api/v1/entries.ts` (2)

### App actions (5 archivos)
- `src/app/api/cron/publish-scheduled/route.ts` (1)
- `src/app/admin/workflows/_actions.ts` (1)
- `src/app/admin/contenido/_actions.ts` (3)
- `src/app/admin/membresias/_actions.ts` (1)
- `src/app/api/admin/imports/[id]/run/route.ts` (1)
- `src/app/api/admin/imports/route.ts` (1)
- `src/app/api/admin/imports/[id]/route.ts` (1)

### DB
- `src/db/seed.ts` (1)

---

## Archivos completados en sesión actual

| Archivo | Returning | Ilike |
|---|---|---|
| `src/lib/entries.ts` | ✅ 1 | ✅ alias |
| `src/lib/pages.ts` | ✅ 2 | ✅ alias |
| `src/lib/media.ts` | ✅ 5 | ✅ alias |
| `src/lib/collections.ts` | ✅ 2 | — |
| `src/lib/comments.ts` | ✅ 1 | — |
| `src/lib/symbols.ts` | ✅ 2 | — |
| `src/app/onboarding/_actions.ts` | ✅ 3 | — |
| `src/forms/submit.ts` | ✅ 1 | — |
| `src/api/query.ts` | — | ✅ alias |
| `src/newsletter/subscribers.ts` | — | ✅ alias |
| `src/mcp/tools.ts` | — | ✅ alias |
| `src/redirects/lib.ts` | — | ✅ alias |
| `src/graphql/schema.ts` | — | ✅ alias |
| `src/forms/lib.ts` | — | ✅ alias |

## Cómo aplicar el patrón (script-friendly)

Para cada archivo:

1. Identificar tipo de pattern (A, B, C, D, E).
2. Si pattern A/B/C/D: añadir `import { insertReturning } from "@/db/dialect"`.
3. Si pattern E: cambiar `import { ilike, ... } from "drizzle-orm"` a `import { iLike as ilike } from "@/db/dialect"; import { ... } from "drizzle-orm"`.
4. Aplicar el reemplazo según patrón.
5. `npx tsc --noEmit` — debe quedar verde.

---

## Riesgos comunes

- **Olvidarse de generar `id` antes del insert** → MySQL fallará con error de PK NULL.
- **Cast de tipo después de `insertReturning`** — el helper devuelve `Record<string, unknown>`. Sin el cast, el TypeScript se queja al usar `created.id`.
- **Transactions** — el helper `insertReturning` no acepta `tx` como parámetro. Para tx, hacer el patrón inline.
- **UPDATE batch con WHERE complejo** — el SELECT post-update debe usar EXACTAMENTE el mismo WHERE. Evitar repetir condiciones a mano (riesgo de divergir).
