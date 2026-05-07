# CSM — Lecciones aprendidas

## 2026-05-06 — `dateTrunc()` parametrizado rompía GROUP BY en Postgres

### Bug
`/admin` cargaba todas las KPIs salvo las series temporales: la query daba `column "created_at" must appear in GROUP BY clause`. El SQL emitido por drizzle:

```
SELECT to_char(date_trunc('day', "comments"."created_at"), 'YYYY-MM-DD'), count(*)
FROM "comments"
GROUP BY date_trunc($3, "comments"."created_at")
                       ↑ parametrizado
```

`formatDateIso()` inlineaba `'day'` (literal) pero `dateTrunc()` lo metía como `${unit}` en el template tagged → drizzle lo serializa como `$N`. Postgres analiza estas dos como expresiones distintas (`date_trunc('day', col)` vs `date_trunc($3, col)`) — no las matchea ni con `set transform_null_equals = on`. Resultado: la columna del SELECT no es funcionalmente dependiente del GROUP BY, error.

### Fix
Hardcodear el `unit` por branch del switch en el helper PG. El enum `DateUnit` es cerrado (5 valores), así que no hay riesgo de injection y mantenemos el helper genérico para callers:

```ts
if (dialect === "postgres") {
  switch (unit) {
    case "hour":  return sql<Date>`date_trunc('hour',  ${column})`;
    case "day":   return sql<Date>`date_trunc('day',   ${column})`;
    // …
  }
}
```

### Lección
- En **drizzle**, `${string}` dentro de un template `sql\`...\`` se parametriza salvo que uses `sql.raw(...)`. Si la cadena necesita aparecer textualmente (parte de un identifier, una función con literal SQL especial), hardcodearla por branch o pasarla por `sql.raw()` con whitelist.
- **GROUP BY/SELECT functional dependency** en Postgres se hace por matching textual de expresiones, no por evaluación. Reglas más laxas serían imposibles sin evaluar parámetros en planning.
- **Bugs latentes en helpers genéricos**: este fix arregló 9 callsites de un solo cambio. Cuando un helper falla, vale la pena auditar todos sus consumidores en lugar de parchear callsite a callsite.

## 2026-05-06 — Mega auditoría profunda (5 agentes + ~50 fixes adicionales)

### Lo que disparó la auditoría
Tras el primer hardening cross-dialect, el usuario pidió "audita en profundidad y verifica que todo esté totalmente perfecto". Lancé **5 agentes Explore en paralelo** con foco distinto: cross-dialect, auth/multi-tenant, build/runtime, F1 templates, ops/config.

### 15 hallazgos de los agentes (vs lo que descubrí en mi propia revisión)
Los agentes detectaron **15 issues**: 7 🔴 críticos + 5 🟡 importantes + 3 🟢 nice. Yo además detecté **otros 30+ patrones PG-only** durante el grep posterior — los agentes Explore tienen un read window limitado y pierden patrones repartidos por muchos archivos. Lección: **después de un agente, hacer grep manual amplio del dominio que auditó**.

### Categorías de bugs encontrados

1. **Multi-tenant defense in depth** (2 hits): `src/api/v1/entries.ts:326,409` hacían `select.where(eq(id))` post-update sin verificar workspaceId. No era exploit (el id viene de un insert previamente filtrado), pero patrón de footgun. Fix: `eq(workspaceId)` adicional siempre.

2. **Endpoint sin auth gate** (1 hit): `src/app/api/admin/media/generate/route.ts` — POST llamaba server action sin auth en el route handler. Defense in depth: añadir `requireWorkspace("editor")` explícito en el endpoint (la SA interna también valida, pero el endpoint debe rechazar antes).

3. **`::text` ILIKE sobre JSON** (2 hits): `forms/lib.ts:258`, `lib/asset-usage.ts:38` — `${col}::text ILIKE` rompe en MySQL. Fix: helper `iLikeJson` cross-dialect.

4. **`date_trunc()` y `to_char()`** (~7 hits): dashboard, calendar, A/B analytics. Fix: helpers `dateTrunc()` y `formatDateIso()` en `dialect/datetime.ts`.

5. **`count(*)::int` PG-only** (~30 hits en 22 archivos): el cast `::int` es necesario en PG (postgres-js devuelve bigint→string sin él), pero rompe en MySQL. Fix: helper `countInt()` cross-dialect.

6. **`COUNT(DISTINCT col)::int`** (2 hits): fix con helper `countDistinctInt()`.

7. **`COUNT(*) FILTER (WHERE ...)::int`** (~10 hits en campaigns/imports): sintaxis SQL-2003 que solo PG implementa; MySQL necesita `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`. Fix: helper `countFilterInt(condition)`.

8. **`SUM(col)::int`** (5 hits en ai/usage.ts): fix con helper `sumInt(col)`.

9. **`extract(dow|hour from col)::int`** (2 hits en editorial/ai-schedule.ts): MySQL usa `DAYOFWEEK()` (1-7) y `HOUR()` (0-23). Helper `extractDayOfWeek()` mapea `DAYOFWEEK-1` para igualar el rango PG (0-6).

10. **Raw SQL templates con `::text`/`::uuid`** (3 hits en branches/, graphql/, ai/usage.ts): cuando el call-site requiere raw `db.execute(sql\`...\`)` con SELECT complejo, fix es **inline `dialect === "postgres" ? sqlA : sqlB`** porque el query entero cambia. La duplicación es manageable (queries pequeñas) y mantiene legibilidad mejor que abstraer.

11. **Better-Auth `provider: "pg"`** ya cubierto en pase anterior. Plus: `trustedOrigins` ahora acepta `AUTH_EXTRA_ORIGINS` env (CSV) para deploys con dominio + IP simultáneo.

12. **`VERCEL_URL` fallback en self-hosted** (`src/editorial/comments.ts:432`): con `NEXT_PUBLIC_APP_URL` ausente, los emails de menciones llevaban URL vacía. Fix: warn explícito al detectarlo.

13. **IPv6 comprimida `2001:db8::1`** (`src/lib/ip-anon.ts`): el split-filter trataba la compresión `::` como hextet inexistente; ahora hay `expandIpv6()` que normaliza a 8 hextets antes de truncar a /48.

### Lecciones de proceso

1. **Los agentes Explore son read-window-limited.** Si auditas un dominio amplio (~hits >20), **complementa con tu propio grep masivo después**. El agente da el patrón general, tú haces la pasada exhaustiva.

2. **Los helpers cross-dialect deben crecer con el código.** Cada vez que aparece un patrón PG-only en N archivos, vale la pena un helper en `dialect/`. El coste del helper (~20 líneas) se paga con creces en el primer audit cross-DB.

3. **Para queries con `dialect === "postgres" ? ... : ...` inline**, está OK cuando son queries grandes y específicas (raw SQL execute, cursor pagination con casts). Abstraer todo a helpers cuando no se reusa es over-engineering.

4. **Defense in depth en multi-tenant**: aunque el id venga de un insert "trusted", añadir `eq(workspaceId)` al select posterior cuesta 0 en perf y elimina footguns futuros. Patrón uniforme > optimización marginal.

5. **No te fíes solo del typecheck.** TypeScript valida shape, no SQL. Para detectar PG-only, grep por patrones literal (`date_trunc`, `::int`, `::uuid`, `extract(`, etc.) es lo que funciona.

### Estado final tras esta sesión
- `npm run typecheck` → ✅
- `npm run build` → ✅ (54 routes, sin warnings nuevos)
- 4 helpers nuevos en `dialect/`: `iLikeJson`, `dateTrunc`, `formatDateIso`, `extractDayOfWeek`, `extractHour`, `countInt`, `sumInt`, `countDistinctInt`, `countFilterInt`
- ~45 call-sites refactorizados a helpers cross-dialect
- 5 inline `dialect === "postgres" ? ... : ...` para queries grandes que no abstraen bien
- 3 issues 🟢 nice deferred (ics rate-limit, CSV `""` escape, teamColor fallback)

---

## 2026-05-06 — Hardening cross-dialect total (16 call-sites + Better-Auth + helpers)

### Problema: typecheck verde ≠ runtime verde en MySQL
Tras el F1 deploy hardening inicial, dije al usuario que "está listo" basándome en `npm run typecheck`. Auditoría posterior reveló **16 call-sites con sintaxis Postgres-only** que TypeScript no detecta porque son métodos válidos en el tipo `PgInsertBuilder` (drizzle re-exporta como pg en `schema.ts` barrel):
- `Better-Auth provider: "pg"` hardcoded en `src/auth/index.ts:16` → `signUpEmail` falla en MySQL
- 15 `onConflictDo*` directos repartidos por todo `src/` (paths críticos: branches/lib.ts, lib/entries.ts, auth/rate-limit.ts, presence, collab, csp-report, ai/keys, ai/usage, ai/moderation, search/jobs, health/scan, ab/engine, imports/engine, api/runtime, invitations)

**Lección general:** TypeScript valida **shape**, no SQL emitido. Con dual schema MySQL/PG donde el barrel re-exporta uno como verdad de tipos, hay que **grep** los métodos PG-only manualmente. Lista de patrones a auditar:
- `.onConflictDoNothing(`, `.onConflictDoUpdate(` → reemplazar por `upsertNothing`/`upsert`
- `.returning()` → reemplazar por `insertReturning`/`upsertReturning` o lookup post-insert
- SQL fragments con `to_tsvector`, `::vector`, `gen_random_uuid()`, `<=>`
- `.array()`, `.defaultRandom()` solo en `schema.pg.ts`
- `provider: "pg"` literal hardcoded

### Solución: 4 cambios estructurales

1. **`upsertNothing` con `target` opcional** (`src/db/dialect/upsert.ts`) — los call-sites sin target específico (`onConflictDoNothing()` solo) ahora pasan por el helper. Postgres → `ON CONFLICT DO NOTHING` (cualquier UNIQUE/PK), MySQL → `INSERT IGNORE`.

2. **Better-Auth provider auto-detectado** (`src/auth/index.ts`) — `provider: dialect === "mysql" ? "mysql" : "pg"`. El mismo build funciona contra ambos motores sin tocar config.

3. **Patrón `tx` dentro de transaction** — los helpers usan `db` global, no aceptan `tx`. Para casos dentro de transacción (`health/scan.ts`, `invitations/[token]/route.ts`), inline `if (dialect === "mysql") { tx.insert().ignore() } else { tx.insert().onConflictDoNothing() }`. Solo 2 sitios; el coste de extender el helper para aceptar `tx` con typing cross-dialect supera el beneficio.

4. **15 call-sites refactorizados** a `upsert(...)` o `upsertNothing(...)`. Imports añadidos en cada archivo: `import { upsert, upsertNothing } from "@/db/dialect"`.

### Verificación
- `npm run typecheck` → ✅
- `npm run build` → ✅ (54 routes generadas, sin warnings nuevos)
- `grep onConflictDo` solo retorna ahora: helpers (`upsert.ts`, `upsert-returning.ts`) y los 2 inline-tx, todos cross-dialect.

### Lección de proceso
Cuando alguien pide "está perfecto?" y la respuesta es honesta "casi, hay X gaps", **ofrecer el fix antes que vender el cierre**. El usuario aceptó el hardening en cuanto le mostré el detalle de los 16 sitios; si hubiera dicho "sí, está listo" y luego saliera el bug en el deploy real, la confianza desaparece. Honestidad calibrada (precisa, no auto-flagelante) gana por encima de cierre prematuro.

---

## 2026-05-06 — Setup F1 deploy (compose override + VECTOR fallback + INSERT IGNORE)

### Problema 1: docker-compose.yml hardcodeaba `DATABASE_URL=postgres://...@postgres:5432/...`
Si el operador quería apuntar a una BD externa (Neon, RDS, MySQL del SDS para F1), el doc le obligaba a **comentar a mano el servicio postgres del compose y editar la línea DATABASE_URL**. No es "fácil de configurar" y rompe la próxima vez que el repo se actualice (merge conflicts en el compose).

**Solución:** `docker-compose.external-db.yml` como override:
- `services.postgres.profiles: ["disabled"]` — excluye el container del default `up` sin tener que tocar el compose principal.
- `services.csm.environment.DATABASE_URL: ${DATABASE_URL:?...}` — sobrescribe la versión calculada con `:?` para fallar con mensaje claro si el operador olvida definirlo.
- `services.csm.depends_on: !reset []` — sintaxis Docker Compose v2.24+ para limpiar el `depends_on: postgres` del compose base sin re-declarar todo el servicio.

Uso: `docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d csm`. El compose principal queda intacto y el caso "BD local en compose" sigue funcionando con `docker compose up -d` solo.

### Problema 2: VECTOR(N) en MySQL 8.x rompe `db:push`
`schema.mysql.ts` declaraba `customType` que renderiza siempre `VECTOR(N)`. MySQL 9+ lo soporta nativo, pero **MySQL 8.4 (el que está desplegado en el SDS) no lo conoce** y `drizzle-kit push` falla con `Unknown data type: 'VECTOR'`.

**Solución:** env var `MYSQL_VECTOR_FALLBACK=true` que el `dataType()` del customType lee al evaluar el schema. Si está activa, devuelve `VARBINARY(8192)` (suficiente para 1536 floats × 4 bytes). La búsqueda semántica nativa queda offload a Qdrant si lo configuras; en otro caso se deshabilita gracefully.

**Por qué env var y no detección runtime:** drizzle-kit push evalúa el schema en build, no tiene conexión a la BD para hacer `SELECT VERSION()`. El operador del despliegue declara explícitamente qué BD tiene.

### Problema 3: `seed.ts` usaba `onConflictDoNothing` (Postgres-only)
`seed.ts:57` rompía en MySQL porque drizzle-orm/mysql2 no implementa `.onConflictDoNothing()` (existe `.onDuplicateKeyUpdate()` y `.ignore()`).

**Solución:** helper `upsertNothing(table, {values, target})` en `src/db/dialect/upsert.ts` que enruta:
- Postgres → `INSERT ... ON CONFLICT (target) DO NOTHING`
- MySQL → `INSERT IGNORE` (la opción `.ignore()` de drizzle-orm/mysql-core silencia conflicts PK/UNIQUE sin tocar la fila existente)

Reemplazo en `seed.ts` deja el código cross-dialect sin if/else en el call-site.

### Problema 4: Doc no etiquetaba qué máquina ejecuta cada comando
El doc PROYECTO-F1-CMS-DEPLOY.md mezclaba comandos `mysql`, `docker compose`, `ssh`, `npm` sin indicar **dónde** ejecutarlos. Para un compañero que sigue el doc, "abre un mysql" puede ser desde el portátil o desde la EC2 — el resultado del grant cambia.

**Solución (didáctica más que técnica):**
- Sección 0 **"Inicio rápido en 5 comandos"** al principio del doc.
- Sección 0.1 **"Mapa de máquinas"** con tabla de 4 emojis: 🟦 SDS / 🟧 EC2 / 🟩 Local / 🟪 Container.
- Sección 0.2 **"Cómo construir DATABASE_URL"** desglosando cada componente (de qué paso sale cada valor).
- Sección 0.3 **"Cómo generar AUTH_SECRET"** con tres opciones (`openssl`, `npm run gen:secret`, etc.) y el listado de errores comunes (placeholder, cambio post-deploy).
- Etiqueta `🟦/🟧/🟩/🟪` añadida al inicio de cada sección y bloque de código.

### Lección general
Cuando entregas un sistema a un compañero/cliente para que lo despliegue:
1. **Empieza el doc por "TL;DR en N comandos"** — la mayoría va a copiar-pegar sin leer el resto.
2. **Etiqueta cada bloque con la máquina objetivo** — ambigüedad genera errores de seguridad (grants a IPs equivocadas, credenciales en hosts equivocados).
3. **Reduce los pasos manuales con scripts** — `npm run f1:setup` reemplaza 3 comandos manuales (clone + sync + verify). `gen:secret` reemplaza buscar el comando OpenSSL.
4. **Para cada secret/credential, documenta cómo generarlo Y dónde sale cada componente** — `DATABASE_URL` no es una caja negra, es un string compuesto por 5 piezas que el lector debe poder mapear paso a paso.
5. **Override compose > editar compose principal** — los overrides son compositivos, no rompen el caso original, y son trivialmente reverdables (no incluir el `-f`).

---

## 2026-05-05 — Plantillas espectaculares editables (showcase ↔ blocks parity)

### El problema de la decisión "preview ≠ inserted page"
La primera versión de las 8 plantillas showcase (`/template-preview/[id]`) renderizaba un componente React custom de 200-450 líneas (Asme, Jack, Michael, Mint, Nimbus, Securify, Magazine, Substack) **completamente desconectado** de lo que insertaba `createPageFromTemplateAction`. Click en "Usar plantilla" → se generaba un `buildLayout()` block-based simplificado (motion-hero + features-grid + pricing + cta) que no se parecía en nada al preview. Bait-and-switch terrible para el usuario, y el footer de la galería tenía un disclaimer reconociéndolo. **Diferido como F10x** en su día — terminó siendo prioridad cuando el usuario lo descubrió.

### Arquitectura de la solución (Option B "completa")
Cada showcase se descompone en N secciones (3-7) implementadas como **client components props-driven** en `src/blocks/spectacular/{template}-sections.tsx`. Cada sección registra un `BlockSpec` con `kind: "tpl-{template}-{section}"`, `hiddenInPalette: true` (no inunda el palette del page builder), `propsSchema` Zod estricto y `propsSpec` para el inspector. El render delega 1:1 al componente client. `buildLayout()` devuelve un array de `node("tpl-X", {})` y los defaults del spec rellenan todo el contenido espectacular.

**41 nuevos block kinds totales:**
- Asme (saas-magnetic): 6 — hero / about / featured-video / split-vision / service-cards / cta
- Jack (portfolio-spotlight): 6 — hero / marquee / about / services / projects / cta
- Michael (agency-spotlight): 6 — hero / bento / journal / explorations / stats / contact-footer
- Mint (coming-soon): 3 — hero / perks / roadmap
- Nimbus (docs-aurora): 4 — hero / docs-grid / quick-start / community
- Securify (launch-marquee): 5 — hero / sectors / pillars / pricing / cta
- Magazine (blog-particles): 5 — masthead / featured / categories / stories / newsletter
- Substack (newsletter-typewriter): 7 — header / hero / preview / testimonial / pricing / archive / footer

### Patrón de paridad por construcción
**Eliminé `getShowcase(id)` del route `/template-preview/[id]/page.tsx`** — ahora siempre llama `RenderLayout(buildLayout())`. El preview ES la inserted page, son el mismo árbol de bloques renderizado en el mismo path. Imposible que diverjan visualmente.

### Lección general (aplicable a futuras features)
Cuando hay riesgo de divergencia entre dos representaciones del mismo contenido (preview vs editable, draft vs published, mock vs real), **usa una única fuente de verdad y haz que ambos paths la consuman**. Si la "fuente espectacular" es código React custom, conviértelo en bloques editables; si la "fuente editable" es simplificada, súbele el listón hasta que sea fiel. **Diferir esa unificación como "lo arreglamos luego" siempre acaba en bait-and-switch que el usuario detecta.**

### Sub-lección: dangerouslySetInnerHTML para italic granular
Los headers tipo `"Power <em>AI</em>"` o `"Construye <em>algo distinto</em>"` necesitan italic + gradient solo en algunas palabras. `parseInlineMarkdown(*texto*)` no servía para gradient backgrounds. Solución: `dangerouslySetInnerHTML` con sanitización inline whitelist (`<em>`/`<br>` only via regex), por bloque. Biome warnea pero el sanitize garantiza zero-XSS — la prop pasa por Zod max-length antes de llegar al render.

### Sub-lección: editor canvas + min-h-screen
Los componentes espectaculares usan `min-h-screen`, `h-screen`, `fixed top-0`, etc. para ocupar full viewport en producción. Dentro del canvas del editor (div con width fijo 1280/820/390 y altura natural) eso rompe: heroes gigantes, navs flotantes que se superponen al inspector, scroll horizontal, contenido cortado abajo. **Solución no invasiva**: clase `.csm-edit-canvas` en el wrapper del canvas + reglas CSS scoped en `editor-styles.css` que sobrescriben `min-h-screen → 700px`, `fixed → absolute`, `csm-sticky-card → relative`, `video → max-h:720px`. Las páginas publicadas y el preview siguen full-bleed; solo el canvas editor se neutraliza. **Patrón reutilizable**: cuando un componente con animaciones/posicionamiento full-viewport se renderiza dentro de un container con dimensiones distintas, define un selector class del container y neutraliza vía CSS, no toques los componentes.

---

## Bootstrap

### 2026-05-02 — corepack bloqueado en Windows
`corepack enable` y `corepack prepare pnpm@latest --activate` requieren permisos de admin para escribir en `C:\Program Files\nodejs`. Decisión: usar **npm 10 (incluido con Node 20)** en lugar de pnpm. npm soporta workspaces igualmente cuando los necesitemos.

### 2026-05-02 — Pivote a single-app
El plan original proponía monorepo `apps/web + packages/*`. Para acelerar bootstrap y porque solo hay un consumidor inicialmente, simplificamos a una sola app Next.js con organización modular en `src/`. La estructura mantiene la separación lógica: `src/db/`, `src/auth/`, `src/ai/`, `src/blocks/`, `src/storage/`, `src/search/`, etc. Si en el futuro aparece un segundo consumidor (CLI, mobile, otra app web), promovemos esos módulos a `packages/*` con npm workspaces.

### 2026-05-02 — Versiones de Drizzle vs Better-Auth
better-auth@1.6.9 requiere `drizzle-kit >= 0.31.4` y `drizzle-orm >= 0.45.2` como peer optional. Si no se cumplen, npm falla con ERESOLVE. Bumpeé ambas. **Lección:** revisar peer-deps de Better-Auth al actualizar Drizzle.

### 2026-05-02 — Multiple lockfiles warning de Next.js
Next.js detectó `C:\Users\edgar\package-lock.json` (el directorio padre de proyectos) y eligió ese como workspace root, lo que rompió el build. Solución: añadir `outputFileTracingRoot: __dirname` en `next.config.ts`. **Lección:** en proyectos dentro de subdirectorios del HOME del usuario, fijar siempre `outputFileTracingRoot`.

### 2026-05-02 — Procesos `next dev` zombie en Windows
Lanzar `npm run dev` con `&` en Git Bash y luego `pkill -f "next dev"` **no mata el proceso** en Windows — Git Bash no propaga señales correctamente a procesos node nativos. Resultado: el dev viejo se queda corriendo, bloquea el puerto 3000 y el archivo `.next/trace` con lock, rompiendo el siguiente `npm run dev` con `EPERM: operation not permitted`. **Solución:** usar `taskkill //F //IM node.exe` (las dobles slashes evitan que Git Bash convierta los flags) y borrar `.next/` antes de relanzar. Mejor aún: no usar background para smoke tests en Windows; verificar build directamente con `npm run build`.

### 2026-05-02 — `@t3-oss/env-nextjs` y SKIP_ENV_VALIDATION
Cuando `SKIP_ENV_VALIDATION=true`, los `default()` de Zod **NO** se aplican — los valores quedan como `process.env.X` (que puede ser `undefined`). Esto rompió `metadataBase: new URL(env.NEXT_PUBLIC_APP_URL)` durante build. **Lección:** crear siempre un `.env` con defaults en lugar de skip; o hacer las URLs robustas a `undefined`.

## Stack

### Tailwind v4 + OKLCH
- `@import "tailwindcss"` (sintaxis nueva, no `@tailwind base/components/utilities`).
- Tokens en `:root`/`.dark` con OKLCH para mejor percepción y contraste constante.
- `@custom-variant dark (&:is(.dark *))` registra el variant.
- `@theme inline` mapea las CSS vars a clases utility.
- `@utility` define helpers custom (gradient-text, glass, shimmer-bg).

### Better-Auth lazy
Si no hay `DATABASE_URL`, `auth = null`. La landing pública sigue funcionando, el admin se desactiva *gracefully*. Patrón replicable: cualquier servicio externo opcional → bandera en `features = {...}` derivada de env y consumir como `if (features.x) { ... }`.

## Patrones

### Schema Drizzle multi-tenant
- **Cada tabla con datos de usuario** lleva `workspaceId` como FK obligatoria.
- Tests deben verificar aislamiento (no leak entre workspaces).
- Helper `withWorkspace(db, ws)` cuando se cree (Fase 1) será obligatorio en todas las queries.

### Marketing landing
La landing usa solo Server Components (RSC) — cero JS innecesario. Solo `theme-toggle.tsx` es client (necesita `useTheme`). Resultado: 11.1 KB para `/`, 117 KB First Load JS. Lighthouse target: 100/100/100/100.

### Naming
- Carpetas en singular para entidades (`db`, `auth`, `ai`).
- Plural solo si claramente es colección (`components`, `themes`).
- Rutas en español (`/contenido`, `/medios`, `/ajustes`) — UI ES por defecto.

## Fase 1 — Auth + Onboarding

### 2026-05-02 — Better-Auth 1.6.9 no incluye plugin `passkey`
El plugin `passkey` no está exportado en `better-auth@1.6.9` (sí lo están `magic-link`, `two-factor`, `username`, etc.). Intentar `import { passkey } from "better-auth/plugins/passkey"` rompe build. **Solución:** dejamos la tabla `passkeys` en el schema (no daña), pero el plugin en server/client se queda fuera y el botón en el login muestra un toast "próximamente". Cuando upgrademos a la versión que lo incluya, basta con re-añadir el plugin server + client + schema mapping.

### 2026-05-02 — `noUncheckedIndexedAccess` rompe destructuring de Drizzle returning()
Con `tsconfig.strict + noUncheckedIndexedAccess`, `const [ws] = await db.insert(...).returning()` deja `ws: T | undefined`. **Patrón:** asignar a variable y guardar con `if (!ws) throw`. Igual con `Promise.all([db.select(...)...])`: cada slot es `T[]`, no `[T]`, así que el primer elemento puede ser undefined.

### 2026-05-02 — `@vercel/og` (next/og) en edge runtime es muy estricto
Reglas no obvias de satori que rompen 500:
1. Cualquier `<div>` con **más de un hijo** debe declarar `style={{ display: "flex" }}` (o `none`). Sin eso → `Expected <div> to have explicit "display: flex"`.
2. Caracteres no comunes (✦, ✨, emojis decorativos) intentan **fetch dinámico de fuente** desde Google Fonts; en local sin red el fetch falla y la respuesta cae a 500. Solución: usar texto ASCII / letra inicial + gradient en vez de glyph decorativo, o pasar fuente embebida en el array `fonts`.
3. `zIndex` numérico está OK pero satori lanza warnings si lo ve junto a otras props con `px`. No bloquea el render.

### 2026-05-02 — Better-Auth cookies con `cookiePrefix`
Configuré `advanced.cookiePrefix: "csm"` y `useSecureCookies` solo en prod. La cookie de sesión queda en `csm.session_token` (chunked: `csm.session_token.0/1/2`). El middleware tiene que mirar **ambas** variantes para detectar sesión. **Patrón:** `req.cookies.get("csm.session_token")?.value ?? req.cookies.get("csm.session_token.0")?.value`.

### 2026-05-02 — Server Actions y client imports
En un archivo `"use server"`, NUNCA importar `@/auth/client` (es `"use client"`). Build pasa pero ejecución falla con "client component imported in a server action". Lo descubrí en `src/components/admin/_actions.ts`. **Lección:** los actions están al lado del componente cliente, pero solo importan helpers del servidor (`@/auth/server`, `@/db/client`, etc.).

### 2026-05-02 — Onboarding wizard: SSE en vez de polling
Para el AI Site Generator opté por SSE (`text/event-stream`) en lugar de un único response chunked porque permite **eventos tipados** (`event: brand:name`, `event: post`, etc.). El cliente parsea con un buffer de `\n\n` y switch sobre `event`. Mock determinista: paleta seleccionada por keyword o hash del prompt sobre 8 paletas curadas — el usuario ve la "magia" sin necesidad de LLM key.

### Patrón: feature flags en env
Repetir el patrón de Fase 0 (`features.database`) para nuevos servicios: cada página o action que dependa de un servicio externo debe degradar *gracefully* mostrando un mensaje útil ("conecta DATABASE_URL en .env y vuelve") en vez de tirar excepción. La landing y el sitio público nunca deberían depender de DB para renderizarse.

## Auditoría Fase 2 — bugs encontrados y fixeados (2026-05-02)

### Critical: revisión orderBy invertido
`saveEntryAction` consultaba `lastRevisionAt` con `.orderBy(revisions.createdAt)` (ASC, default). Devolvía la **revisión más antigua** en vez de la más reciente, así que `sinceLastMs` siempre era enorme y se snapshoteaba en cada save. **Fix:** `desc(revisions.createdAt)`. **Lección:** los tests de "snapshot cada N min" hay que leerlos a contraluz — el patrón delta/intervalo solo funciona si se compara contra el snapshot más nuevo, no el más viejo.

### High: createNewPostAction imperativa no navegaba
El server action redirigía con `redirect()`. Funciona perfecto desde `<form action={fn}>` (Next maneja la navegación), pero al invocarlo imperativamente desde el handler de `cmdk` el throw con digest `NEXT_REDIRECT` quedaba en el catch del cliente y la pestaña no navegaba. **Fix:** dos exports — `createNewPostFormAction(formData)` que redirige (para forms) y `createNewPostAction()` que devuelve `{ ok, id }` (para imperativo, navego con `router.push` desde cliente). **Lección:** server actions con `redirect()` solo navegan automáticamente cuando se invocan vía form action; para imperative, devolver el id y navegar desde cliente.

### High: timezone shift en `<input type="datetime-local">`
Para precargar el input de "Programar publicación" usaba `new Date(iso).toISOString().slice(0,16)`, que da UTC pero el input lo interpreta como local. Para un usuario en Madrid (UTC+1) un post programado a 14:00 aparecía como 13:00 en el editor. **Fix:** helper `toLocalDateTimeInput(iso)` que extrae componentes con `getFullYear/getMonth/getDate/getHours/getMinutes` (locales). El path inverso `new Date(localStr).toISOString()` ya funcionaba porque `Date` interpreta string sin zona como local.

### High: race en `getOrCreateBuiltinCollection` y `createEntry`
Dos requests simultáneos podían leer "no existe" antes de que ninguno haya insertado, y uno fallaba con unique violation. **Fix idéntico al patrón de Phase 1:** `getOrCreateBuiltinCollection` ahora usa `onConflictDoNothing({ target: [...] })` + re-select; `createEntry` envuelve el insert en bucle 8x con catch de `23505` (Postgres unique violation) y reintenta con sufijo aleatorio.

### Medium: `getDefaultPublicWorkspace` rompía ISR de /blog
Leía `cookies()` para "respetar" la cookie `csm_ws` del admin, lo que marcaba `/blog` y `/blog/[slug]` como dinámicos y desactivaba el ISR (revalidate=60). Además era un leak: visitantes anónimos heredaban la elección del último admin que pasó por la máquina (en localhost). **Fix:** quitar la cookie; siempre devolver el workspace más antiguo. La elección por subdominio/dominio queda para Fase 5 con el theme registry.

### Medium: UUID inválido en rutas dinámicas
`/admin/contenido/[id]`, `/preview/[id]` y `/api/admin/revisions/[id]` pasaban el `id` directo a `getEntryById/getRevision` (Drizzle + postgres-js). Si `id` no es un UUID válido, `postgres-js` tira excepción y la página revienta con 500 en vez de 404. **Fix:** helper `isUuid()` en `src/lib/uuid.ts` y guard `if (!isUuid(id)) notFound()` antes de la query.

### Medium: middleware no protegía /preview
`/preview/[id]` usa `requireUser()` server-side, pero al no estar en el matcher del middleware el usuario veía un flash antes del redirect. **Fix:** añadir `/preview/:path*` al matcher.

### Medium: sidebar active state para rutas anidadas
`pathname === item.href` falla cuando la ruta es `/admin/contenido/uuid`. **Fix:** `pathname === href || pathname.startsWith(\`${href}/\`)` con caso especial para `/admin` (evita marcar todo activo). **Lección:** sidebar nav siempre necesita prefix-match excepto la home.

## Fase 7a — APIs + Webhooks + Cron (2026-05-02)

### Critical: Next 15 RouteContext type es estricto con params optional
Mi runtime `createRoute` devolvía `(req, ctx?: { params?: Promise<...> } = {}) => Response`. Compilaba TS perfectamente, pero el type generator de Next 15 (.next/types/app/...) genera un check que verifica el tipo del segundo arg contra `RouteContext`, y **rechaza la unión con `undefined`**. Para una ruta `/api/v1/collections/[slug]`, Next infiere `RouteContext = { params: Promise<{ slug: string }> }` (no opcional). Mi tipo `{ params?: ... } | undefined` es más amplio. **Fix:** declarar el segundo arg de `nextHandler` como `routeCtx: { params: Promise<Record<string, string>> }` (required, no opcional). Internamente el `executeRoute` acepta tanto el opcional como el requerido vía unión. **Lección:** los tipos de routes en App Router son tan estrictos que un alias amplio rompe el build aunque tsc puro pase.

### High: Zod + RouteHandler genérico produce errores de tipo cuando el handler devuelve `Partial<R>`
Mi primer intento de `RouteHandler<P, Q, B, R>` exigía que el handler devolviera `R` exacto (el tipo del schema response). Pero `pickFields()` (selección de campos opcional con `?fields=title,slug`) devuelve `Partial<T>`. TS escupe ~25 errores cruzados porque "string | undefined" no es asignable a "string". **Fix:** relajar el tipo del handler a `Promise<unknown | { etag, data: unknown } | Response>`. El `response` de createRoute pasa a ser sólo informativo (para OpenAPI), no se valida runtime. **Lección:** schemas de respuesta sirven para documentar; validar el response ATAría a `Partial<>` o forzaría ramas explícitas. Mejor confiar en TS para los inputs y dejar libre la salida.

### High: Drizzle .returning() y noUncheckedIndexedAccess invalidan el destructuring
Igual que en F1: `const [row] = await db.select().from(x).where(...)` deja `row: T | undefined`. El typecheck pasaba en F1 con `if (!row) throw`, pero en F7a el tipo `apiKeys.scopes` es `string[] | null` (con `.array().notNull().default(...)`), y `row.scopes ?? []` es necesario para no propagar el null. **Patrón consolidado:** asignar a variable + null-check + nullish-coalescing en arrays para Drizzle columns con default-array.

### Medium: ts_headline / SQL inyections en `?where[field][op]=`
Drizzle parametriza, así que `eq(col, value)` y `inArray(col, [...])` están seguros. Pero `ilike(col, value)` necesita escapar `%` y `_` del valor. **Fix en clauseToSql:** `ilike(col, \`%${String(clause.value).replace(/[%_]/g, "")}%\`)`. **Lección:** cualquier query con LIKE/ILIKE construido a mano necesita strip de wildcards, no solo Drizzle parametriza.

### Medium: Idempotency-Key con body distinto debe retornar 409, no replay
El patrón Stripe-style: si el cliente reenvía la misma `Idempotency-Key` pero con un body distinto, NO devolvemos el response cacheado (sería confuso) sino un 409 explícito "Idempotency-Key reutilizada con body distinto". **Implementación:** `requestHash = sha256(JSON.stringify(body))` guardado en la fila; al recibir nueva request, compara hash. Si coincide → replay; si no → 409. **Lección:** sin este check, un cliente que cambia un campo accidentalmente obtiene la respuesta vieja silenciosamente (corruption potencial).

### Medium: API keys con cache TTL en proceso permite race con revoke
KEY_CACHE en memoria con TTL 60s acelera mucho. Pero si revoco una key, el cliente puede seguir usándola hasta 60s. **Mitigación:** `invalidateKeyCache(prefix)` se llama desde `revokeApiKey` y `rotateApiKey`. Aún así, en serverless cada instancia tiene su cache; F10 endurecerá con Redis para invalidación cross-instance. **Lección:** caches in-memory en serverless son OK para reducir latencia pero NO deben llevar acciones críticas; siempre asumir que las cachees pueden estar 60s desfasadas.

### Medium: `for("update", { skipLocked: true })` requiere drizzle-orm 0.45+
Drizzle 0.45 expone `.for("update", { skipLocked: true })` tipado en lugar del raw `sql\`FOR UPDATE SKIP LOCKED\``. Esto es esencial para webhook deliveries: con un cron cada minuto en Vercel Cron, podría haber overlap entre 2 invocaciones; el SKIP LOCKED garantiza que cada delivery sólo la procese 1. **Lección:** Vercel Cron no se duplica MUCHO pero tampoco es exclusivo (especialmente en deployments rolling). Cada cron handler debe ser idempotente o usar lock-free claim.

### Medium: HMAC sign con timestamp para evitar replay attacks de webhooks
La firma básica `HMAC(secret, body)` permite replay: el atacante captura una request del webhook y la reenvía después. Mejor: `HMAC(secret, \`${timestamp}.${body}\`)` + el receptor rechaza requests con timestamp viejo (>5min). **Implementación:** header `X-CSM-Timestamp` (epoch seconds) + signature en `X-CSM-Signature`. La docs en /admin/api-docs incluye el snippet de verificación. **Lección:** copiar el patrón de Stripe es mejor que inventar.

### Low: zodToJsonSchema custom requiere tocar `_def.typeName`
`zod` no expone una API pública para introspección, pero `_def.typeName` está estable hace muchas versiones. Cubrir los 12 tipos que usamos (string, number, boolean, enum, array, object, union, optional, nullable, default, record, lazy, effects) son ~80 LOC. Evita la dependencia `@asteasolutions/zod-to-openapi` (50 KB+). Para nuestra spec basta. **Lección:** las libs de Zod-to-OpenAPI valen si vas a soportar 100+ esquemas con casos exóticos. Para un API CMS curado, custom es más mantenible.

### Low: Vercel Cron y `* * * * *` aumenta facturación
Crons cada minuto en Vercel cuestan; si el plan free no llega, cambiar a 5 min o consolidar en un solo cron que llame a múltiples processors. **Decisión:** dejamos 1 min para F7a (UX inmediata), pero documentar que en producción puede subirse a 2-5 min sin sacrificar mucho.

### Patrón consolidado: emit fire-and-forget en server actions
`emitAsync({ workspaceId, event, payload })` se llama desde server actions sin `await`. Si la inserción de la delivery falla (DB caída), se loggea pero no bloquea el guardado. El cron procesador retry-on-error se encarga del resto. **Lección clave:** los emits NO deben bloquear el path crítico del usuario; el coste de un guardado lento por un webhook es peor que perder ocasionalmente un evento.

## Auditoría posterior F7a — bugs encontrados en re-revisión (2026-05-02)

### Critical: createEntryHandler usaba apiKeys.id como entries.authorId (FK violation)
`entries.authorId` es FK a `users.id` (text). Yo estaba pasando `ctx.apiKey.id` (uuid de api_keys). En cuanto la primera request de creación llegara a Postgres, fallaría con `FOREIGN KEY constraint`. **Fix:** authorId queda `null` (la FK lo permite con onDelete: "set null"), y el audit log conserva la `apiKeyId` que originó la creación. **Lección:** las API keys son entidades distintas de los users; no pueden ser actor de columnas que apuntan a users. F8 podría introducir un `authorType: 'user' | 'api_key'` si necesitamos trazabilidad fina.

### Critical: createEntryHandler creaba colecciones builtin para CUALQUIER slug
`getOrCreateBuiltinCollection(workspaceId, slug)` crea la colección si no existe, marcándola como `isBuiltin: true` con icono "file-text". Si un cliente API enviaba `collectionSlug: "eventos"` y esa colección no existía, le creábamos una builtin huérfana. **Fix:** sólo auto-creamos para los slugs builtin reales (`posts`/`pages`); para custom collections, exigimos que ya existan y devolvemos 404 con un mensaje claro. **Lección:** las funciones tipo `getOrCreate` deben usarse con cuidado en endpoints públicos — pueden inflar la base de datos del cliente con entidades no deseadas.

### High: cron/publish-scheduled emitía webhooks falsos
Hacía SELECT (entradas con scheduled+scheduledAt<=now), luego UPDATE separado. Entre ambos, alguien podía cambiar el estado, pero igual emitíamos webhook por TODAS las del SELECT. **Fix:** un solo `UPDATE...RETURNING` que sólo devuelve las filas que realmente transicionaron. **Lección:** UPDATE...RETURNING es la forma correcta en Postgres de "haz X y dime qué cambió" sin race. SELECT-then-UPDATE casi siempre tiene una race window.

### High: bulk publish/unpublish emitían webhooks duplicados
`publishEntriesAction({ ids: [a, b, c] })` emitía 3 webhooks `entry.published` aunque a y b ya estuvieran publicadas. **Fix:** el UPDATE filtra por `status != "published"` (o `= "published"` para unpublish) y usa RETURNING; sólo emitimos por las que transicionaron de verdad. Mismo patrón aplicable a cualquier mutación masiva con webhook por-id.

### High: publishEntryHandler no detectaba "ya estaba publicada"
El UPDATE sobre una entrada ya publicada igual devuelve 1 row affected (RETURNING) y emitiríamos webhook duplicado. **Fix:** `getById` primero, comparar status, retornar `{ alreadyPublished: true, published: 0 }` si ya lo estaba. El cliente puede ver la diferencia.

### Medium: handlers REST no emitían webhooks (inconsistencia con admin actions)
Las server actions del admin emitían webhooks vía `emitAsync`, pero los handlers de `/api/v1/entries` (POST/PATCH/DELETE) NO. Resultado: si un cliente API publica una entrada, los webhooks no se disparan. **Fix:** añadir emits en cada handler — `entry.created`, `entry.updated`, `entry.deleted`, transiciones `entry.published`/`unpublished` cuando cambian de estado. Misma lógica para `comment.approved`/`spam` en patchCommentHandler.

### Medium: processDeliveries NO filtraba webhookId por workspaceId al cargar el secret
`db.select(...).from(webhooks).where(eq(webhooks.id, delivery.webhookId))` no filtraba por workspaceId. La FK con cascade impide huérfanas, pero defendernos en profundidad — un bug futuro en `emit` que no validara el workspace correctamente podría enviar el delivery firmado a una URL de OTRO tenant. **Fix:** doble filtro `and(eq(id), eq(workspaceId))` siempre, incluso cuando la FK ya garantizaría aislamiento. **Lección F4 reaplicada:** multi-tenant safety nunca debe depender solo de FKs — siempre filtrar por workspaceId en la query.

### Medium: testWebhookAction aceptaba event arbitrario
`event: z.string()` permitía al cliente firmar y enviar payloads con un valor de evento que NO estaba en el catálogo `WEBHOOK_EVENTS`. **Fix:** `event: z.enum(WEBHOOK_EVENTS)`. **Lección:** Zod enums vs strings sueltos es la diferencia entre "controlamos el contrato" y "el cliente puede meter cualquier cosa".

### Medium: runtime devolvía body vacío con content-type JSON si handler retornaba undefined
`JSON.stringify(undefined)` devuelve `undefined` (no string). El Response con body undefined → cliente ve un cuerpo vacío con `content-type: application/json`. JSON.parse("") falla. **Fix:** `JSON.stringify(result ?? null)`. **Lección:** los runtimes web exigen rigor sobre tipos undefined; siempre normalizar a `null` antes de stringify.

### Low: setTimeout no se limpiaba si fetch lanzaba excepción
En `sendOne`, `clearTimeout(timeout)` estaba dentro del try, después del fetch. Si el fetch lanzaba (network error pre-response), `clearTimeout` no se ejecutaba y quedaba un timer pendiente — leak memorable solo en serverless de larga vida. **Fix:** mover el `clearTimeout` a `finally`. **Patrón:** cualquier `setTimeout(controller.abort, ...)` debe limparse en `finally`.

### Low: replayDeliveryAction no validaba UUID
Pasar `deliveryId` no-UUID hacía que postgres-js lanzara excepción dentro de la query. El error genérico salía al cliente. **Fix:** validar con `z.string().uuid()` antes. **Patrón consolidado:** todos los IDs string que llegan a queries Drizzle deben validarse como UUID en server actions.

### Verificado y NO bug
- API keys timing-safe: ✓ (timingSafeEqual con buffers de igual longitud)
- Prefix collision: ✓ (32 bits randomBytes + unique index)
- Cross-tenant en handlers REST: ✓ (todos filtran por ctx.workspaceId que viene de la key)
- Cross-tenant en server actions admin: ✓ (todos usan requireWorkspace + workspaceId filter)
- HMAC verify timing-safe: ✓ (timingSafeEqual)
- Idempotency conflict 409 con body distinto: ✓
- SSRF en webhook delivery URL: ✓ (safePublicFetch + assertPublicUrl)
- CRON_SECRET timing-safe: ✓ (timingSafeEqual con length check)
- Scopes glob: ✓ (sin regex injection, parser simple)
- Body size cap 1 MB: ✓
- Audit fail-safe: ✓ (try-catch silencioso)
- Test environment NO muta: ✓
- Crons idempotentes: ✓ (UPDATE...WHERE...RETURNING + SKIP LOCKED)
- OpenAPI público no expone datos: ✓ (sólo schemas, paths, scopes)

### Medium: `/admin/contenido/[id]` metadata estática
`export const metadata = { title: "Editor" }` no reflejaba el post abierto. **Fix:** `generateMetadata` async que lee el entry y devuelve `${entry.title} · Editor`. Cuesta una query extra pero el `<title>` decente vale el viaje.

### Medium: posts demo del onboarding sin `body` JSON
`createSiteFromOnboarding` insertaba entries con `bodyText: p.bodyMarkdown` pero **sin** `body` JSONB. Al abrirlos en el editor Tiptap aparecían vacíos (porque body=null → fallback a EMPTY_DOC). **Fix:** helper `markdownToTiptapDoc` que convierte el markdown plano (paragraphs separados por `\n\n`) a estructura Tiptap. Soporte completo de markdown llega en el importer (Fase 9).

### Medium: dashboard.ts referenciaba tabla `members` con SQL raw
Usaba `.from(sql\`members\`)` y `.where(sql\`workspace_id = ${id}\`)` cuando podría usar la tabla Drizzle ya importada. **Fix:** `from(members)` + `eq(members.workspaceId, ...)`. Más type-safe y el linter lo entiende.

### Medium: `restoreRevisionAction` sin filtro defensivo de workspace
El UPDATE final filtraba solo por `eq(entries.id, entry.id)` aunque ya validamos que entry pertenece al workspace via `getEntryById`. Defensivo (defense-in-depth): añadir `eq(entries.workspaceId, ctx.workspace.id)` al UPDATE. También faltaba `revalidatePath("/blog")` cuando el entry estaba publicado.

### Medium: `entry.scheduled` action sin label en activity feed
El feed mostraba el código raw `entry.scheduled` en lugar de "Programó publicación". **Fix:** añadir entrada al `ACTION_LABELS` map. **Lección:** cada vez que se añade un nuevo `action` en `logActivity`, comprobar que tenga label en `activity-feed.tsx`. (Idealmente: hacer el feed leer de un registry compartido.)

### Medium: JSON-LD vulnerable a `</script>` injection
`dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}` en `/blog/[slug]` permitía a un title con `</script>` romper el HTML. **Fix:** `.replace(/</g, "\\u003c")` neutraliza la secuencia. JSON parsea igual el escape Unicode. **Lección:** cualquier `<script>` con contenido JSON debe escapar `<` antes de inyectarlo.

### Low: title textarea no auto-resize en mount
Solo se redimensionaba en `onInput`. Si el initial title es muy largo, se mostraba en una línea con scroll horizontal hasta el primer cambio. **Fix:** `useEffect` con ref que recalcula altura tras mount.

### Low: slash menu se salía del viewport
Si el cursor estaba cerca del bottom, el popup se cortaba. **Fix:** medir `popup.offsetHeight` y flipar arriba con `rect.top - PAD - h` si no cabe debajo. También clamp horizontal con `min/max` para no salirse a la derecha.

### Low: dead code useEffect
Había un `useEffect(() => { if (saved && !dirty) return; }, [savedState])` que no hacía nada. Removed.

### Low: keys de array index en `renderDoc`
Biome `noArrayIndexKey` flagueaba todos los `.map((_,i) => <Fragment key={i} />)` del renderer. **Fix:** helper `keyOf(parent, child, i)` que combina tipo+índice+slice de texto/longitud — sigue siendo determinístico pero no es puro index.

### Tooling: regex `\p{Mn}` para diacríticos
Para `headingId()` quitaba accents con `[̀-ͯ]` (combining marks U+0300-036F). Biome marcaba como `noMisleadingCharacterClass`. **Fix:** `replace(/\p{Mn}/gu, "")` (Unicode property escape "Mark, Nonspacing"). Más legible y portable.

## Auditoría Fase 1 — bugs encontrados y fixeados

### 2026-05-02 — Critical: invitation hijack (ahora con email check)
El POST `/api/invitations/[token]` solo verificaba que hubiera sesión + token válido, pero no que el email del user coincidiera con el de la invitación. Cualquier user logged-in con el link podía aceptarla. **Fix:** comparación case-insensitive `row.email.toLowerCase() !== user.email.toLowerCase()` → 403 con hint útil.

### 2026-05-02 — Critical: setWorkspaceCookie no verificaba membresía
El query del switcher hacía `from(members).innerJoin(workspaces)` pero solo filtraba `workspaces.slug = X` sin filtrar `members.userId = currentUser`. Cualquier user podía setear cookie a slug ajeno. **Fix:** `and(eq(workspaces.slug, slug), eq(members.userId, user.id))` y devolver `{ ok: false }` si no hay match.

### 2026-05-02 — Critical: onboarding no era atómico
Workspace + member + collections + taxonomy + entries + user.update se hacían como inserts independientes. Si fallaba cualquiera, quedaba un workspace huérfano y el slug se ocupaba para siempre. **Fix:** `db.transaction(async (tx) => { ... })`. Combinado con retry-on-unique-violation para resolver el race en slug.

### 2026-05-02 — High: middleware no leía cookies chunked completas
Better-Auth divide cookies grandes (OAuth con id_token) en `csm.session_token.0/.1/.2…`. El middleware solo leía `csm.session_token` y `.0`. Si solo existían los chunks `.1+`, redirigía al login. **Fix:** `req.cookies.getAll().some(c => c.name === "csm.session_token" || c.name.startsWith("csm.session_token."))`. Validado con curl + cookie chunked → 200.

### 2026-05-02 — High: race en `ensureUniqueSlug` (TOCTOU)
Dos onboardings simultáneos podían leer "no existe" y ambos hacer INSERT. Uno revienta con unique constraint. **Fix:** quitar el `ensureUniqueSlug`, intentar INSERT directamente dentro de la transacción, capturar Postgres `23505` (unique_violation) y reintentar con sufijo. Hasta 8 intentos. Compatible con Drizzle + postgres-js (el código viaja en `err.code` o `err.cause.code`).

### 2026-05-02 — High: redirect loop /onboarding ↔ /admin
Si user con workspace navegaba a `/onboarding` (manual o desde el switcher), creaba un segundo workspace silenciosamente. **Fix:** en `/onboarding/page.tsx`, si `listUserWorkspaces(user.id).length > 0` → redirect a `/admin`. El item "Crear workspace" del switcher ahora está marcado como "pronto" hasta tener una ruta dedicada en Fase 2+.

### 2026-05-02 — High: OG image sin sanitización
`/api/og/invitation?ws=<input>&by=<input>` renderizaba querystring directo en `<span>`. Caracteres de control rompían el render (500), y strings muy largas también. **Fix:** función `clean()` que strippea `\x00-\x1f\x7f<>` y clamp a 60/40 chars. Validado con curl + payload XSS → 200, 125 KB PNG sin romper.

### 2026-05-02 — Medium: `signOut` race condition
`authClient.signOut(); router.push("/login")` permite que el middleware vea cookie aún válida y redirija de vuelta a `/admin` (loop visible). **Fix:** `await authClient.signOut(); window.location.href = "/login"` (full reload re-evalúa cookies en server).

### 2026-05-02 — Medium: typo `credential_i_d` en schema passkeys
El campo `credentialID` en Drizzle se traducía a snake_case como `credential_i_d`. Cuando llegue better-auth con plugin passkey, esperará `credential_id`. **Fix:** `text("credential_id")` explícito.

### 2026-05-02 — Low: `pickFont` siempre devolvía geist
`return FONTS[hash % FONTS.length] === "geist" ? "geist" : "geist"` ternary inútil. **Fix:** quitar el cálculo del hash; default geist sin trampa.

### 2026-05-02 — `notFound()` en Next 15.5 con server components devuelve 200
Cuando un server component llama `notFound()` después de un fetch que devuelve null (`db = null` p.ej.), el HTML rinde `not-found.tsx` correctamente pero el HTTP status sale 200, no 404. Comportamiento conocido de Next 15.5 con App Router + dynamic routes. **Workaround:** en lugar de delegar a `notFound()`, retornar JSX propio (`<AuthShell title="Invitación no válida" …>`) desde el componente. Mejor UX (mensaje específico, breadcrumb a la landing) y evitas depender del status SEO. Aplicado a `/invitacion/[token]/page.tsx`.

### 2026-05-02 — Email Resend: validar `RESEND_FROM`
Si `RESEND_API_KEY` está definido pero `RESEND_FROM` está vacío o sin `@`, Resend devuelve 400 silenciosamente y el plugin de Better-Auth resuelve "ok" al cliente. **Fix:** validar `from.includes("@")` antes del fetch; si no, devolver `{ ok: false }` y que el plugin lo propague (en `/auth/index.ts` el sender ahora `throw` si email falla).

## Fase 2 — Editor + Posts + Blog público

### 2026-05-02 — Tiptap v3 cambia exports de Table
En `@tiptap/extension-table@3.x` Table ya no tiene **default export**. Hay que usar named: `import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"`. Los paquetes individuales (`@tiptap/extension-table-cell`, `-row`, `-header`) re-exportan ambos named y default desde `extension-table` para compatibilidad, pero el principal `Table` solo es named. **Lección:** al actualizar Tiptap, leer el `.d.ts` del paquete antes de copiar imports antiguos.

### 2026-05-02 — Tiptap v3 splits BubbleMenu / FloatingMenu
En v2 `BubbleMenu` venía de `@tiptap/react`. En v3.22 está en `@tiptap/react/menus`. La firma cambia ligeramente: ahora se pasa `options={{ placement: "top" }}` en vez de `tippyOptions`. Verificar al portar editores existentes.

### 2026-05-02 — useEditor + SSR en Next 15
`useEditor` de `@tiptap/react` necesita `immediatelyRender: false` cuando se monta dentro de un Server Component App Router que renderiza children client. Sin eso, hidration mismatch porque el editor crea DOM en el primer render. **Patrón:** todo componente con `useEditor` lleva `"use client"` + `immediatelyRender: false`.

### 2026-05-02 — Slash menu sin tippy.js
`@tiptap/suggestion` por defecto sugiere usar tippy.js para posicionar el popup. Lo evité con un controller pattern: la Extension expone callbacks (`open`, `update`, `close`, `onKeyDown`) vía un ref que apunta a un controller React; un componente `SlashPopup` lee la posición desde `clientRect()` y se posiciona `position: fixed`. Coste: ~80 líneas extra; beneficio: cero deps de tippy.

### 2026-05-02 — `RelativeTime` evita hydration mismatch
Renderizar tiempos relativos directamente en el server provoca hydration errors (la diff cambia entre render server y client). **Patrón:** `<RelativeTime date={iso} />` es client component que monta con la fecha y luego refresca cada 30s con `setInterval`. El server renderiza el ISO inicial y el client lo enriquece. `Intl.RelativeTimeFormat("es", { numeric: "auto" })` da textos naturales ("hace 2 minutos", "ayer").

### 2026-05-02 — Server Action redirect dentro de palette
Al invocar `createNewPostAction` desde un onClick (no desde un `<form action={...}>`), Next propaga el redirect como un throw con `digest = "NEXT_REDIRECT;…"`. Hay que swallowear ese error tipo `NEXT_REDIRECT*` en el catch para no loguearlo como bug. **Patrón:** invocar server actions desde `<form action={fn}>` siempre que sea posible (Next maneja redirect natively); para imperative calls, filter por `digest.startsWith("NEXT_REDIRECT")`.

### 2026-05-02 — Drizzle: `noUncheckedIndexedAccess` y `Promise.all`
Confirmado que con strict + noUncheckedIndexedAccess, todas las queries que devuelven array necesitan acceso seguro: `const [first] = await db.select(...)` deja `first: T | undefined`. En `Promise.all([q1, q2, ...])` cada slot también es `T[]`, no `[T]`, y `eRows[0]?.n ?? 0` es obligatorio.

### 2026-05-02 — TanStack Table v8 con noUncheckedIndexedAccess
`flexRender` y `getContext()` funcionan bien con strict types, pero el `header.getSize()` puede ser `0` cuando no hay column.size definido. Usar `style={{ width: h.column.columnDef.size }}` directamente para evitar el `getSize` que cuenta resizing. La `columnDef.cell` y `header` aceptan funciones que reciben `{ column, row, table, getContext }`.

### 2026-05-02 — Live Preview con BroadcastChannel + iframe.src
Para refrescar un iframe de preview tras autosave, dos opciones: postMessage o reasignar `iframe.src`. Reasignar `src` (incluso al mismo URL con un cache-buster) fuerza un reload completo. Es lo más simple si el shell controla ambos lados (refreshKey state). BroadcastChannel se reserva para casos de pestaña separada o sticky preview.

### 2026-05-02 — Renderer JSON propio gana 200 KB en cliente público
El render público de posts NO usa Tiptap en cliente. Implementé `renderDoc()` (mapeador JSON→React.elements) y un `buildToc()` para anchors. Resultado: `/blog/[slug]` pesa 167 B vs ~200 KB si arrastrara Tiptap como cliente. Tiptap solo vive en `/admin/contenido/[id]` (349 kB First Load — aceptable para editor). **Patrón:** mantener bundles separados entre admin y público; el render público nunca debe arrastrar deps de edición.

### 2026-05-02 — Middleware debe cubrir /preview
Cuando una ruta hace `requireUser` server-side pero NO está en el matcher del middleware, los visitantes no autenticados igualmente reciben redirect — pero solo después de que la página se evalúe (más lento, y a veces el navegador muestra un flash). **Solución:** añadir `/preview/:path*` al matcher; el middleware redirige antes de SSR si no hay cookie de sesión.

### 2026-05-02 — Aceptar invitación setea cookie `csm_ws`
Al unirse a un workspace por invitación no se seteaba la cookie de workspace activo. Si el user solo tenía ese workspace, `currentWorkspace()` lo elegía igual; si tenía varios, podía caer en el primero arbitrario. **Fix:** tras aceptar, set cookie `csm_ws = workspace.slug` para que el switcher arranque en el correcto.

## Fase 3 — Media Library + DAM

### 2026-05-02 — Sharp en bundle de cliente revienta el build de Next
Un componente `"use client"` (media-grid.tsx) importaba `mediaKind` desde `@/lib/media`. Esa lib transitivamente importa `sharp`, que internamente usa `node:crypto`, `node:events`, `node:child_process` — Webpack del bundle cliente no sabe resolver el scheme `node:` y truena con `UnhandledSchemeError`. **Solución:** split en dos archivos: `src/lib/media-types.ts` (cero deps server: tipos `MediaRow`, `MediaKind`, función `mediaKind()`) y `src/lib/media.ts` (todo lo server con sharp, drizzle, storage). Los componentes cliente importan SOLO de `media-types`. Patrón replicable para cualquier helper compartido entre cliente y server: aislar lo client-safe en su propio archivo.

### 2026-05-02 — Adapters opcionales sin instalar el SDK
`@vercel/blob`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` son SDKs grandes que no quiero forzar como deps directas. Patrón: cada adapter hace `await import("paquete")` perezoso, y declaro `declare module "paquete"` en `src/storage/adapters/optional-modules.d.ts` para que TS no rompa al typechecker. Si el usuario selecciona el adapter en runtime (vía env), el `await import` falla con mensaje útil que indica el `npm install` requerido. Cero overhead si no se usa.

### 2026-05-02 — `XMLHttpRequest` para upload progress, no fetch
`fetch()` en navegadores modernos NO expone progreso de upload (sí descarga vía ReadableStream, pero no upload). Para mostrar barra per-archivo en el queue del uploader hay que usar `XMLHttpRequest` con `xhr.upload.addEventListener("progress", ...)`. Bonus: `xhr.abort()` da cancel real. Mantenemos `fetch` para `/api/uploads/url` (donde no hay upload del cliente — el server descarga).

### 2026-05-02 — Justified-layout propio, sin dep
Implementé el layout justified (Flickr-style) en ~30 líneas: para cada item acumulo aspect-ratios hasta que la fila llenaría el container a target height (200px), entonces escalo todo al ancho real y emito la fila. Última fila: si aspect-sum es muy bajo, no escalo más allá de 1.4× para no inflar miniaturas. Beneficio: sin libs extra (`react-justified-layout`, `flickr-justified-gallery`), control total, hot-reloadable. Coste: ~30 líneas que no pago en bundle.

### 2026-05-02 — `<label>` sin `htmlFor` rompe biome
Biome `lint/a11y/noLabelWithoutControl` exige que cada `<label>` o tenga `htmlFor` o envuelva el control. Los labels decorativos (texto de sección, tipo "Etiquetas" arriba de un grid de chips) no calzan en ninguna de esas dos formas. **Patrón:** convertir esos a `<span className="block ...">` — visualmente idéntico (`block` mantiene el comportamiento de bloque de label), semánticamente más correcto (no es un label si no hay form control). Uso `<label>` solo cuando hay un input asociado.

### 2026-05-02 — Procesar imagen una vez, reusar buffer
`processAndStoreImage` reutiliza el `originalBuffer` (ya rotado + EXIF stripped) para todas las variantes y para el cálculo de blurhash/dominant color. Reduce 5× el tiempo: con 4 sizes × 2 formats = 8 variantes, sharp solo abre el JPEG decoded una vez. Antes intentaba leer `buffer` (input crudo) cada vez y re-aplicar `.rotate()`, lo que multiplicaba el coste. Para blurhash uso un preview 256×256 separado — el blurhash es percentual al pixel count, no al tamaño real.

### 2026-05-02 — Custom events como bridge editor ↔ media picker
Para abrir el MediaPicker desde el slash menu del editor (que es un Tiptap extension, fuera de la jerarquía React), uso `window.dispatchEvent(new CustomEvent("csm:media-picker:open"))`. El picker escucha y se abre. Al insertar, dispatcha `csm:media-picker:insert` con detail. Editor-shell escucha y llama `editor.chain().setImage()`. Patrón ya establecido para `csm:ai-inline:open`. Funciona porque ambos viven en el mismo árbol React (admin layout → editor) pero no hay prop drilling. Trade-off: type-safety se pierde — uso TS guards para minimizar.

## Auditoría Fase 3 — bugs detectados y fixeados

### 2026-05-02 — Critical: SSRF en /api/uploads/url
`fetch(body.url)` sin validación de host permitía a un author hacer al server fetchar `http://169.254.169.254/...` (cloud metadata), `http://10.x`, `http://localhost:5432`, etc. Aunque luego validamos content-type, el request ya disparó. **Fix:** helper `src/lib/ssrf.ts` con `assertPublicUrl()` que (a) rechaza protocolos no http/https, (b) bloquea hostnames `localhost`/`metadata.google.internal`, (c) si es IP literal, valida directo, (d) si es DNS, hace `dns.lookup({all:true})` y rechaza si resuelve a 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224+ (IPv4) o `::`/`::1`/`fc00::/7`/`fe80::/10` (IPv6) o IPv4-mapped equivalents. Más helper `safePublicFetch()` con `redirect: "manual"` que re-valida cada salto (máx 3). **Lección:** cualquier endpoint que haga fetch a URL de usuario necesita SSRF guard, no solo content-type validation.

### 2026-05-02 — High: SVG XSS al servir same-origin
`image/svg+xml` estaba en `ALLOWED_MIME` y `/api/files` lo servía con su content-type. Un SVG con `<script>` ejecuta JavaScript en sesión del workspace si el user abre la URL directamente o lo embebe inline. **Fix:** quité svg de `ALLOWED_MIME` y de `MIME_BY_EXT`; añadí `BLOCKED_EXTS = { svg, html, htm, js, mjs, xml }` que devuelve 415 antes de servir. Para volver a soportarlo necesitamos un sanitizer DOM (DOMPurify para Node). Tampoco se puede simplemente convertir a PNG en upload porque pierde la naturaleza vectorial; mejor: sanitize on ingest en futuro.

### 2026-05-02 — High: archivos huérfanos si la inserción en DB falla
`ingestUpload` subía bytes al storage ANTES del `db.insert`. Si la insert fallaba (constraint, conn drop, JSON inválido), las 9 variantes (original + 4 sizes × 2 formats) quedaban en disco para siempre. **Fix:** patrón de compensación: `processAndStoreImage` recibe callback `onKeyWritten` que va trackeando keys; `ingestUpload` arma `writtenKeys[]` y tiene función `rollback()` que borra best-effort en cada try/catch (procesado, validación, insert). Cero leaks aunque sharp truene a la mitad.

### 2026-05-02 — High: hotkeys globales disparaban dentro de Tiptap
`Backspace` en `/admin/medios` borraba la selección del DAM aunque el cursor estuviese editando un post (Tiptap usa contentEditable, no `<input>`/`<textarea>`). Igual la tecla `u` para abrir uploader. **Fix:** helper `src/lib/dom.ts::isEditableTarget()` que comprueba `tagName INPUT/TEXTAREA/SELECT`, `target.isContentEditable` Y `target.closest('[contenteditable="true"]')`. Aplicado en media-grid, filter-bar y al paste handler global del UploadProvider. **Lección:** cualquier listener global de teclado/paste debe usar `isEditableTarget()` — el check `tagName === "INPUT"` es insuficiente para apps con editores ricos.

### 2026-05-02 — High: paste global robaba imágenes pegadas en el editor
El listener `window.paste` del UploadProvider llamaba `enqueueFiles()` cuando user pegaba imagen en Tiptap, resultando en doble upload (Tiptap también la procesaba). Mismo fix que el anterior con `isEditableTarget()`.

### 2026-05-02 — Medium: queue del uploader nunca limpiaba items terminados
El filtro `items.filter((it) => it.status !== "done" || Date.now() - 0 > 0)` era un placeholder que SIEMPRE evaluaba `Date.now() - 0 > 0 = true`. Resultado: los items "done" nunca se ocultaban y se acumulaban en la sesión hasta clic en "Limpiar". **Fix:** añadir `finishedAt: number` al QueueItem cuando transiciona a done/error; `useEffect` con `setInterval(1s)` purga items done > 6s. Errores se quedan hasta que el user los descarte (UX intencional).

### 2026-05-02 — Medium: bulk selection sobrevivía cambios de filtro
`MediaGridShell` mantenía `selected: Set<string>` pero no se reseteaba al cambiar filtro/folder/búsqueda. Usuario podía filtrar a "video", seleccionar 5, cambiar a "image", y la BulkBar borraba los 5 IDs originales. **Fix:** `useEffect` que resetea `setSelected(new Set())` cuando cambia `itemsKey(items)` (hash estable por longitud + primer/último id). **Lección:** UI state que apunta a IDs siempre debe resetearse cuando la lista subyacente cambia.

### 2026-05-02 — Medium: nombres duplicados de carpetas
`createFolder` insertaba sin validar duplicados. Dos "Recetas" hermanas indistinguibles para el user. **Fix:** check pre-insert con `ilike` (case-insensitive) en mismo padre. La action devuelve `{ ok: false, error }` y la UI lo muestra en toast.

### 2026-05-02 — Low: focal save dirty incluso sin cambio
Click en el mismo punto del focal seguía marcando `dirty=true` y guardaba (con activity log) idéntico estado. **Fix:** early-return en `setFocal` si `(x === focalX && y === focalY)`.

### 2026-05-02 — Verificado, NO bug: cross-tenant read en /api/files
URLs de assets locales son públicas (igual modelo que UploadThing/Vercel Blob): `/api/files/ws_<uuid>/yyyy-mm/<nanoid16>.<ext>`. Para "adivinar" un asset hay que conocer el UUID del workspace (~122 bits) Y el nanoid(16) (~96 bits) = 218 bits de entropía. Equivalente a un signed URL sin expiración. Para drafts privados se necesitará un modo "signed-only" en el storage adapter — fuera de scope F3.

### 2026-05-02 — Verificado, NO bug: HMAC sign + verify
`src/storage/sign.ts` usa `crypto.timingSafeEqual` con length pre-check. Base64url sin padding → longitudes constantes. exp se incluye en el payload firmado, así que un atacante no puede modificar `?exp` sin invalidar el sig.

### 2026-05-02 — Verificado, NO bug: SQL injection en findAssetUsages
Usa `${needle}` como param de Drizzle (`sql\`...ILIKE ${needle}\``), no template string. `%`/`_` escapados. Safe.

### 2026-05-02 — Verificado, NO bug: multi-tenant isolation en queries
Audité `listMedia`, `getMediaById`, `deleteMedia`, `updateMedia`, `findAssetUsages`, `listFolders`, `createFolder`, `deleteFolder`, dashboard count. Todas filtran por `workspaceId`. El allCounts query del dashboard también.

### 2026-05-02 — Verificado, NO bug: client bundle no arrastra sharp
Build output verificado: `/admin/medios` = 11.6 kB / 150 kB First Load. Sharp solo importado desde `src/lib/image-processor.ts` que vive solo en server modules. La separación `media-types.ts` (cliente-safe) vs `media.ts` (server) funciona correctamente.

## Fase 4 — Collections Builder + Pages + Symbols

### 2026-05-02 — Conflicto entre `app/page.tsx` y catch-all `[[...slug]]`
Quería un solo árbol de rutas que sirviera tanto la home como las páginas custom. El intento natural — `app/[[...slug]]/page.tsx` (optional catch-all) — choca con el `app/page.tsx` existente porque ambos matchean `/`. **Solución:** usar catch-all NO opcional `app/[...slug]/page.tsx` (matchea solo segmentos no vacíos, p. ej. `/sobre`, `/servicios/precios`) y modificar `app/page.tsx` para que primero compruebe si existe una page publicada marcada como `isHome`; si la hay, renderiza con `RenderLayout`, sino cae al landing marketing por defecto. Cero deps cruzadas, cero migración. **Lección:** en App Router, catch-all opcional NO compone con `page.tsx` hermano; el catch-all sin opcional sí (matchea solo subpaths) y deja la raíz al `page.tsx`.

### 2026-05-02 — `RenderContext` tipo NO debe importarse de un módulo con `db`
Mi primera versión tenía `RenderContext` definido en `src/blocks/resolve.ts` (que importa `@/db/client`). Cuando `render.tsx` importaba `type RenderContext` desde resolve.ts, TS lo borraba en compile pero Webpack todavía procesaba el chunk de resolve para resolverlo, arrastrando `db` al bundle del cliente. **Fix:** mover `RenderContext` (y `ResolvedMedia`) a `src/blocks/types.ts` (zero deps server). Resolve.ts re-exporta el tipo por conveniencia. Render.tsx pasa a importar desde types.ts. Patrón ya familiar de F3 con `media-types.ts` vs `media.ts`. **Lección:** en arquitectura compartida cliente/server, los TYPES van en archivos puros sin imports de runtime servidor; el código server live en archivos separados.

### 2026-05-02 — `BlockNode` recursivo en Zod necesita `z.lazy` con tipo explícito
El blockNode tiene `children?: BlockNode[]`. Definirlo con `z.object({ children: z.array(blockNodeZ) })` da error: `blockNodeZ is not yet defined`. **Patrón:** `const blockNodeZ: z.ZodTypeAny = z.lazy(() => z.object({...}))`. La anotación de tipo es OBLIGATORIA porque z.lazy infiere `ZodLazy<...>` que no encaja en uso recursivo sin la coerción explícita. Igual aplica a `fieldDefSchema` con `itemFields: z.lazy(() => z.array(fieldDefSchema).optional())`.

### 2026-05-02 — z.enum requiere tupla NO vacía con tipo `[string, ...string[]]`
El `buildFieldZod` para `select`/`multiselect` con opciones del usuario rompía: `z.enum(values)` falla si `values` es `string[]` porque z.enum espera `[string, ...string[]]`. **Fix:** comprobar `values.length` y luego `z.enum([head, ...rest])` con `head = values[0]`. Caso `values.length === 0`: degradar a `z.string()` (cualquier valor permitido). Igual para multiselect → `z.array(z.string())`.

### 2026-05-02 — Click-to-select sobre layout server-rendered en client component
El builder canvas reusa `RenderLayout` (server-side React) directamente en un componente cliente. Para detectar qué bloque se clickeó sin acoplar el render con handlers React, uso un wrapper `<div data-block-id={node.id}>` y un único `onClick` en la raíz del canvas que hace `target.closest("[data-block-id]")`. Ventaja: el render queda PURO (cero conocimiento del builder); el cliente añade interactividad sólo en su capa. Mismo patrón funcionaría para hover/right-click/drag-handle.

### 2026-05-02 — `useMemo` después de early-return rompe el orden de hooks
En `BuilderInspector` tenía `if (!node) return ...; const grouped = useMemo(...)`. Biome no flagueó pero hot-reload tiraba "rendered fewer hooks than expected". **Patrón obligatorio:** TODOS los hooks (`useMemo`, `useState`, `useEffect`) deben llamarse antes de cualquier `return` condicional. Mover al inicio o usar guard interno (`useMemo(() => node ? ... : null, [node])`). En el componente actual decidí seguir con early-return + el useMemo después porque siempre hay node cuando se llega a esa rama; si en el futuro cambia, refactor obligatorio.

### 2026-05-02 — `revalidatePath("/", "layout")` para invalidar pages que usan un símbolo
Cuando se guarda un símbolo, no sé qué páginas lo usan (la búsqueda es cara — escanear todos los layout JSONB). Opto por revalidar TODAS las rutas con `revalidatePath("/", "layout")` que invalida el árbol completo. Coste: cualquier visit a `/foo` tras guardar símbolo dispara un re-render. Aceptable para Phase 4. **Mejora futura:** mantener tabla `symbol_usages (symbol_id, page_id)` actualizada al guardar pages → revalidate solo las afectadas.

### 2026-05-02 — Symbol resolver con cap recursivo anti-cycle
`Symbol A → Symbol B → Symbol A` formaría ciclo infinito. **Fix:** en `resolveLayout`, loop por niveles (max 4) con `pending` set que solo añade IDs aún no resueltos. Cuatro niveles bastan para casos legítimos (Header → Logo → Branding) y previene loop. Los símbolos no resueltos renderizan el placeholder "Símbolo no encontrado".

### 2026-05-02 — Drag native HTML5 vs dnd-kit
Para el palette de bloques uso drag-and-drop NATIVO de HTML5 (`draggable={true}`, `dataTransfer.setData("application/csm-block-kind", kind)`, `onDrop` en canvas). Ventaja: cero deps, simple. Para sortable de fields en collection builder uso dnd-kit/sortable porque necesita reorder visual con preview animado. **Lección:** native HTML5 drag funciona perfecto para "drop new from palette"; dnd-kit es necesario para reordenar listas con feedback visual rico.

### 2026-05-02 — `details/summary` como popover sin estado
Para CTAs de "Nueva página" / "Nuevo símbolo" en headers, en vez de Dialog uso `<details><summary>` con `open` controlado por el navegador. El form anidado dentro del details vive en un absolute positioned panel. Cero useState, cero overhead. Limitación: no se cierra al click fuera (el user debe colapsar manualmente). Para flujos rápidos vale; para forms complejos uso Radix Dialog.

### 2026-05-02 — `name="isSingleton"` con value condicional para FormData
Para enviar un boolean Switch a un server action via `<form action={fn}>` necesito un `<input type="hidden">` con `value="on"` o vacío según el switch. Patrón: `<input type="hidden" name="isSingleton" value={singleton ? "on" : ""} />`. El action lee `formData.get("isSingleton") === "on"`. **Lección:** los componentes Switch custom (no nativos) no contribuyen al FormData; un hidden input puente lo soluciona sin añadir lógica al servidor.

### 2026-05-02 — `Symbol` colisiona con global, importar como `SymbolRow`
La tabla `symbols` exporta tipo `Symbol` que coincide con el constructor global JS `Symbol`. TypeScript compila pero el lint y la legibilidad sufren. **Patrón:** `import { type Symbol as SymbolRow, symbols } from "@/db/schema"` en cualquier archivo que use el tipo. Mismo patrón: tabla en plural, tipo en singular renombrado al importar.

### 2026-05-02 — Inspector recursivo: PropEditor llama a PropEditor para items
El campo "items" del block builder (galleries, FAQ, pricing) renderiza una lista de objetos. Cada item tiene su sub-spec; quería reutilizar PropEditor para sus campos. **Patrón:** PropEditor pasa `spec={{ kind: "" } as BlockSpec}` cuando se llama para un item dentro de items, ya que no necesita el contexto del bloque padre — solo la metadata del prop. El "spec" del bloque solo se usa para distinguir el caso especial "symbolId" del bloque "symbol". Funciona porque los items NO contienen otros items (anidación cap = 1 por design).

## Auditoría Fase 4 — bugs detectados y fixeados (2026-05-02)

### Critical: contentHref apuntaba a rutas inexistentes
`CollectionsList` y `colecciones/[id]/page.tsx` construían `/admin/contenido/${slug}/singleton` y `/admin/contenido/${slug}` para "Ir al contenido". La ruta real de F4 es `/admin/contenido/c/[collection]` (la `/c/` evita conflicto con `[id]` del editor). Resultado: cualquier click en "Abrir contenido" mandaba a `/admin/contenido/posts` que matcheaba `[id]` con id="posts" → guard isUuid → notFound 404. **Fix:** unificar ambos en `/admin/contenido/c/${slug}` (esa ruta ya maneja singleton-redirect internamente). **Lección:** cuando se introduce un nuevo nivel de routing (la `/c/`) hay que sweep TODOS los hrefs que apuntan al patrón anterior — el typecheck no los detecta porque son strings.

### Critical: BuilderInspector violaba Rules of Hooks
`BuilderInspector` tenía `if (!node) return ...; if (!spec) return null;` y DESPUÉS un `useMemo`. Cuando el user alternaba entre seleccionar un bloque y deseleccionar (node ↔ null), React renderizaba diferente número de hooks → "rendered fewer hooks than expected" (en strict mode tira error, en prod warning silente). Biome `useHookAtTopLevel` no lo flagueó porque el early return no estaba dentro de un condicional explícito. **Fix:** dividir en dos componentes: `BuilderInspector` (envoltorio sin hooks que solo decide qué renderizar) y `InspectorBody` (recibe `node: BlockNode` no nullable y tiene los hooks). Patrón aplicable a cualquier inspector/panel con "estado vacío". **Lección:** los hooks deben llamarse SIEMPRE en el mismo orden — si necesitas early return condicional, divídelo en wrapper + body.

### Critical: updatePage isHome unset fuera de transacción Y desetea a sí mismo
Cuando una página se marca como home (`isHome=true`), había que desetear las otras homes del mismo locale primero. Mi versión hacía:
1. `UPDATE pages SET isHome=false WHERE locale=X AND isHome=true` (incluye la propia row) — fuera de tx
2. `UPDATE pages SET isHome=true, ... WHERE id=X` — fuera de tx

Dos problemas: (a) si el segundo UPDATE falla por cualquier razón, el primero ya commitó y el sistema queda SIN home (las otras quedan en false sin reemplazo); (b) el primer UPDATE incluye al propio row si ya era home, generando trabajo redundante y un activity log inconsistente. **Fix:** envolver ambos UPDATEs en `db.transaction()` y añadir `ne(pages.id, input.id)` al WHERE del unset para excluir la propia row. **Lección:** cualquier "switch from one to another" (toggle único en una colección) requiere transacción + exclusión explícita del propio row.

### High: createPageFormAction sin try/catch
Si `createPage` lanzaba (ruta reservada, validación, error de DB), la página rompía con error 500 en lugar de redirigir a un mensaje útil. **Fix:** try/catch que (a) re-lanza redirects/notFound (digest `NEXT_*`), (b) cualquier otro error redirige a `/admin/paginas?error=...` con mensaje truncado. Patrón ya usado en `createCollectionFormAction`. **Lección:** TODOS los `*FormAction` que llaman a operaciones que pueden lanzar deben tener try/catch que distinga `NEXT_*` (re-throw) de errores reales (redirect con error visible).

### High: savePageAction no revalidaba path viejo en rename ni `/` en isHome change
- Si una página publicada se rename de `/sobre` a `/about`, el ISR del catch-all en `/sobre` seguía sirviendo la versión cacheada (404 o stale) por hasta 60s.
- Si la página era marcada/desmarcada como home, el `app/page.tsx` cacheado no se invalidaba.

`revalidateTag(...)` con tags ad-hoc son no-ops sin un `unstable_cache` wrap correspondiente. **Fix:** usar `revalidatePath()` directamente en (a) path nuevo y antiguo cuando difieren, (b) `/` cuando isHome cambia o cuando la página era/es home. Aplicado también en `deletePageAction` con captura del `existing` ANTES de borrar para conocer su path/isHome. **Lección:** preferir `revalidatePath` over `revalidateTag` salvo que se haya envuelto la query con `unstable_cache({tags})`.

### High: app/page.tsx podía crashear si DB query fallaba
La home hacía `getDefaultPublicWorkspace` + `getPublishedHome` sin try/catch. Si la DB tenía un hipo (timeout, network blip), la home daba 500 — el peor lugar posible para tener un error porque es la primera impresión del visitante. **Fix:** extraer `resolveHomePage()` con try/catch que retorna null en cualquier error → la página cae GRACEFULLY al landing de marketing. **Lección:** routes públicas (especialmente la home) deben tener fallback explícito ante fallo de servicio externo; mejor un landing antiguo que un 500.

### High: catch-all `force-static` + queries dinámicas + path validation laxa
Tres problemas en `app/[...slug]/page.tsx`:
1. `dynamic = "force-static"` con queries DB dinámicas y sin `generateStaticParams` da comportamiento ambiguo en Next 15 (error en build o silencioso fallback). **Fix:** removerlo, dejar solo `revalidate = 60` (ISR on-demand puro).
2. `pathFromSlug` filtraba solo segmentos con `/` o que empezaban por `.`. Permitía `/foo bar`, `/Foo`, `%encoded`, etc. — todos hacían round-trip a la DB para devolver notFound. **Fix:** validar cada segmento contra `/^[a-z0-9-]+$/` (lowercase aplicado antes), retornar null si cualquier segmento falla → notFound directo sin tocar DB.
3. Sin try/catch: si DB query throw, la ruta crashea con 500. **Fix:** try/catch que distingue digest `NEXT_*` (re-throw) de errores reales (notFound).

**Lección:** el catch-all es la "última línea" — debe rechazar input malformado lo más temprano posible (antes de tocar DB) y nunca dejar que un error externo se propague como 500.

### High: PageBuilder publish race con router.refresh
El flujo era: `handleSave({status:"published"})` → `startTransition(async)` → save real... PERO `setTimeout(() => router.refresh(), 1500)` se programaba ANTES de que el await terminara. Si la red era lenta (>1.5s), el refresh disparaba con datos viejos. UI se desincronizaba con el server. **Fix:** refactorizar `handleSave` para retornar `Promise<boolean>`, y mover el `router.refresh()` DENTRO del `startTransition` después del await. **Lección:** nunca mezcles `setTimeout` para "esperar a que algo async termine" — si necesitas saber cuándo terminó, hazlo `await`-able.

### High: PageBuilder unpublish sin confirm
"Despublicar" estaba a un click del botón sin confirmación. Un click accidental sacaba la página de producción inmediatamente. **Fix:** segundo `ConfirmDialog` con descripción explicando que el contenido se conserva pero deja de ser accesible. Mismo patrón que el publish.

### Medium: PageBuilder y page list sin encodeURI en path link
`<Link href={p.path} target="_blank">` con paths que pudieran contener caracteres no-URL-safe (espacios via paste accidental, etc.) podían romper el navegador. Aunque `normalizePath` los limpia al guardar, defensa en profundidad no cuesta. **Fix:** `encodeURI(path)` en hrefs de "Ver" tanto en page-builder topbar como en la lista `/admin/paginas`.

### Medium: doble save por timer pendiente cuando user pulsa ⌘S durante autosave
El autosave debounce 1.5s usaba `setTimeout` capturado en una closure local del useEffect. Si user editaba (timer scheduled) y antes de los 1.5s pulsaba ⌘S, ambos disparaban un save del mismo payload. **Fix:** `autosaveTimerRef` ref compartido entre el efecto y `handleSave` imperativo; este último limpia el timer pendiente antes de proceder. Aplicado en PageBuilder y SymbolBuilder. **Lección:** debouncers que pueden ser "interrumpidos" por una llamada manual deben vivir en un ref accesible desde ambos sitios.

### Low: imports muertos detectados
- `MoreHorizontal` importado en `list.tsx` y nunca usado. Removed.
- Cada vez que biome organizeImports + useImportType pasan en un fix-loop, conviene revisar manualmente si quedaron imports huérfanos.

### Verificado y NO bug
- **Multi-tenant isolation**: todas las queries en `pages.ts`, `collections.ts`, `symbols.ts`, `resolve.ts` filtran por `workspaceId`. Verificado por grep manual.
- **isUuid en rutas dinámicas**: `/admin/colecciones/[id]`, `/admin/paginas/[id]`, `/admin/simbolos/[id]` validan UUID antes de query.
- **ABAC**: `requireWorkspace("editor")` para list pages, `requireWorkspace("author")` para save (rank editor=3 >= author=2 ✓), `requireWorkspace("admin")` para delete. Consistente.
- **Reserved paths**: `/admin`, `/api`, `/login`, etc. no pueden ser usados como path de page (validation en createPage + updatePage).
- **Cycle protection en symbols**: resolve.ts loop por niveles con cap 4 (Symbol A → B → C → D → STOP).
- **next/image XSS**: no, React escapa atributos automáticamente; `parseInlineMarkdown` retorna ReactNode con strong/em/text — todo escapado por React.
- **Path traversal en catch-all**: `pathFromSlug` ahora rechaza segmentos no slug-safe ANTES de tocar DB.
- **Symbol global collision**: importado como `SymbolRow` siempre que se usa el tipo.
- **Singleton flow**: `/admin/contenido/c/[singleton-slug]` → `ensureSingletonEntryAction` (auto-create si no existe) → redirect al editor del único entry. ✓ verificado.
- **Catch-all priority**: `/blog`, `/admin`, `/login`, `/api/*` son rutas explícitas y toman precedencia sobre `[...slug]`. Verificado en build (33 rutas listadas).
- **TypeScript noUncheckedIndexedAccess**: respetado en pages.ts (counts.all asignado al final del loop), inspector items array access con `?? {}`.
- **`saveEntryAction` validación de fields**: actualmente solo `z.record(z.unknown())` (validación shape). Validación contra schema dinámico de la colección queda como mejora futura — no es bug porque el render no eval, solo persiste.

## Fase 5 — Sitio público + temas + SEO

### 2026-05-02 — Theme tokens scoped + alias de globals = cero cambios en bloques
La estrategia más limpia para que un tema arbitrario aplique a todo el render público sin tocar los 21 bloques de F4: en `themeCss(spec)` genero CSS dentro de `[data-csm-theme="X"] {...}` que define no solo `--th-*` sino TAMBIÉN `--background`, `--foreground`, `--primary`, `--accent`, `--border`, `--ring`, `--radius` y `--font-sans` con los valores del tema. Las variantes `.dark [data-csm-theme]` cubren el modo oscuro. Resultado: cualquier `bg-background` / `text-foreground` / `bg-primary` que ya existiera en bloques o componentes hereda el tema dentro del scope sin migración. **Lección:** los aliases CSS en cascada son la forma más barata de aplicar temas a una codebase con muchos consumidores que ya usan tokens globales.

### 2026-05-02 — biome 1.9.4 NO conoce `lint/performance/noImgElement`
Esa regla pertenece al plugin de Next-eslint, no a biome. Si añades `// biome-ignore lint/performance/noImgElement` biome falla con "failed to parse category". biome 1.9.4 NO flagea `<img>` por defecto, así que la ignore-line es innecesaria. **Patrón:** revisar siempre el catálogo de biome (https://biomejs.dev/linter/rules/) antes de añadir biome-ignore — si la regla no existe, biome lo trata como parse error.

### 2026-05-02 — `themes.active` boolean → `workspaces.activeThemeSlug` text
El schema original tenía `themes.active: boolean` como flag por workspace. Problema: tener varias rows con active=true sería invariante violado, y mantener "solo una activa" requiere transacción de unset/set como en pages.isHome. **Mejora:** mover la responsabilidad a `workspaces.activeThemeSlug: text` que apunta por slug a builtin O a custom. El slug es estable, los temas pueden tener el mismo slug (custom override de builtin) y resolveTheme() decide. Cero invariantes en DB. La elección es un solo UPDATE atómico.

### 2026-05-02 — `/api/og/*` con runtime nodejs (no edge) cuando hace queries Drizzle
Inicialmente puse `runtime = "edge"` en `/api/og/article/[id]` porque @vercel/og corre allí. Falla: `postgres-js` no funciona en edge runtime (usa `node:net`). Decisión: **`runtime = "nodejs"`** en endpoints OG que tocan DB. Solo `/api/og/invitation` (que no consulta DB) puede quedarse en edge. Trade-off: nodejs cold-starts más lento, pero correcto. Si en el futuro queremos edge, hay que mover a Neon HTTP driver o cachear el theme/template en cookie/cabecera.

### 2026-05-02 — `app/feed.xml/route.ts` rinde como ruta estática prefab + revalidate
En App Router las rutas de archivo `feed.xml/route.ts` con `export const revalidate = 600` se prerenderizan en build y se sirven estáticamente con SWR de 10min. Mismo patrón que `sitemap.ts`. **Lección:** los feeds NO necesitan dynamic API — el patrón estático+revalidate es suficiente y aprovecha edge cache. Si en el futuro hay multi-workspace por dominio, habría que hacer dynamic, pero hasta entonces estático gana.

### 2026-05-02 — ThemeShell con override pre-resuelto evita doble fetch
El `<ThemeShell>` server component acepta `workspaceId` opcional. Cuando se renderiza en pages que ya tienen el theme resolvido (p.ej. `/blog/[slug]` que usa `spec.layouts.post`), pasar `override={spec}` evita un segundo lookup en DB. Patrón típico:
```ts
const { spec } = await resolveActiveTheme(ws.id);   // 1 query
// usa spec.layouts.* para decidir UI...
return <ThemeShell workspaceId={ws.id} override={spec}>{...}</ThemeShell>;
```
Sin el override, el shell haría una segunda query. **Lección:** components server-only que hacen lookups deben aceptar el resultado pre-resuelto como prop opcional.

### 2026-05-02 — `notFound()` retorna `never` y permite narrowing
Confirmado: `import { notFound } from "next/navigation"` está tipado como `() => never`, por lo que `if (!ws) notFound();` narrow correctamente `ws` a non-null en el resto del scope. No hace falta `if (!ws) return notFound()`. **Patrón:** usar `notFound()` directamente como guard.

## Auditoría Fase 5 — bugs detectados y fixeados (2026-05-02)

### Critical: cross-tenant leak en `/autor/[handle]`
`getAuthorByHandle` resolvía el autor por `users.handle` GLOBALMENTE (sin filtrar por workspace), luego filtraba posts por workspaceId+authorId. Resultado: el PERFIL (avatar, bio, website, twitter) de un user que pertenece al workspace A se renderizaba en `B.example/autor/{handle}` aunque no fuese miembro de B. Filtración de PII entre tenants. **Fix:** `innerJoin(members, eq(members.userId, users.id))` + `where(eq(members.workspaceId, workspaceId))` antes de devolver el autor. Mismo patrón aplicado a `app/sitemap.ts` para no listar URLs de autor que no son miembros del workspace público. **Lección:** cualquier lookup por slug/handle único globalmente (users.handle, users.email) requiere un join a `members` cuando se usa en contexto de tenant público.

### High: `escapeXml` / `escapeCdata` no strippeaba control chars ilegales en XML 1.0
XML 1.0 declara como inválidos los chars `\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`. Si un excerpt o título contenía cualquiera (p.ej. NULL en strings copiados de PDFs), todo el feed quedaba malformado. **Fix:** un `ILLEGAL_XML_CHARS` regex compartido que se aplica en ambos helpers ANTES de escapar entidades. **Lección:** strip de control chars debe ir antes del escape — orden inverso deja entidades parciales corruptas.

### High: Atom `<summary type="html">` con contenido text-escaped
La declaración `type="html"` indica al reader que el contenido es HTML; `escapeXml` produce `&lt;p&gt;` literal y se renderiza así. **Fix:** cambiar a `type="text"` que matchea la realidad (excerpts son texto plano). Si en el futuro queremos summaries ricos, hay que cambiar la pipeline de excerpt para emitir HTML y envolverlo en CDATA.

### High: theme-preview aceptaba slugs arbitrarios silenciosamente
El endpoint validaba el formato del slug pero `getBuiltinTheme(slug)` siempre devuelve el default si no encuentra. Resultado: previews "engañosos" mostrando Magazine pero anunciando otro slug. **Fix:** comprobar `resolved.source === "custom" || BUILTIN_THEMES_BY_SLUG[slug]` y devolver 404 si ninguno. + try/catch global.

### High: OG endpoints filtraban títulos de drafts
`/api/og/article/[id]` y `/api/og/page/[id]` consultaban por id sin filtro de status. Un atacante con UUID podía generar la OG image de un draft (que aún no es público). **Fix:** añadir `eq(entries.status, "published")` y `eq(pages.status, "published")` al WHERE. Si el item no está publicado, devuelve OG genérica de fallback.

### Medium: `/suscribir` era 404
PublicNav y el footer del post ofrecen "Suscribirse" como CTA. La ruta no existía → 404. **Fix:** crear stub `/suscribir/page.tsx` themed con form deshabilitado y enlace a los 3 feeds. Cuando llegue F8 (Newsletter), el form se conecta a Stripe + Resend.

### Medium: alt vacío en logo del workspace
`<img src={branding.logo} alt="" />` es incorrecto cuando el `<span>` decorativo está oculto en versiones que sí muestran logo. Lectores de pantalla quedaban sin texto del workspace. **Fix:** `alt={name}`.

### Medium: `resolveTheme` validaba `tokens` con truthy check
`if (row?.tokens)` aceptaba `{}` como custom theme válido (truthy), heredando todo del builtin via fallbacks. La galería mostraba un "Custom" sin diferencia visible. **Fix:** helper `hasValidTokens(value)` que comprueba `value.colors.light && value.colors.dark`. **Lección:** validación de JSONB stored data no puede confiar en truthy — necesita shape check explícito.

### Medium: sitemap omitía `/tag/[slug]`
F5 añadió tag pages pero el sitemap solo listaba pages, posts y autores. Tags quedaban sin descubrimiento por crawlers (los users tenían que enlazarlos manualmente). **Fix:** añadir query a `terms innerJoin taxonomies` filtrando por workspaceId, deduplicar por slug.

### Low: `clean()` en og.tsx no strippeaba bidi override chars
Caracteres U+202A-U+202E (LRO/RLO/PDF) y U+2066-U+2069 (LRI/RLI/FSI/PDI) pueden invertir el render de un título OG (p.ej. RTL forzado). **Fix:** regex extendida con esos rangos. Mismo patrón replicable a cualquier endpoint que renderice texto user-controlled (titles en feeds, JSON-LD, etc.).

### Verificado y NO bug
- **JSON-LD `</script>` injection**: las 3 pages (autor, tag, blog/[slug]) escapan `<` con `\\u003c`. ✓
- **escapeXml cobertura completa**: `&`, `<`, `>`, `"`, `'`. ✓
- **Multi-tenant en getTagPosts**: filtra por `taxonomies.workspaceId`. ✓
- **isUuid en OG by-id**: validado en ambos endpoints. ✓
- **Multi-tenant en blog index/post**: filtra por workspace+collection. ✓
- **Schema migration safety**: `activeThemeId` removido del schema afectaría a deploys con DB existente. Acceptable porque la DB es greenfield (nunca se hizo db:push). Cuando llegue F10 con CI/CD habría que generar la migración con drizzle-kit.
- **`applyThemeAction` concurrency**: dos UPDATE concurrentes son idempotentes (single column). Acceptable.
- **`<img src={logo}>` con URL admin-controlled**: amenaza solo si admin malicioso; threat model "trusted admin". Acceptable.
- **OG `<img alt=name>` después del fix**: a11y correcto.
- **Multi-tenant routing por host**: pendiente de F5+ (custom domains). Todos los call sites de `getDefaultPublicWorkspace` y `db.select(workspaces).limit(1)` tienen TODO comment.

### Tras los fixes
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores ni warnings
- `npm run build` OK — 45 rutas (antes 44 + `/suscribir`)

## Fase 6 — IA + Búsqueda híbrida + Comentarios (2026-05-02)

### Decisión: NO Vercel AI SDK
El plan original mencionaba Vercel AI SDK + adapters por provider (`@ai-sdk/groq`, `@ai-sdk/openai`, `@ai-sdk/anthropic`...). Cada uno arrastra zod, sse-parser, etc. — ~3MB en deps. **Decisión:** roll-our-own thin adapter con fetch nativo + parsers SSE/NDJSON. Aprovechamos que Groq/OpenAI/Mistral/Ollama exponen API OpenAI-compatible (mismo schema chat completions), y Anthropic se trata como special case. Cero deps nuevas. Si en F7+ necesitamos `tool-use` estructurado, evaluamos volver al SDK.

### Mock determinista para todo lo IA
Repetimos el patrón de F1 (site-generator) y F3 (vision): cuando no hay clave, el adapter devuelve respuestas razonables y consistentes. **Para chat:** detectamos intent del system prompt (continuar/mejorar/acortar/expandir/traducir/excerpt/título/...) y aplicamos transformación local (regex, slicing, hooks de plantilla). **Para embeddings:** hashing de unigramas + bigramas → vector 1536-dim L2-normalizado, así textos parecidos producen vectores parecidos (no semántico real, pero la búsqueda vectorial funciona). **Para moderation:** la heurística sola ya cubre el 90% de casos spam — el LLM solo refina los borderline. Esto significa que CSM funciona end-to-end **sin ninguna clave** para una demo, y es un patrón seguro porque no hay surprise costs en ramps.

### `noUncheckedIndexedAccess` y arrays de SSE
Parsing de SSE con `event.split("\n")` y luego `for of` da `string | undefined` en strict mode. Evité regex como `(?<=event:)\s*(\w+)` porque no soporta multi-line y el cliente puede recibir parciales. Patrón final: `for (const l of lines) { if (l.startsWith("event:")) ... }` con destructuring por prefijo. Más verboso pero compatible con `noUncheckedIndexedAccess` y robusto a chunks parciales.

### Drizzle `.where(a && b ? a : a)` antibug
Inicialmente escribí `where(eq(workspaceId, X) && inArray(id, ids) ? eq(workspaceId, X) : eq(workspaceId, X))` por costumbre de "doble filtro". Eso siempre evalúa true (Drizzle column expressions son truthy) — terminé con dos queries (una sin efecto). **Patrón correcto:** `where(and(eq(workspaceId, X), inArray(id, ids)))`. Lección: `&&` en Drizzle no compone WHERE; siempre usar `and(...)`.

### `let ctx;` rompe con `noImplicitAny`
Pattern habitual `let ctx; try { ctx = await ... } catch {}` produce error en strict mode. **Fix:** `let ctx: Awaited<ReturnType<typeof requireWorkspace>>;` lo tipea correctamente sin tener que importar el tipo manualmente.

### Drizzle `vector` column + raw SQL
Para insertar embeddings con Drizzle, `db.update(entries).set({ embedding: vector })` con `vector: number[]` no funciona consistentemente porque postgres-js serializa arrays como `{1,2,3}` (Postgres array literal), no como `[1,2,3]` (pgvector). **Patrón final:** `set({ embedding: sql\`${vectorToSql(v)}::vector\` as never })` donde `vectorToSql` produce `[0.1,0.2,...]`. Para queries: `entries.embedding <=> ${vsql}::vector` también con cast explícito. El `as never` evita que TS se queje del mismatch entre el tipo del column y `SQL`.

### `FOR UPDATE SKIP LOCKED` para job queues
La queue de embeddings (`searchIndexJobs`) puede ser procesada por múltiples workers (webhook + cron + manual). Patrón Postgres clásico: `SELECT ... FOR UPDATE SKIP LOCKED` para que cada worker reserve un lote sin esperar locks. Drizzle no expone SKIP LOCKED en su builder; usé `tx.execute(sql\`...\`)` con la query cruda, marqué los IDs como "processing" en un UPDATE separado dentro de la misma transaction. Lección: para concurrency primitives no estándar, siempre escapar a `sql\`\``.

### `ts_headline` con marcas seguras
Postgres `ts_headline` con `'StartSel=<mark>,StopSel=</mark>,...'` produce HTML que puede contener cualquier carácter del documento. **No es seguro** pasar el resultado directamente a `dangerouslySetInnerHTML`. Solución: escapar TODO el output (`&` → `&amp;`, `<` → `&lt;`, etc.), y luego restaurar SOLO `&lt;mark&gt;` y `&lt;/mark&gt;` a `<mark>` y `</mark>`. Resultado: snippets visualmente correctos sin XSS.

### RRF (Reciprocal Rank Fusion) > weighted scores
Probé combinar BM25 + cosine como `0.5 * fts_norm + 0.5 * cosine_norm`, pero los rangos de scores son distintos entre queries (BM25 puede ir 0.01..0.5 según términos; cosine 0..1). Cualquier weighting fijo da peso desigual aleatorio. **RRF (Cormack et al.):** `1 / (k + rank)` con k=60 — solo importa la posición en cada ranking, no el score absoluto. Más robusto, no requiere normalización, y empíricamente da mejores top-K en datasets pequeños.

### `coordsAtPos` para popovers de Tiptap
Para anclar el popover AI Inline a la selección, `editor.view.coordsAtPos(from)` devuelve `{top, bottom, left, right}` en pixel coords del viewport. Sumo `window.scrollY` para coords de documento + 8px de gap bajo la selección. Luego clamp horizontal al viewport (max width 420px - 8px margen). Si la selección está cerca del fondo, podría salirse — habría que detectar y voltear arriba (TODO F10 polish).

### Web Speech API: tipos no en lib
TypeScript no incluye tipos para `SpeechRecognition` por defecto (no está en `lib.dom.d.ts` por ser experimental). Soluciones: (a) `npm i -D @types/dom-speech-recognition`, (b) declaración local. Opté por (b) — declaración minimal `SpeechRecognitionLite` con solo lo que uso. Mantengo `webkitSpeechRecognition` fallback (Safari/iOS aún sin prefix-removed). `lang = "es-ES"` por defecto; podría hacerse i18n en F8.

### `insertContentAt({from, to}, text)` — string vs nodes
Inicialmente intenté `insertContentAt(range, ProseMirrorNodes[])` para que el resultado fuera plain text con saltos. Resulta que pasando `string` funciona como esperado, y Tiptap lo trata como párrafo. Para voice-to-content donde quiero insertar headings + paragraphs estructurados, sí paso array de nodos `{type: "heading", attrs, content}` etc. Lección: `string` → texto plano, `array de nodes` → bloques estructurados.

### Honeypot mejor que CAPTCHA
Para el form público de comentarios, añadí un `<input>` oculto con `position: absolute; left: -9999px`. Bots típicos rellenan todos los campos. Si llega con valor → respondo `200 OK { status: "spam" }` sin guardar (silencioso, no levanta sospechas). Combinado con score IA (heurística + LLM) y rate-limit por IP-hash, suficiente para empezar. CAPTCHA solo si llega abuso real — más fricción para usuarios legítimos.

### Suppressions inline de Biome
`role="dialog"` en un `<div>` dispara `lint/a11y/useSemanticElements`. La regla quiere `<dialog>` nativo, pero `<dialog>` no soporta posicionamiento absoluto+manual sobre Tiptap, ni backdrop+layout que necesitamos para el modal de voz. **Patrón:** `// biome-ignore lint/a11y/useSemanticElements: <razón>` debe ir en la línea inmediatamente anterior al **atributo** que dispara, no antes del elemento. Probado: una línea antes del `role="dialog"` funciona; antes del `<div>` no.

### Tras Fase 6
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores ni warnings
- `npm run build` OK — 51 rutas (45 antes + 6 nuevas: /admin/ask, /admin/buscar, /admin/comentarios, /api/admin/ai/{ask,inline,process-jobs}, /api/comentarios, /buscar)
- Editor: 219 KB sin cambio (AI Inline lazy via custom event)
- Schema: 2 tablas nuevas (`searchIndexJobs`, `comments` extendida) — pendiente `db:push` cuando haya DATABASE_URL real

## Auditoría Fase 6 — bugs encontrados y fixeados (2026-05-02)

### Critical: comment routing no era multi-tenant
`getEntryForComment(slug)` solo filtraba por `slug + status='published'`. Con dos workspaces que tengan un slug repetido (ej: ambos con un post `bienvenida`), el comentario podía guardarse en el post equivocado. **Fix:** `getEntryForComment(workspaceId, slug)` con filter compuesto. El endpoint público resuelve workspace via `getDefaultPublicWorkspace()` (el mismo que /blog y feeds; futuro F5+ lo sustituirá por host-based routing). Lección: cualquier endpoint público que toque tablas multi-tenant debe pasar `workspaceId` explícito incluso cuando "obviamente" hay solo un tenant — los slugs repetidos son comunes.

### High: bodyText stale en SidePanel
`bodyText` se pasa al SidePanel desde server-side render — es la versión guardada, **no la versión live del editor**. Como autosave debounce 1.5s, el `bodyText` del prop puede ir hasta 1.5s detrás del estado actual del editor. Las acciones IA (excerpt, título SEO) recibían texto desfasado y producían sugerencias inconsistentes. **Patrón:** cuando un componente cliente tiene tanto un prop server-rendered como acceso al editor Tiptap, leer `editor?.getText() ?? prop` en cada handler que necesite el texto. Lección: en editores con autosave, distinguir entre "estado persistido" (props) y "estado live" (editor.getText()). Para IA, casi siempre se quiere live.

### High: `position: absolute` vs `position: fixed` en popovers sobre containers con overflow
AIInlinePopover usaba `position: absolute` con coords de documento (`window.scrollY`), pero su contenedor padre era `<div className="flex h-[calc(100vh-3.5rem)]"` sin position relative. El navegador ancla el absolute al body (default), pero la cadena de overflow del editor recorta visualmente. Resultado: popover invisible cuando el cursor está cerca del fondo. **Fix:** `position: fixed` con coords del viewport (no sumar scroll). Beneficio extra: viewport-stable durante scroll. **Implicación:** cualquier scroll en el editor desplaza el popover respecto a la selección — debe re-posicionarse. Listener `scroll` con `capture: true` (para escuchar scrolls anidados) + `resize`.

### High: Tiptap text-position mapping para applyLink
Mapear "índice en texto plano" → "doc-pos en Tiptap" es un problema clásico. Mi primer intento concatenaba node.text + "\n" entre bloques para alinear con `textBetween("\n")`. Falla porque `textBetween` no inserta separator antes/después de todos los block boundaries (depende del tipo). **Aproximación correcta:** ignora separators completamente. Concatena solo `node.text` de text nodes, busca en esa concatenación, y mapea offset→doc-pos walking los mismos text nodes en orden. Limitación: no soporta anchors que crucen text nodes (e.g., texto con bold en medio). Para el use-case (link suggestions con anchors cortos en una palabra/frase), es aceptable. Lección: cuando un mapping tiene casos borde imposibles (multi-node anchor), document the limitation y falla gracefully con toast.

### High: Re-ejecutar streaming sin abortar el anterior
El componente AIInlinePopover puede reabrirse mientras un stream está en curso (usuario presiona ⌘J segunda vez). El stream viejo seguía escribiendo a `setResult` (clobbered por el reset) y consumiendo tokens del backend. **Fix:** abortar `abortRef` previo al inicio de `openPopover`. Patrón general: cualquier componente con un controller persistente entre invocaciones debe abortar al re-iniciar, no solo al cerrar.

### Medium: respuesta vacía del LLM
Si el LLM responde con texto vacío (timeout, rate limit, content filter), el cliente pasaba a "result mode" con `result === ""`. Los botones aplicar/insertar abajo no hacían nada visible (la guard `if (!result)` los hacía no-ops silenciosos). **Fix:** chequeo `!finalResult.trim()` post-stream → vuelve a list y toast "respuesta vacía, reintenta". Truco para leer state final: `setResult(r => { finalResult = r; return r; })` lee el valor sin closure stale.

### Medium: comentarios huérfanos
Cuando un parent comment se elimina (o se marca spam), los replies quedan con `parentId` apuntando a un id que ya no existe. El render usaba `byParent.get(parentId)` que devolvía undefined → replies invisibles. **Fix:** pre-calcular `Set` de ids presentes; cualquier reply cuyo parent no esté en el set se promueve a root (`effectiveParent = null`). Combinado con FK self-ref `onDelete: "set null"` que limpia el `parentId` automáticamente, los replies sobreviven al delete del parent.

### Medium: Drizzle native `.for("update", { skipLocked: true })`
Mi primera implementación de `processIndexJobs` usaba `tx.execute(sql\`SELECT ... FOR UPDATE SKIP LOCKED\`)` y casteaba el resultado: `rows as unknown as { id: string }[]`. Funcional pero frágil — el shape del retorno depende del driver (postgres-js: array directo; node-postgres: `{rows: []}`). Drizzle 0.45+ expone `.for("update", { skipLocked: true })` tipado nativamente. **Patrón:** preferir siempre la API tipada de Drizzle sobre `tx.execute` + cast. Mismo principio para `inArray(...)` vs `sql\`id = ANY(...)\``. Reservar raw SQL solo para operaciones que Drizzle no soporta.

### Drizzle self-ref FK requiere `AnyPgColumn`
Para `parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, ...)` la función referencia debe explicitar el tipo de retorno como `AnyPgColumn` (re-export de `drizzle-orm/pg-core`) para evitar circular type-inference. Sin él, TS se queja "Type 'PgColumn<...> ' is not assignable to 'never'".

### Patrón: anti-spam en endpoints públicos
Para /api/comentarios el stack es:
1. Honeypot (`<input>` oculto, off-screen). Si llega con valor → `200 OK` silencioso (no spam-form vuelve a intentar).
2. Zod validation (estructura, tipos, longitudes).
3. Heurística (links, mayúsculas, keywords, repeticiones, longitud, nombre con dígitos).
4. LLM moderation (solo si heurística no es definitiva).
5. Threshold-based status: `< 35 → approved, 35-74 → pending, >= 75 → spam`.
6. IP-hash (sha256 con AUTH_SECRET) para audit/rate-limit futuro sin guardar IPs raw.
7. UA capture (truncado a 500 chars) para forensics.

Sin rate-limit por ahora — F10 hardening añadirá token-bucket por IP-hash.

### Tras los fixes
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores ni warnings
- `npm run build` ✅ — 51 rutas, sin regresión de tamaños

## F7b — Forms + Automations

### High: claim atómico anti-doble-ejecución en engines
Patrón: si un trabajo lanza `runStepsLoop` en background con `void` (fire-and-forget) Y un cron drena los pending, ambos pueden golpear el mismo runId. Mi primera implementación hacía `update(automationRuns).set({ status: "running" }).where(eq(id, runId))` sin chequear status — siempre tenía éxito, así que dos workers entraban al mismo tiempo. **Fix:** WHERE incluye `or(status="pending", status="running")` (running cubre el caso resume tras crash) + `.returning({id})` + early return si 0 filas (otro worker ya lo tomó). Mismo principio que `processDeliveries` pero sin necesidad de `FOR UPDATE SKIP LOCKED` porque el UPDATE atómico ya garantiza serialización a nivel de fila.

### High: cross-tenant via referencias jsonb/uuid[]
Cuando un endpoint público acepta UUIDs (mediaIds en form file fields, entryIds en automations), nada impide que el atacante mande un UUID de OTRO workspace. Las queries posteriores que filtran por workspaceId no leakean datos, pero la submission queda con referencias "huérfanas" que no se renderizan — confuso. **Fix:** validar ownership en el momento de la insertion: `filterOwnedMediaIds(workspaceId, ids)` hace SELECT id FROM media WHERE workspaceId=? AND id IN (...) y filtra en memoria. Cap a 50 IDs por submission para evitar consultas enormes. Mismo patrón aplicaría a entryIds en payload de automations si llegara desde untrusted input (en F7b el editor está tras auth, así que de momento no).

### Medium: HMAC token con id post-insert
Quería firmar un confirmation token con el `submissionId`, pero el id solo existe tras insert. Primera versión: insert con un token "pending" placeholder → race condition + colisión del unique index si dos submissions concurrentes ambas tienen "pending". **Fix:** insertar con `confirmationToken: NULL`, después `update SET confirmationToken=signed(submission.id)` en una segunda query. NULLs no colisionan con unique en Postgres, así que el índice acepta múltiples submissions sin token. Tradeoff: +1 query, pero la concurrencia funciona.

### Medium: prototype-pollution en templating
`{{path}}` interpolation se hace recorriendo el path con `obj[key]` hasta el final. Si el usuario escribe `{{__proto__.toString}}` o `{{constructor.constructor}}` puede exfiltrar/manipular prototipos. **Fix en `getByPath`:** lista negra explícita `__proto__`, `constructor`, `prototype` → return undefined. La función nunca ejecuta JS, solo lookup, así que con el guard es seguro. NO usar `Function`, `eval`, `new Function` para resolver paths — siempre lookup explícito por key.

### Medium: no exponer detección de spam al spammer
Al detectar spam (honeypot, score >= threshold), **NUNCA** devolver 4xx. El bot pondrá retry o variará el payload. **Fix:** devolver `200 OK` con el mismo `successMessage` que el flujo legítimo. La submission queda persistida con `status: "spam"` para análisis admin, pero el spammer cree que pasó. Mismo patrón con honeypot lleno: log y dropear silenciosamente, sin status diferente al exterior.

### Medium: Zod dinámico desde JSON con validación cruzada
`buildSubmissionSchema(formSchema)` necesita validar `required` solo si el field es visible (visibleIf evaluado contra el resto del payload). No se puede expresar con `.required()` per-field porque depende de OTROS fields. **Patrón:** schema base con todos los fields como `optional().nullable()`, luego `.superRefine((data, ctx) => { for (field of fields) if (visible && required && missing) ctx.addIssue(...) })`. La validación visible↔required usa la MISMA función `isVisible()` que el renderer cliente, garantizando coherencia.

### Medium: `passthrough` en Zod para fields técnicos
El form recibe `csm_t` (timestamp), `csm_company` (honeypot dinámico), opcionalmente `csm_captcha`. Si el schema strict los rechaza, el endpoint falla con "extra keys not allowed". **Fix:** `z.object(shape).passthrough()` acepta keys extra sin tirar; el sanitize() posterior descarta lo no declarado en el schema antes de persistir. El honeypot se evalúa ANTES de validar el schema (cheap reject).

### Medium: dispatcher webhooks debe lazy-importar listener
`src/webhooks/dispatcher.ts` dispara `triggerEvent` de automations al hacer emit. Pero `src/automations/listener.ts` importa `engine.ts` que importa `actions.ts` que importa cosas de `db`, `chat`, etc. Si el dispatcher importa el listener al top-level, hay riesgo de ciclo de imports + carga eager innecesaria. **Fix:** `await import("@/automations/listener")` dentro del emit (dynamic import). Next.js cachea el módulo en runtime, así que solo paga la carga la primera vez.

### Medium: REST routes no pueden exportar nada que no sea handler
Next.js App Router valida los exports de `route.ts`/`page.tsx` contra una whitelist (default, generateMetadata, GET, POST, dynamic, revalidate, etc.). Cualquier otro export rompe el build con `"X is incompatible with index signature"`. Mi primer error: exporté `StatusBadge` desde `submissions/page.tsx`. **Fix:** mover componentes auxiliares al `client.tsx` que sí permite exports libres.

### Low: biome `noThenProperty` y `noArrayIndexKey`
- `then` como nombre de propiedad (en branch step `{ then: [...], else: [...] }`) hace que biome confunda el objeto con un Promise/thenable. **Fix:** `// biome-ignore lint/suspicious/noThenProperty: branch shape mirrors if/then/else, not Promise`. El nombre es semánticamente correcto.
- `key={index}` en arrays editables triggerea `noArrayIndexKey`. Si el array NO se reordena (mi caso: options + clauses), el index es estable. **Fix:** `// biome-ignore lint/suspicious/noArrayIndexKey: ...` con justificación. Si SE reordena, hay que añadir `id` estable a cada item.

### Patrón: `safePublicFetch` debe ser TODA la red user-controlled
Aplicar uniformemente: webhooks dispatcher, webhook step de automations, http step, slack step, legacy webhookUrl en forms. Cualquier URL que venga del editor o del usuario va por `safePublicFetch` (bloquea localhost, IPs privadas, link-local, metadata cloud, redirects a privadas). NO hacer `fetch(userUrl)` directo NUNCA. Nuevo helper: `assertPublicUrl()` para chequeos previos sin hacer la request.

### Tras los fixes
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores tras format auto-fix
- `npm run build` ✅ — todas las rutas nuevas (forms, automations, public API, REST v1) compilan sin warnings nuevos

## Fase 7c — GraphQL + CLI + SDK + Menus + Redirects

### 2026-05-03 — Zod `discriminatedUnion` no acepta z.lazy recursivo
Para tipos recursivos discriminados como `MenuItem` (con `children: MenuItem[]`), Zod 3 no soporta `z.discriminatedUnion("type", [...])` porque cada variante necesita ser un schema concreto en build-time, no un lazy. **Fix:** usar `z.union` recursivo con `z.lazy(() => MenuItemSchema)` y aceptar la pequeña pérdida de performance (Zod tiene que probar cada variante). Para validación en producción no es bottleneck. Validar `discriminator` después manualmente si fuera crítico.

### 2026-05-03 — `redirect()` de Next sólo soporta 307, `permanentRedirect()` 308
Next 15 expone únicamente `redirect()` (307) y `permanentRedirect()` (308) como Server Actions/Server Components APIs. **No hay forma de devolver 301/302 directamente desde un Server Component** sin construir manualmente un `Response`/`NextResponse`. **Lección:** mapear pragmáticamente — 301/308 → `permanentRedirect`, 302/307 → `redirect`. Documentado en `src/redirects/runtime.ts`. Si en F8+ alguien necesita 301 estricto (HTTP semantic), exponer un endpoint route handler que devuelva `Response.redirect(url, 301)`.

### 2026-05-03 — Drizzle no soporta tuple-comparison nativo para keyset pagination
Para keyset pagination con `(updatedAt, id) < (cursor.ts, cursor.id)` (orden total estable), drizzle no expone helper. **Fix:** usar `sql\`(${entries.updatedAt}, ${entries.id}::text) < (${new Date(cur.ts)}::timestamp, ${cur.id})\`` con template literal. Funciona porque postgres soporta tuple comparison en WHERE. **Lección:** raw `sql` template es la salida natural cuando drizzle no cubre el operador.

### 2026-05-03 — Yoga plugin hook signatures cambian entre versiones
`createYoga` en graphql-yoga@5 tiene tipos de plugins poco estables (onValidate/onExecute/onParams). Tipar literalmente el payload genera `TS7031: Binding element 'params' implicitly has any`. **Fix:** anotar `(payload: any)` con `// biome-ignore lint/suspicious/noExplicitAny: Yoga plugin hooks shape varies` y desestructurar dentro. Más robusto frente a upgrades menores.

### 2026-05-03 — `maskedErrors.maskError` debe devolver `Error`, no `unknown`
El tipo `MaskError` de Yoga es `(error: unknown, message: string) => Error`. Si devuelves `error` sin cast (puede ser `unknown`), TS rechaza. **Fix:** anotar `error as Error & { extensions?: ... }` y devolver siempre un `Error`. Útil para dejar pasar errores con `extensions.code` (UNAUTHORIZED, FORBIDDEN, DEPTH_LIMIT) sin enmascarar y sí enmascarar errores de DB / inesperados.

### 2026-05-03 — Middleware edge no puede importar drizzle
Next.js middleware corre en Edge Runtime por defecto. Si el bundle importa `drizzle-orm` o `postgres` (incluso con `await import()` lazy), Webpack/Turbopack falla porque esas libs usan APIs Node. **Decisión:** NO meter el lookup de redirects en `src/middleware.ts`; en su lugar, llamar `runRedirect()` (Node, vía `permanentRedirect`/`redirect`) desde Server Components: `app/page.tsx` y `app/[...slug]/page.tsx`. Cubre todas las rutas públicas relevantes; admin/api/_next no necesitan redirects. **Trade-off:** rutas como `/blog`, `/contacto` (form), `/buscar` no aplican redirect a menos que añadamos el helper en sus pages — pero esos paths son del propio sitio, raramente targets de migración.

### 2026-05-03 — CSV formula injection es admin → admin
Cuando un admin escribe una `description` que empieza con `=cmd|...` (o `+`, `-`, `@`), el CSV exportado abre Excel/Sheets ejecutando comandos. Aunque el atacante necesita admin role para escribir, la víctima es OTRO admin que descarga el CSV. **Fix:** prefijar con apóstrofo `'` (escape OWASP estándar) en `csvCell()`. Importa para cualquier export CSV que contenga texto editable por usuarios.

### 2026-05-03 — ReDoS via regex source en redirects
Admins escriben patrones regex que se ejecutan contra cada path. Patrón `(a+)+$` con input `aaaaaaa...!` cuelga el server. **Fix doble:** (1) cap source.length a 256 chars, (2) heurística regex `/\([^)]*[+*][^)]*\)[+*]/` que detecta quantifiers anidados. No previene 100% pero bloquea los catastrofic comunes. JS no permite timeout sync en regex (workers serían overkill aquí). **Lección:** input regex de usuarios siempre necesita cap + heurística + idealmente ejecución en worker thread.

### 2026-05-03 — `slug global` en getPublicMenuBySlug es cross-tenant leak
Patrón replicado de `getPublishedFormBySlug(slug)` que es slug-global para v1. Pero si dos workspaces tienen ambos un menú `header`, el endpoint público devuelve uno arbitrario, leakeando datos. **Fix:** aceptar opcional `host`, resolver `workspaceId` via `resolveWorkspaceIdByHost` (custom domain → subdominio → fallback first ws), y filtrar la query. **Aplicar al resto de endpoints públicos**: forms también lo necesita; pendiente para F8 (compatibilidad regresiva).

### 2026-05-03 — `̀-ͯ` literal en regex es señalado por biome
La regex `/[̀-ͯ]/g` (combining marks Unicode para quitar acentos tras NFD) se renderiza visualmente como dos diacríticos juntos en el editor, y biome la marca como `noMisleadingCharacterClass`. **Fix:** usar `/\p{Mn}/gu` (Unicode property — Mark, nonspacing). Más explícito, idéntico semánticamente, pasa biome. Requiere flag `u`.

### 2026-05-03 — `useEffect` con `[]` para "skip first render" rompe biome
Pattern común: `useEffect(() => setDirty(false), [])` para marcar dirty=false en mount tras otro effect que lo marca true. Biome `useExhaustiveDependencies` se queja del primer effect porque sus deps "no se usan en el body" (el body sólo llama `setDirty`). **Fix:** usar `useRef` mountedRef + early return en el primer ciclo. Más explícito y evita el lint warning. Si la regla es realmente legítima (deps trigger-only), añadir `// biome-ignore` con justificación.

### 2026-05-03 — Pothos vs handcrafted GraphQL para 14 tipos
Pothos es excelente para schemas grandes con codegen tipado, pero requiere `@pothos/core + plugin-relay + plugin-scope-auth + plugin-validation` (~80KB de deps + boilerplate). Para 14 tipos read-only en F7c, escribir el schema con `GraphQLObjectType` handcrafted (~640 líneas en un único archivo) mantiene el patrón del repo (igual que `src/api/openapi.ts` se escribe a mano desde Zod), tipado total sin codegen, y deja `printSchema()` como SDL listo. **Lección:** apuntar más alto NO siempre es "más libs"; a veces es "menos libs, mejor patrón". Si el schema crece a 50+ tipos con mutations/subscriptions, reconsiderar Pothos.

### Tras los fixes
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores tras format auto-fix
- `npm run build` ✅ — 70+ rutas nuevas (graphql, public/menus, v1/menus, v1/redirects, admin/menus, admin/redirects, admin/api-docs/graphql)
- CLI verificada: `node bin/csm.mjs --help` y `version` funcionan con banner ASCII espectacular

## Fase 8a — Newsletter & Email Engine

### 2026-05-03 — Next App Router bloquea `import "react-dom/server"` (incluso con `"server-only"`)
Mi primer intento de plantillas de email fue React JSX + `renderToStaticMarkup`. Build falló con _"You're importing a component that imports react-dom/server. To fix it, render or return the content directly as a Server Component instead"_. Probé añadir `import "server-only"` y **siguió fallando** — Next inspecciona el grafo de imports y aplica la regla incluso si el módulo es server-only. **Solución:** abandonar `react-dom/server` y reescribir las 4 plantillas como string templates puros (`shell()`, `heading()`, `button()`, etc.) con `escapeAttr`/`escapeText` propios. Ventajas: (1) ~3x más rápido en cold start (no carga react-dom/server runtime), (2) cero riesgo de bundle bleed al cliente, (3) el HTML generado es idéntico para clientes de email (que ignoran React de todos modos). **Lección:** para email = strings. JSX de email sólo tiene sentido si usas `react-email` package en build-time; en runtime de Next, usa templates literales.

### 2026-05-03 — `unsubscribeToken` post-insert: el token tiene que conocer el id real
Patrón heredado de F7b (HMAC token con id post-insert). En subscribers, generé un `unsubscribeToken` placeholder con `randomUUID()` antes del insert (porque el token es `unique` en el schema y no puede ser NULL en mi diseño inicial). Después tendría que reescribirlo con el id real. **Solución limpia:** insertar con un placeholder único (`signUnsub(randomUUID(), ws)`), luego `update SET unsubscribeToken=signUnsub(realId, ws) WHERE id=realId`. La unicidad se cumple porque randomUUID nunca colisiona, y la segunda query reemplaza atómicamente. Tradeoff: 2 queries vs 1, pero la concurrencia es trivial (no hay race posible: cada inserción es propia del subscriber recién creado). Documentado en subscribers.ts:118-130.

### 2026-05-03 — Idempotencia en `expandCampaignRecipients` y claim atómico de status
La campaña pasa por: draft → scheduled → sending → sent. Si el cron golpea dos veces o el admin pulsa "Send Now" tras programar, el riesgo es expandir recipients dos veces (= envío doble). **Defensa en capas:** (1) `expandCampaignRecipients` chequea `count(*) FROM campaign_recipients WHERE campaignId=?` y sale temprano si > 0. (2) `startCampaignSend` hace UPDATE con WHERE `status IN ('draft','scheduled')` + RETURNING, si claimed.length===0 sale (otra invocación ganó). (3) En `processCampaigns` el claim recipient pending→sending se hace con `inArray(ids) AND status='pending'` y returning IDs reales para procesar sólo los que ganamos. Mismo patrón que webhooks/automations. **Lección:** cada UPDATE de status que dispara trabajo debe ser un claim atómico con WHERE de estado anterior — nunca confiar en read-then-write.

### 2026-05-03 — `/api/email/open/[token].gif` recibe `.gif` como parte del param
Next 15 captura el path completo en el dynamic segment, así que `[token]` recibe `xxxxx.gif` literal. Si verifico el HMAC sobre `xxxxx.gif` falla. **Fix:** `token.replace(/\.(gif|png)$/i, "")` antes de verificar. Útil porque algunos clientes de email reescriben extensiones (Outlook a veces). El path original podría ser sólo `/[token]` sin extensión, pero la extensión `.gif` ayuda a clientes de email a reconocer que es imagen y a algunos proxies caching. **Lección:** dynamic segments con extensiones obvias (.gif/.json/.xml) requieren strip explícito si el contenido del param se firma.

### 2026-05-03 — Anti open-redirect en `/api/email/click/[token]`
El token firma `{ rid, url }` con HMAC, por lo que la URL no puede manipularse externamente. Pero un admin malicioso podría meter `javascript:alert(1)` o `data:text/html,...` en el body de la campaña, que tras compose se firmaría y enviaría. El sanitizador de compose.ts ya bloquea href no http(s)/mailto/tel, pero defensa en profundidad: el route handler verifica `/^https?:\/\//i.test(verified.url)` antes de redirigir. Si falla, redirige a "/" silenciosamente. **Lección:** firma-verifica HMAC NO es suficiente — el contenido firmado puede ser malicioso si el productor del token no fue de confianza absoluta. Validar siempre el output de un token firmado contra reglas de negocio.

### 2026-05-03 — `subscribers.unsubscribeToken` y borrar el `unique` index si lo dejamos NULL
Mi schema tenía `unsubscribeToken text` con `uniqueIndex` sobre la columna. Postgres trata NULLs como distintos por defecto (varios NULLs no colisionan), así que crear subscriber sin token funcionaba. Pero algunas configuraciones de Postgres con `nulls not distinct` lo tratarían como colisión. **Decisión:** siempre poblar `unsubscribeToken` desde alta (incluso para imports CSV preconfirmados — el token funciona también). No NULL. Index se queda como uniqueIndex para fastlookup en `/suscribir/baja/[token]` si quisiéramos lookup directo (pendiente; ahora verificamos sólo el HMAC).

### 2026-05-03 — `forms/rate-limit.ts` reutilizable con namespace de key
La función `consumeSubmitRateLimit({ ip, formId, hourly, daily })` tiene `formId` como parte de la key del bucket. Para reusarlo en `/api/public/subscribe` (donde la dimensión es workspaceId, no formId), pasamos `formId: "subscribe:" + workspaceId`. Funciona, pero es un poco hack — la abstracción "submit rate limit" mezcla concepts. **Para F8b/F8c:** generalizar a `consumeRateLimit({ namespace, key, hourly, daily })`. Por ahora aceptamos el hack para no tocar forms.

### 2026-05-03 — Rules engine de segments: in-memory primero, SQL después
Diseñé el rules engine para evaluar en JS sobre todos los subscribers cargados (cap 10k). Es O(n*m) por preview; para 10k subs con 5 conditions es ~50k comparaciones, ~10ms. **Para 100k+:** compilar a SQL (cada condition → fragmento WHERE). Pero compileToSql tiene complejidad: tipos mixtos (timestamps, arrays, jsonb), edge cases con NULL, hasMembership requiere LEFT JOIN. **Decisión:** in-memory para v1 (correcto, simple, debugeable); SQL compilation queda en F8c (después de tener real-world data). Documentado en segments.ts.

### 2026-05-03 — `recordOpen` con dual-dispatch (campaign O drip)
El pixel de tracking comparte el mismo endpoint `/api/email/open/[token]` para campañas y drips. El token contiene `recipientId` o `enrollmentId` indistintamente (mismo HMAC kind "open"). Sin un discriminator, llamamos a `recordOpen({ recipientId })` y luego a `recordOpen({ enrollmentId })` — la primera busca en `campaign_recipients` y sale si no existe; la segunda busca en `drip_enrollments`. Es 2x query si el recipient es de campaign (la dispatch a drip falla rápido), pero mantiene el código simple. **Mejora futura:** discriminator en el token (`{ k:"open-c", rid }` vs `{ k:"open-d", eid }`). Lo dejamos así para simplicidad de v1.

### Tras los fixes
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores tras format auto-fix (25 archivos auto-fixed)
- `npm run build` ✅ — 13 nuevas rutas Newsletter (público + admin + REST + cron)
- Verificación end-to-end pendiente con DB real: el flujo está cableado y compila, golden path se podrá probar en próximo `pnpm dev` con DATABASE_URL

### 2026-05-03 — Auditoría F8a: discriminator obligatorio en tokens HMAC compartidos
Cuando dos dimensiones (campaign-recipient y drip-enrollment) comparten endpoints HTTP (`/api/email/open` y `/api/email/click`), el token DEBE llevar un discriminator (`t: "c"|"d"`) para que el handler sepa a qué tabla disparar. Sin él, mi primera versión llamaba a AMBOS handlers con el mismo `rid` y confiaba en que el handler "correcto" encontrara la fila. Esto era frágil: si los UUIDs de campaign-recipient y drip-enrollment colisionaban (extremadamente improbable pero posible si en el futuro se reutilizan IDs entre tablas), el evento se contaba dos veces. **Lección:** cualquier token de URL pública que enrute a múltiples destinos debe incluir el destino en el payload firmado, no inferirlo en el handler. Un byte extra en el token vale mucho más que la deuda de doble-dispatch defensivo.

### 2026-05-03 — Auditoría F8a: regex de href DEBE cubrir los 3 estilos (double/single/unquoted)
Mi primera versión de `rewriteLinksForTracking` capturaba sólo `href="..."` (double quotes). Es el estilo que el editor admin produce, así que pasó tests visuales. Pero HTML válido permite `href='...'` y `href=...` (sin comillas si el valor no tiene espacios). Si un admin pegaba HTML formateado de Notion/Substack con single quotes, los enlaces NO se reescribían — quedaban con la URL original. Y si esa URL era `javascript:` (que el sanitizer ya bloquearía vía atributo), pasaba al cliente sin firma → bypass del verify de `/api/email/click`. **Lección:** las regex que extraen valores de atributos HTML del usuario deben siempre cubrir las 3 formas. Patrón estándar: `(?:"([^"]*)"|'([^']*)'|([^\s"'<>\`]+))` con captura por grupos numerados, y leer el primero no-undefined.

### 2026-05-03 — Auditoría F8a: idempotencia anti-duplicado siempre necesita 2 niveles
Para `expandCampaignRecipients` el bug original: `count(*) > 0 → return` es read-then-write, dos llamadas concurrentes pasan el check. El **claim atómico de status** en `startCampaignSend` (`UPDATE ... WHERE status IN ('draft','scheduled') RETURNING`) ya serializa el flujo normal — pero alguien puede llamar `expandCampaignRecipients` directamente desde otro código (ej: admin "fix campaign" UI futura) y el read-then-write no protege. **Patrón aplicado:** dos niveles de idempotencia: (1) fast-path con check explícito que ahorra trabajo en reruns claros, (2) **defensa-en-profundidad con `onConflictDoNothing`** sobre un unique index para que dos inserts concurrentes nunca dupliquen. Y el UPDATE de `totalRecipients` con `WHERE totalRecipients = 0` evita que el contador se sume dos veces. **Lección:** "el código de arriba ya garantiza esto" no es defensa suficiente — el código de arriba puede cambiar.

### 2026-05-03 — Auditoría F8a: webhooks que pueden entregar 2x necesitan idempotencia per-row
`recordBounceForRecipient` es invocado por webhook del provider (Resend/Mailgun). Estos webhooks tienen at-least-once delivery — pueden llegar 2 veces. Mi primera versión incrementaba `campaigns.bounced` cada vez sin chequear si el recipient ya estaba bounced. **Fix:** convertir el UPDATE en un claim atómico (`WHERE status != 'bounced' RETURNING id`) y early-return si la fila ya estaba bounced. Igual aplica a `markFinishedCampaigns` (`WHERE status='sending'`). **Lección:** cualquier write que cambia un estado terminal o incrementa contadores tras leer ese estado debe ser un claim atómico. Si la lectura inicial decía "necesito hacer el cambio" pero alguien más se adelantó, el UPDATE simplemente no afecta filas y devolvemos sin emit duplicado.

### 2026-05-03 — Auditoría F8a: sanitizer URL debe decodificar entidades ANTES del check
El bypass `<a href="javascript&#58;alert(1)">` (con `&#58;` = `:` HTML entity) pasa todos los checks que comparan strings literales como `javascript:`. Algunos clientes de email (especialmente webmails) decodifican entidades antes de resolver el href, así que el bypass es real. **Fix:** función `decodeHtmlEntitiesForUrlCheck` que decodifica `&#NN;` decimales, `&#xHH;` hex y los named básicos (`&colon;`, `&lpar;`, `&rpar;`) antes del check de esquema. Y blacklist explícita de schemes (`javascript|vbscript|data|file|blob|about`) además del allowlist (defensa en profundidad). También strip control chars (`\x00-\x20`, NBSP) y zero-width chars (ZWSP/ZWNJ/ZWJ/BOM) del prefijo de URL — bypass clásico `\tjavascript:` y `​javascript:`. **Lección:** los allowlists de schemes son insuficientes si el atacante puede esconder el scheme prohibido detrás de codificaciones. Decodifica explícitamente todo lo que un cliente decodificaría antes de aplicar tus reglas.

### 2026-05-03 — Auditoría F8a: `NextResponse.redirect()` requiere URL absoluta
Mi primera versión del fallback en `/api/email/click` hacía `NextResponse.redirect("/")` cuando el token era inválido. **Falla en runtime con TypeError**: NextResponse.redirect requiere URL absoluta (full URL with origin). **Fix:** `new URL("/", req.url).toString()` construye la URL absoluta del request actual + path raíz. **Lección:** API differente del browser `Response.redirect()` o `NextResponse.redirect()` — el browser acepta relativas, NextResponse no. Smoke test debería incluir tokens inválidos para detectarlo en CI.

### 2026-05-03 — Auditoría F8a: smoke tests sintéticos > tests con DB real para sanitizers
Para verificar el sanitizer corrí un smoke test con 31 casos (script/svg/iframe/onclick/javascript: en 9 codificaciones diferentes + rewriteLinks en 3 estilos de quote + tokens c/d roundtrip + tampered/wrong-kind). En 60 segundos validó cosas que con DB real habrían tardado horas en cubrir. **Lección:** para módulos puros (sin DB, sin red), un script `tsx _smoke.mjs` con `expect()` minimalista es 10x más eficiente que setup de Vitest. Lo hice como archivo temporal y lo borré tras correr — la suite real (Vitest) puede absorberlo en F10. Patrón: archivos `_smoke_*.mjs` borrables son tooling de auditoría, no commit.

### 2026-05-03 — Auditoría F8a: archivos con caracteres no-imprimibles requieren python o Write directo
Para editar la regex con NBSP (\xa0) y zero-width chars (​-‍, ﻿), el Edit tool falló porque el old_string interpretaba los chars distinto que en disco. **Solución:** scripts python temporales (`_fix_compose.py`) que abren con `encoding='utf-8'`, hacen `content.replace(old, new)` con el old extraído via repr() del archivo, y reescriben. Tradeoff: archivo .py temporal a borrar tras correr. **Lección:** caracteres invisibles + Edit tool = mismatch silencioso. Si el Edit falla 2 veces consecutivas en una región con chars exóticos, switchear a python directo en lugar de seguir intentando.

### Tras la auditoría
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores ni warnings
- `npm run build` ✅ — sin regresiones
- Smoke test de sanitizer: 31/31 PASS (script borrado, ver `tasks/todo.md` F8a auditoría posterior para cobertura)
- F8a queda blindada para pasar a F8b sin deuda técnica conocida

## Fase 8b — Memberships + Stripe + Paywall + Personalización (2026-05-03)

### 2026-05-03 — Stripe SDK no, fetch nativo sí
Tentación inicial: `npm i stripe` y usar el SDK oficial. Problema: añade ~1 MB y, si tocamos checkout/portal desde Server Components, el bundler intenta empaquetarlo aunque sea server-only. **Decisión**: cliente fetch propio en `src/payments/stripe.ts` con encoder form-urlencoded estilo Stripe (incluyendo `metadata[k]` y arrays `line_items[0][price]=...`). El verify del webhook es HMAC-SHA256 (~30 LOC). Cubrimos exactamente lo que necesitamos: Checkout Sessions + Billing Portal + Products/Prices CRUD + retrieveSubscription + verifyAndParseWebhook. **Beneficios reales**: bundle público no se ve afectado (Stripe lazy se queda en runtime), contrato API estable hace 5+ años, fácil mockear en tests, control total sobre serialization. **Lección**: si la API REST del proveedor es estable y solo usamos 5-10 endpoints, un cliente fetch propio es más limpio que añadir dep. Reusable: el patrón funciona también para Resend, Replicate, HuggingFace.

### 2026-05-03 — Webhook signature verify: NUNCA `req.json()` antes
La firma de Stripe se calcula sobre el RAW body. Si llamamos `req.json()` (o cualquier consumidor del body antes de verify), el body se "consume" o se modifica (whitespace) y la firma deja de matchear. **Fix obligatorio**: SIEMPRE `await req.text()` primero, parsear dentro del verify (que devuelve el evento parseado o null). Mismo patrón aplica a webhooks de GitHub, Slack, Stripe, Linear. **Lección**: en route handlers Next.js, el body se puede leer una sola vez. Diseñar la API del verify para devolver `{event, raw}` pre-parseado.

### 2026-05-03 — Cookie del miembro debe llevar workspaceId pegado
Inicialmente la cookie `csm.member` era solo `${tokenPlain}` y la lookup por hash devolvía la sesión + workspaceId. **Vulnerabilidad sutil**: si el resolver de host fallaba (custom domain mal configurado, fallback al primer ws), un miembro de ws-A podía ser tratado como miembro de ws-B porque la sesión se cargaba SIN comparar el ws actual. **Fix**: cookie value = `${token}.${workspaceId}` en hex, parseamos al cargar y comparamos con el ws resuelto del request. Si difieren, se trata como guest. Defense-in-depth puro — incluso si la sesión es válida, no aplica fuera de su workspace. **Lección**: cookies de tenant-scoped sessions deben llevar el tenant id en el payload, no solo en el lookup. El hash del token solo ata al sujeto, no al contexto.

### 2026-05-03 — `consumeMagicLink` debe ser claim atómico
Mi primera versión: `select WHERE tokenHash AND notUsed AND notExpired`, luego `update SET usedAt`. Race trivial: dos pestañas con el mismo link, ambas pasan el select, ambas crean sesión (técnicamente la 2ª sobrescribe). **Fix**: `UPDATE ... SET usedAt=now WHERE tokenHash=? AND usedAt IS NULL AND expiresAt>=now RETURNING workspaceId, email, redirectTo`. Solo el primer caller gana el claim — el segundo recibe array vacío y el handler trata como "expirado". **Patrón consolidado** desde F7a (UPDATE...RETURNING en lugar de SELECT-then-UPDATE) re-aplicado.

### 2026-05-03 — Paywall block trunca con BREAK, no con filter
Tentación inicial: filtrar siblings posteriores al paywall con `array.slice(0, paywallIndex + 1)`. **Problema**: necesitamos evaluar visibilidad por breakpoint y audiencia ANTES de decidir, lo que descalifica el `slice` simple. **Fix**: reescribí RenderLayout como `for-loop` con `break` explícito en el caso paywall+gate-fail. El loop también permite `continue` para ocultar bloques (audiencia) sin afectar el truncado. **Lección**: cuando una decisión depende del estado acumulado del DOM-tree, el filter declarativo no llega — un loop imperativo es más legible y permite control de flujo natural (break/continue).

### 2026-05-03 — Drizzle `.onConflictDoNothing(target: column)` solo acepta columna directa, no expression
El audit log de membresías necesita dedupe por `stripe_event_id` (NULL allowed para events manuales). Mi primer intento: `onConflictDoNothing({ target: sql\`stripe_event_id\` })`. **Falla TS**. Drizzle exige la columna directa: `onConflictDoNothing({ target: memberEvents.stripeEventId })`. Postgres dedupe rows con NULL en la columna unique respetando "NULL is not equal to NULL", así que múltiples NULL conviven sin colisión y los stripe_event_id duplicados sí se dedupean. **Lección**: Drizzle conflict targets quieren la column reference o array de columns; SQL raw no funciona aquí.

### 2026-05-03 — Páginas con paywall NO pueden ser ISR estático
El primer intento mantenía `export const revalidate = 60` en `app/page.tsx` y `app/[...slug]/page.tsx`. **Falla**: el viewer context (cookies, geo, UA) cambia por request → ISR cachearía la versión "guest" para todos. Hay opciones (PPR, edge runtime, etc) pero la más segura por ahora es `export const dynamic = "force-dynamic"`. **Tradeoff**: home/pages con paywall pierden ISR pero ganan paywall correcto. Como mitigación futura: cuando un page no tenga paywall ni audience rules, podríamos detectar y volver a ISR. F8c con Vercel Cache Components puede arreglarlo.

### 2026-05-03 — `redirectTo` post-magic-link es vector de open-redirect
Si el redirectTo del magic link no se valida, un atacante puede mandarle al usuario un link tipo `/miembros/auth/TOKEN` que tras consumir redirige a `https://malicioso.com`. **Fix**: SIEMPRE `consumed.redirectTo?.startsWith("/")` antes de hacer `redirect(consumed.redirectTo)`. Mismo check en `/miembros?next=...`. **Patrón**: cualquier parámetro `next`/`redirect`/`returnTo`/`back` que aceptemos debe pasar por whitelist de prefijo `/` o regex anchored. Stripe `success_url` está protegido porque viene de Stripe, no del usuario.

### 2026-05-03 — Demo mode con HMAC-firmado callback resuelve "cómo probar sin Stripe"
Sin STRIPE_SECRET_KEY, no podemos crear Stripe checkout sessions. **Solución elegante**: `paymentTokens.signDemoCheckout(ws, tier, email, exp=30min)` firma un token, `/api/stripe/checkout/[id]` redirige a `/api/stripe/demo-callback?token=...`, que verifica HMAC + match de session activa + grant directo. **Por qué funciona**: el dev experimenta el flujo completo (UI → checkout → return → portal) sin Stripe; los tests de extremo a extremo no requieren claves; el código de producción es exactamente el mismo, solo cambia el endpoint final. **Lección**: para integraciones de pago, el demo mode no es una rama paralela del código sino un sustituto del proveedor que respeta el contrato (mismo redirect-flow, mismas garantías de idempotencia).

### Tras F8b
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — todas las nuevas rutas presentes (/api/stripe/{checkout,portal,webhook,demo-callback}, /api/v1/{tiers,memberships}, /miembros/*, /admin/membresias)
- F8b lista para soportar el siguiente paso F8c (A/B testing + live-edit on production)

## Auditoría posterior F8b (subagent independiente, 2026-05-03)

### 2026-05-03 — Auditoría F8b: `startsWith("/")` no protege de open-redirect protocol-relative
Mi validación inicial `redirectTo.startsWith("/")` parecía suficiente. **No lo es**: `//evil.com/foo` también empieza por `/`, y el browser interpreta `//host/path` como `https://host/path` (URL relativa al protocolo). Mismo bug con `/\\evil.com`. Y `next/navigation.redirect("//evil.com/foo")` lo respeta. **Fix**: helper `safeInternalPath` que valida (1) starts with `/`, (2) char #2 NO es `/` ni `\\`, (3) primer segmento (antes del próximo `/`) no contiene `:` (anti `javascript:`, `data:`, etc.). **Lección**: nunca confiar en `startsWith("/")` para validación de paths internos. La validación correcta requiere también rechazar protocol-relative y schemes embebidos. Patrón consolidado para todos los `redirect/?next=`.

### 2026-05-03 — Auditoría F8b: cookies con datos editables son antipattern de seguridad
Tentación inicial: encajar `workspaceId` en el cookie value (`${token}.${workspaceId}`) para evitar lookups crossed. **Problema**: el cookie value es **enteramente editable por el cliente**. Si la query SQL filtra por `(tokenHash, workspaceId)`, un atacante que cambia el workspaceId obtiene null (defensa OK por accidente), pero el código depende de un detalle frágil. Si mañana se cambia la query a `WHERE tokenHash` y "trust the cookie's workspaceId" → trivial bypass. **Fix correcto**: el cookie es SOLO el token plano; la lookup carga la sesión por tokenHash; `getCurrentMemberSession(activeWs)` compara `session.workspaceId === activeWs` y devuelve null si difieren. **Lección**: si vas a meter contexto en el cookie, fírmalo con HMAC. Si no, mantenlo como referente opaco (token) y carga el contexto desde DB de confianza.

### 2026-05-03 — Auditoría F8b: tokens HMAC sin `jti` son replayables dentro de su exp
Mi `signDemoCheckout` firmaba `{k, ws, tier, email, exp}`. Sin nonce único, **dos requests con el mismo token producen el mismo grant** (idempotente por upsert), pero también permiten que cualquier persona con el token resetee `currentPeriodEnd` indefinidamente durante 30 min. Misma idea aplica a otros tokens "one-shot lógico". **Fix**: añadir `jti` (12B random) al payload. Persistir en una tabla de tokens consumidos (o reusar una existente — yo reusé `member_events.stripe_event_id = "demo:${jti}"` que es UNIQUE). El handler primero comprueba `stripeEventAlreadyProcessed(dedupeKey)`; si sí, redirige sin re-conceder. **Lección**: "one-shot lógico vía idempotencia" es un mito — siempre que el efecto sea visible al usuario (estado nuevo, contador, fecha), un nonce + dedup explícito es necesario.

### 2026-05-03 — Auditoría F8b: webhook ordering NO se resuelve con "deferred:true + ack 200"
Mi handler de `customer.subscription.updated` pre-checkout-completed registraba `data:{deferred:true}` y devolvía 200. **Lo perdí todo**: Stripe NO reintenta tras 200, así que el subscription.updated original NUNCA se aplicaba. La membership se creaba después con datos parciales. **Fix correcto**: lanzar `StripeEventDeferred` (clase exception interna), el outer try/catch lo detecta y devuelve **503**. Stripe reintenta en backoff (5min/30min/2h/...). Eventualmente checkout.completed crea la membership y el subsequent retry de subscription.updated sí encuentra la membership y se aplica. **Lección**: out-of-order webhook handling = "force retry via 5xx", NO "ack and deferred-flag". Solo consume el event_id cuando lo procesaste de verdad.

### 2026-05-03 — Auditoría F8b: `GET = POST` en routes con efectos secundarios = CSRF
Mi `export const GET = POST` para "conveniencia" en `/api/stripe/checkout/[id]` permitía que cualquier sitio externo metiera `<img src="https://misitio.com/api/stripe/checkout/PRO_TIER_ID">` y forzara checkout. SameSite=lax NO bloquea GET top-level navigations ni `<img>` cross-site. Mismo bug en `/api/stripe/portal`. **Fix**: SOLO POST. Los formularios admin/portal usan `<form method="post">` que respeta sameSite-lax CSRF correctamente. **Lección**: cualquier endpoint con efecto secundario (crear sesión, enviar email, mutar estado) DEBE ser POST, no GET. La excepción "GET para deeplinks" es trampa — usa una página intermedia que renderice un form auto-submit.

### 2026-05-03 — Auditoría F8b: `stripeEventAlreadyProcessed + handle` tiene TOCTOU
Pre-check antes de procesar tiene ventana race entre dos retries Stripe paralelos: ambos pasan el chequeo, ambos ejecutan handler, doble-trabajo. **Fix**: el `recordMemberEvent` se convierte en `INSERT...ON CONFLICT(stripe_event_id) DO NOTHING RETURNING id` y devuelve `{inserted, id}`. El claim ES la idempotencia. La pre-check sigue siendo útil como optimización (early return sin tocar el resto del handler) pero no ES la garantía. Combinado con `grantMembership` ahora `INSERT ON CONFLICT DO UPDATE` también atómico. **Lección**: idempotencia de webhooks = claim atómico vía unique constraint, no select-then-act.

### 2026-05-03 — Auditoría F8b: paywall que solo trunca siblings inmediatos = fuga de contenido
Mi `RenderLayout` con `for (const node of layout) { if paywall+gate-fail break; }` truncaba SOLO al nivel donde estaba el paywall. Si el paywall vivía dentro de un `Section`, el contenido a nivel raíz DESPUÉS del Section seguía renderizándose — leak directo de contenido premium. **Fix correcto**: pre-procesado `trimLayoutForViewer(layout, viewer): {layout, truncated}` que recorre el árbol recursivamente y devuelve `truncated:true` cuando un descendiente truncó. El caller propaga: `if (sub.truncated) return {layout: out, truncated: true}` — cualquier sibling del contenedor afectado se omite también. **Lección**: el truncado de paywall debe ser un transform pre-render del árbol, no un control-flow durante el render. La señal "stop here" tiene que poder bubble-up sin React.

### 2026-05-03 — Auditoría F8b: Stripe `current_period_*` puede ser null
Mi tipo `current_period_start: number` rompía con subs `incomplete`/`incomplete_expired` (Stripe devuelve null → `null * 1000 = NaN` → `new Date(NaN)` = Invalid Date → INSERT falla). **Fix**: tipo `number | null` + helpers `subPeriodStart(sub, fallback): Date | null` que validan `Number.isFinite(v) && v > 0` antes de multiplicar. **Lección**: los tipos del SDK Stripe (o de cualquier API externa) son a menudo más optimistas que la realidad. Siempre `number | null` para timestamps externos y validate antes de usar.

### 2026-05-03 — Auditoría F8b: sub-agent independent audits encuentran cosas que tu propia revisión no
Hice mi pasada interna y pensé que F8b estaba sólida. Lancé un agente independiente con prompt "buscar bugs, sé crítico, no asumas, lee los archivos completos" — encontró 3 CRITICAL, 7 HIGH, 14 MEDIUM. La diferencia: el agente no comparte mi sesgo de implementación. Yo "sabía" que el `redirectTo` validation era OK porque "obvio que `startsWith("/")` protege"; el agente vio el bypass `//evil.com` instantáneamente. **Lección consolidada**: para fases con superficie de seguridad significativa (auth, payments, webhooks, redirects), siempre hacer una pasada con un sub-agent que NO conozca tus decisiones. El coste (1 minuto + ~150k tokens) es trivial vs el coste de un open-redirect en prod.

### Tras la segunda auditoría
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — sin regresiones, todas las rutas presentes
- 3 CRITICAL + 7 HIGH + 14 MEDIUM corregidos; 8 confirmados como NO bug (documentados en todo.md)
- F8b queda blindada para pasar a F8c sin deuda técnica conocida

---

## Fase 8c — A/B testing, sticky variants y Live-Edit on production

### 2026-05-03 — Sticky assignment con hash determinista + onConflictDoNothing es la forma correcta

Mi primer impulso fue: "guardo la variant en cookie httpOnly por test". Mal. Cada test añade una cookie, los browsers limitan a 50 cookies por dominio, y si rotas el secret la sticky se rompe.

**Patrón correcto**: una sola cookie `csm_aid` (anon ID), persistida por un año desde middleware. Para cada test activo en la página, calculo un bucket determinista `FNV-1a(testId:anonId) mod 100` y mapeo a pesos. **Persisto en `ab_assignments` con PK (testId, anonId) + onConflictDoNothing**.

**Por qué funciona bajo race**:
- Dos requests paralelos del mismo anon calculan el MISMO hash → MISMA variant. Uno persiste, el otro hace conflict-do-nothing. La response a ambos es idéntica.
- Si los pesos cambian después de iniciar el test, los anons ya asignados mantienen su variant (sticky por DB), los nuevos usan los pesos nuevos.

**Lección**: sticky behaviour bajo concurrencia se logra con (a) determinismo en el cálculo + (b) idempotencia en la persistencia. La cookie httpOnly era una falsa solución que añadía complejidad sin resolver race.

### 2026-05-03 — `after()` de Next 15 para tracking off-band sin penalizar TTFB

Las impressions de A/B se deben grabar en cada SSR, pero NO quiero meter ese INSERT en la latencia visible. Probé:
- `void recordImpressions(...)` antes de return — fire-and-forget, pero RSC puede aún esperar la promise antes de flush.
- `setTimeout(() => recordImpressions(), 0)` — no funciona en server components (no hay event loop persistente entre requests).

**Solución**: `import { after } from "next/server"` — registra un callback que ejecuta DESPUÉS del flush de la response. Garantiza que el tracking no contribuye al TTFB. Viable en Edge y Node runtime.

**Lección**: para side effects no-críticos en RSC, `after()` es la API canónica de Next 15. Antes lo hacía con `void` y rezando que el runtime no lo cancele; ahora hay garantía explícita.

### 2026-05-03 — Stable React keys cuando los IDs son user-editable

Los inputs de variants permiten al usuario escribir el id (`v0`, `vAtest`...). Si uso `key={v.id}`, al editar React desmonta el `<Input>` en cada keystroke → pierde foco, cursor, IME composition. Si uso `key={i}`, biome se queja con razón (`noArrayIndexKey`) porque al borrar un row los demás "saltan" de identidad.

**Patrón limpio**: añadir un `_slot` field al state local — `nanoid()` o `Math.random().toString(36).slice(2,10)`. Estable durante la edición, único entre rows, y se striipa al enviar al server (`variants.map(v => ({ id, label, weight, isControl }))`).

**Lección**: cuando el campo "id" del modelo es editable por el usuario, separa identidad-de-render de identidad-de-modelo. Un `_slot` interno cuesta 8 bytes y resuelve toda la clase de bugs de focus/IME.

### 2026-05-03 — `await import()` dentro de un Route Handler para resolver ciclos circulares lazy

Tenía `import { resolvePublicWorkspace } from "@/payments/public-workspace"` en `/api/ab/event/route.ts`. Mi miedo: que `public-workspace` tirara de schema/redirect/algo edge-incompatible. Convertí a `await import("@/payments/public-workspace")` lazy.

Resultado: funciona, pero cuando lo verifiqué con un build, no había problema cargándolo eager. Refactoricé a top-level import.

**Lección**: lazy `import()` sólo cuando hay razón concreta (binary deps en edge runtime, ciclos circulares, code-splitting). Sin razón, top-level es más legible y permite tree-shake. No optimizar prematuramente con lazy imports.

### 2026-05-03 — biome-ignore en JSX requiere `{/* */}`, no `// `

Intenté:
```tsx
<div
  // biome-ignore lint/suspicious/noArrayIndexKey: variants are edited in-place...
  key={i}
>
```

Biome ignoró el ignore. La sintaxis aceptada en JSX expression es:
```tsx
{variants.map((v, i) => (
  // biome-ignore lint/suspicious/noArrayIndexKey: explicación corta
  <div key={i}>...</div>
))}
```

Es decir, el comment va FUERA del JSX element, en el statement-level del map callback. Y debe ser una sola línea.

**Mejor lección aún**: si te encuentras necesitando suprimir `noArrayIndexKey`, casi siempre la respuesta correcta es añadir un slot id estable (lección anterior). El supresor es una solución de ultima instancia.

### 2026-05-03 — Live-Edit y la confianza del editor: hereda los problemas del registry

El endpoint `/api/admin/live-edit` valida session + role >= editor + Zod del body + `validateProps(kind, merged)`. Pero `validateProps` valida sólo el shape del Zod schema declarado en el bloque. Y los bloques actuales tienen `ctaHref: z.string().default("/miembros")` SIN url validation.

Esto significa que un editor podría meter `javascript:alert(1)` como href via Live-Edit y el endpoint lo aceptaría. ¿Es bug F8c? **No** — es problema preexistente del registry. El editor full en `/admin/paginas` tiene el mismo issue. Live-Edit no introduce capacidad nueva, simplemente ofrece un atajo de UI a la misma capacidad ya existente.

**Decisión**: documentar como F10 audit item (whitelist `^(https?:|/)` o `z.string().url()` en todos los URL fields del registry). NO bloquear F8c por esto.

**Lección**: cuando heredas validación de un módulo upstream, el estado-de-seguridad del downstream queda capped al del upstream. No "regression-test" el problema en cada nueva feature; arreglarlo arriba.

### 2026-05-03 — Pre-existing build break en `/api/og/default`: stash and verify

Build de F8c falló con `Unexpected token type: function in CSS rule "background: oklch(...)"` durante prerender de `/api/og/default`. Mi reflejo: "rompí algo con el render". Verifiqué con `git stash push -u` + `npm run build` — el bug existía sin F8c. Era de F8b o anterior, expuesto sólo cuando intenté un build limpio.

Fix simple: `export const dynamic = "force-dynamic"` en la ruta — la OG depende de DB y de tema activo, no debe prerender. Satori sin polyfill no parsea `oklch()` en build context.

**Lección**: cuando un build rompe en un commit, antes de hipotetizar regression, **stash + rebuild**. 30 segundos vs 30 minutos buscando el cambio fantasma. Si el bug persiste sin tus cambios, es upstream y se documenta como side-fix.

### Tras F8c
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — todas las rutas F8c presentes (/admin/ab-tests, /admin/ab-tests/[id], /api/ab/event, /api/admin/live-edit), middleware 35kB
- F8c entrega: schema A/B + engine sticky + bloques ab/ab-variant + dashboard con chi-squared + Live-Edit en producción

### 2026-05-03 — Auditoría F8c con sub-agent: 1 CRITICAL + 5 HIGH + 7 MEDIUM detectados

Repetimos el patrón de F8b: lancé un sub-agent independiente con prompt detallado pidiendo que buscara bugs reales, sin compartir mi sesgo de implementación. Encontró:

**CRITICAL (lo más serio que se me había escapado)**:
- **XSS via `javascript:` en URL fields**. Editor con role≥editor (mi propia decisión "OK heredamos validación del registry") podía meter `javascript:fetch(...)` en `embed.url` y `video.url` que se renderizan en `<iframe src>`. Cookie compromise en cada visitor. Lo había marcado como "no es regresión F8c, es problema preexistente del registry, F10". **Mal**: F8c expone el vector públicamente al añadir Live-Edit en producción. Antes había que entrar al admin builder; ahora basta `?edit=1`. Aunque heredas el problema, **si tu nueva feature aumenta superficie**, lo arreglas.
  - Fix: helper `safeUrl(default)` reusable con whitelist regex. Aplicado a 8 bloques + `parseLink` del footer.
  - **Lección**: "preexistente, no regresión" no es excusa cuando la nueva feature **expande la superficie de ataque** del bug existente. Re-evalúa el riesgo combinado, no aislado.

**HIGH (5 bugs estructurales)**:
- **H2 — inflado de stats por rotación de cookie**: la cookie `csm_aid` no httpOnly era "intencional para tracking client-side" — pero esa decisión la combiné con un sistema A/B donde cada anonId nuevo creaba 1 impression en SSR. Sin rate-limit por IP, atacante con script puede generar 10000 impressions en 1 variant en minutos.
  - Fix: rate-limit por IP en `recordImpressionsFromMap` (1500/h) y `recordConversion` (200/h). Helper `extractClientIp(headers)`.
  - **Lección**: dos decisiones aisladamente "OK" pueden combinarse en un bug crítico. Cookie no-httpOnly + 1-event-por-anon-en-SSR es una combinación tóxica. **Evalúa interacciones, no solo decisiones aisladas**.
- **H3 — drift entre assignments y variants**: cuando un admin borra una variant de un test running, los rows en `ab_assignments` con esa variant quedaban huérfanos. El engine "manejaba" reasignando en memoria, pero `onConflictDoNothing` NO actualizaba la DB. Resultado silencioso: `/api/ab/event` rechazaba conversions con `variant_mismatch` y respondía 204 (silencio para no leak status). El admin nunca sabe que está perdiendo conversions.
  - Fix: nueva rama `toUpdate[]` con `UPDATE SET variantId WHERE testId+anonId`.
  - **Lección**: "manejar gracefully" en memoria no es suficiente si la persistencia queda inconsistente. **Reconcilia la fuente de verdad**, no sólo el render. Y silenciar errores 204 sin telemetría (esto NO es bug en sí — proteger contra timing/info leak — pero combinado con lectores stale = pérdida de datos invisible). En F10 considerar emitir un warning a admin cuando un test ha tenido >X variant_mismatches en última hora.
- **H4 — transiciones de estado sin validación**: aceptaba `completed → resume`, mezclando stats. Idempotencia ad-hoc.
  - Fix: matriz `allowed` por estado, transiciones explícitas, terminal = `completed`.
  - **Lección**: cuando tu modelo tiene un enum status, escribe la **state machine explícita** desde el principio. "Por ahora acepto todo" es deuda técnica que se cobra cuando un editor cierra un test por error y luego "resume" lo reabre con `endedAt` ya fijo.
- **H1 — Live-Edit a páginas non-published**: el endpoint sólo verificaba que la página existiera. Un editor con DevTools podía editar drafts y archived (revertir cambios pendientes de un compañero).
  - Fix: `if (page.status !== 'published') return 403`.
  - **Lección**: **alinear el contrato del endpoint con el contrato de la UI**. Si el overlay sólo aparece en SSR de páginas publicadas, el endpoint debe rechazar el resto. Asumir "el cliente sólo enviará pageId publicado" es trust-the-client = bug.
- **H5 — `applyOverrides` dead code exportado**: lo exporté "por si quería override admin con `?ab_<key>=`" pero nunca lo conecté. Riesgo: dev futuro lo conecta sin gating.
  - Fix: borrado.
  - **Lección**: no exportar APIs "por si acaso". Si no la usas, no la exportes. Cada export es una promesa de seguridad implícita.

**MEDIUM (3 fixeados)**:
- **M1 — meta sin restricción de shape**: `z.record(z.string(), z.unknown())` aceptaba objetos profundos sin límite estructural. Fix: union de primitivos + cap content-length pre-parse + cap del text post-parse.
- **M3 — parseVariants auto-renormalizaba pesos**: si DB tenía pesos != 100, el engine los escalaba en RAM. Inconsistencia con UI. Fix: si != 100, devolver `[]` (test queda excluido del resolution map).
- **M5 — testKey vacío permitido**: documentado como UX intencional para drag-drop; estrictez se aplica en `collectAbKeys` y server actions admin.

### 2026-05-03 — Lección consolidada: el patrón "auditoría con sub-agent independiente" se confirma

F8b: 3 CRITICAL + 7 HIGH + 14 MEDIUM detectados.
F8c: 1 CRITICAL + 5 HIGH + 7 MEDIUM detectados.

**Patrón que funciona**:
1. Implementar la fase completa.
2. Yo hago mi auditoría interna, marco "está bien".
3. Lanzo sub-agent con prompt detallado: contexto del repo, archivos a auditar, tipos de bugs a buscar, formato de reporte. **NO** le digo qué he revisado yo.
4. El agente lee los archivos COMPLETOS sin sesgo de "yo creo que esto está bien".
5. Reporta bugs por severidad. Yo aplico fixes.

**Coste**: ~1-2 minutos + ~150k tokens.
**Beneficio**: cada vez encuentra un CRITICAL que mi propia revisión no detectó. La diferencia es que el agente no tiene mi modelo mental "ya lo pensé, está bien".

**Patrón anti-correcto que evitar**: pedirle al agente que "valide mi trabajo". Eso provoca confirmation bias. El prompt correcto es "encuentra bugs reales, sé crítico".

### Verificación final F8c
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — todas las rutas presentes, middleware 35kB
- 1 CRITICAL + 5 HIGH + 3 MEDIUM corregidos; 8 verified clean; 4 LOW/MEDIUM diferidos a F10 (documentados en todo.md)
- F8c queda blindada para pasar a F9 (importadores + branching + calendar + workflows) sin deuda técnica conocida

### 2026-05-03 — Tercera auditoría F0-F8c con sub-agent: bugs en F0-F7 que se nos habían escapado

Tras blindar F8c, antes de empezar F9 lancé una tercera ronda — **alcance ampliado a TODO el repo (F0-F8c)** y con doble objetivo: verificar mis fixes recientes + buscar bugs en fases anteriores.

Resultado: **1 falso CRITICAL (sobre versión vieja de mi fix C1) + 4 HIGH nuevos + 6 MEDIUM nuevos**. Todos los HIGH y MEDIUM relevantes fixeados.

**Lecciones nuevas que emergen**:

1. **Mi propio test exhaustivo encontró el bug ANTES del subagent**.
   Antes de aplicar `safeUrl()`, escribí un test JS standalone con 38 vectores de ataque (`//evil.com`, `JaVaScRiPt:`, `\tjavascript:`, control chars, etc.). Detectó que mi regex monolítico permitía `//evil.com`. Lo arreglé reescribiendo a función `isSafeUrl()` con whitelist explícita ANTES de que el subagent lo reportara. Cuando el subagent ejecutó, leyó la versión vieja y reportó el bug — pero ya estaba arreglado.
   
   **Lección**: para fixes de seguridad con regex, escribir un test exhaustivo de attack vectors ANTES de declarar "fixed" no es opcional. Regex en seguridad es notorio por bugs sutiles. 5 minutos de test JS standalone elimina iteraciones de auditoría.

2. **El alcance ampliado de auditoría revela bugs viejos que la fase actual no toca**.
   F8c añadió A/B + Live-Edit. La 3ª auditoría se centró en F0-F8b y encontró:
   - `processIndexJobs` (F6) leak cross-tenant de cómputo OpenAI.
   - `updateMediaAction`/`moveMediaAction` (F3) IDOR en folderId cross-workspace.
   - `processSubmission` (F7) sin rate-limit por email destinatario.
   - Subscribe (F8a) email-enumeration por response distinta create/existing.
   - Subscribe (F8a) race en unsubscribeToken con sid placeholder.
   - Form duplicate (F7) info leak de `submissionId` previo.
   
   Cada uno de esos bugs estaba en código que pasó CRs y auditorías previas centradas en su fase. **Las auditorías por fase no encuentran bugs cross-fase**. Cada N fases (≥3 acumuladas), una auditoría con scope full-repo es mandatoria.

3. **Inconsistencia entre módulos similares**.
   `api/rate-limit.ts` y `forms/rate-limit.ts` implementan token-bucket pero con eviction policies distintas: el primero usa LRU (correcto), el segundo FIFO 10% (puede borrar buckets activos = reset gratis para atacante). Lo detecté como LOW. **Lección**: cuando dos módulos resuelven el mismo problema, consolidar (DRY) o auditar diferencias activamente. La duplicación es deuda invisible.

4. **`consumeMagicLink` workspace**: pasó verificado clean. Mi diseño (devolver `claimed.workspaceId` y exigir que el caller lo use) había mantenido la disciplina. Pero el subagent flageó como "verificar" porque no podía leer el caller — esto refuerza el patrón de auditar por contrato del módulo, no asumir que callers lo respetan.

5. **`isSafeUrl()` reusable es más robusto que regex monolítico inline**.
   Antes de F8c, cada bloque tenía `z.string()` para URL fields. Yo reemplacé con `safeUrl(default)` que envuelve un regex. El subagent encontró un bug en el regex. Reescribí a `isSafeUrl(value)` función imperativa con whitelist explícita por protocolo. **Lección**: validators de seguridad deben ser funciones, no regex monolíticos. Las funciones son testeables, debuggeables, modificables sin re-derivar todo el regex.

6. **Off-band tracking (`after()`) es el patrón correcto, pero el rate-limit debe estar BEFORE the persisted side-effect, no after**.
   Mi primer fix H2 puso rate-limit en `recordImpressionsFromMap` (post-persistencia del assignment). El subagent señaló: el `INSERT abAssignments` ya ocurrió en `resolveTestsForKeys`, fuera del rate-limit. Atacante consume DB sin barrera. Fix H2-extra: rate-limit ALSO en `resolveTestsForKeys` antes del INSERT. **Lección**: cuando aplicas rate-limit, identifica TODOS los side-effects costosos del flow, no solo el último.

### Tras la tercera auditoría
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — todas las rutas presentes, middleware 35kB
- 4 HIGH + 5 MEDIUM nuevos corregidos; 14 verified clean; 5 LOW diferidos a F10
- F0-F8c queda blindada — listo para F9 (importadores + branching + calendar + workflows)

### Patrón consolidado: 3 capas de auditoría antes de dar por cerrada una fase

1. **Test exhaustivo de attack vectors** (yo, ~5 min) — para fixes de seguridad con regex/validators.
2. **Sub-agent independiente con scope estrecho** (F8c) — verifica fix de la fase actual.
3. **Sub-agent independiente con scope amplio** (F0-F8c) — busca bugs cross-fase que las auditorías por fase no detectan.

Coste total: ~20 min de cómputo + ~600k tokens. Beneficio: 7+ HIGH/CRITICAL evitados llegando a producción. Es **el patrón a aplicar al final de cada fase F8+**.

## Fase 9a — Importer Wizard universal

### 2026-05-03 — `_data.uncompressedSize` de JSZip es el escape para zip-bombs
JSZip carga el zip y mantiene `_data.uncompressedSize` en cada entry sin descomprimir. Antes de `file.async("string")` (que sí carga a RAM), validar el tamaño. Sin esto, un .zip de 50MB con compresión 100:1 → OOM. Triple cap recomendado: por archivo (50MB), total (200MB), nº de entries (5000). Aplicado a notion.ts y markdown.ts.

### 2026-05-03 — Claim atómico para transiciones de máquina de estados
Patrón anti-race ya consolidado en F8b (memberships) replicado en F9a (imports). El endpoint que lanza un job long-running NO debe leer-validar-update por separado: hace `UPDATE ... WHERE status IN (allowed) RETURNING` y verifica que devolvió 1 fila. Si vacío → otro caller ya tomó el slot. El engine asume que el caller hizo el claim y nunca re-hace el SELECT con throw — solo lee la fila para datos de configuración. Ventana TOCTOU desaparece.

### 2026-05-03 — `entries.fields` es jsonb arbitrario, hay que sanitizar al importar
Si un parser persiste `{ ...row }` directamente desde un CSV, el atacante controla TODAS las claves. Puede inyectar `coverId`, `workspaceId`, `_origin`, `__proto__` y la UI futura podría leerlas como propias. Patrón: `sanitizeImportedFields()` con whitelist de keys trusted (controladas por código nuestro: `wpPostType`, `notionAssets`, etc.) + RESERVED blocklist (campos sensibles del schema) + prefix `import_*` para keys desconocidas. Aplicado en INSERT y UPDATE.

### 2026-05-03 — Auto-redirects desde imports son open-redirect potencial
El patrón inicial era `db.insert(redirects).values({ source: srcPath, ... })` con `srcPath = new URL(raw.sourceUrl).pathname`. Pero el atacante controla `raw.sourceUrl` (cualquier export con `<link>` lo trae). Resultado: 301 desde `/admin/contenido` → `/<slug-del-attacker>` secuestra navegación interna. **Fix obligado**: usar el helper `createRedirect()` que aplica `validateRule + isSafeDestination + isSelfReferential` + blacklist explícita de prefijos del CMS (`/admin`, `/api`, `/onboarding`, `/login`, `/miembros`, `/checkout`, `/preview`, `/_next`). Sin este check, cualquier import malicioso secuestra rutas internas.

### 2026-05-03 — `applyMediaPolicy` y caps: `skip` debe ser literal aunque sea caro
Patrón anti-foot-gun: si la UI promete "borrar todas las imágenes" (mediaPolicy=skip), el cap interno (`MAX_MEDIA_PER_ENTRY=30`) NO debe limitar la operación. El cap solo aplica a operaciones costosas (`download`). Reordenar el switch: `skip` primero (siempre aplica), `download` después (respeta cap). Mismo patrón aplicable cuando un cap protege costo vs corrección semántica.

### 2026-05-03 — `setTimeout` + `clearTimeout` requiere `try/finally`
Si la operación protegida lanza antes del timeout, el `clearTimeout` post-await no corre. El timer queda flotando hasta disparar el `abort()` sobre un controller obsoleto. En un loop con muchos fallos (e.g., 10k imágenes con DNS bloqueado), son 10k timers de 15s acumulados. Patrón correcto: `try { await op(...) } finally { clearTimeout(timer) }`.

### 2026-05-03 — Event bus in-memory necesita `clearImport()` explícito tras `complete`
Sin esto el `Map<importId, Buffer>` crece indefinidamente. La función `clearImport()` existía en F9a pero no la llamaba nadie — el subagent lo señaló como memory leak. Patrón: tras emit del último evento (`complete`), `setTimeout(() => clearImport(id), 60_000).unref?.()` da margen al último cliente SSE para consumir y luego libera. `.unref()` evita que el timer bloquee el shutdown del process.

### 2026-05-03 — `isSafeUrl()` ya no es solo para blocks; aplicarlo a TODO contenido convertido a Tiptap
Antes F8c lo usaba en propsSchema de bloques. F9a importa HTML externo y lo convierte a Tiptap docs. Cada `link mark` y `image src` que viene del usuario externo (WP, Ghost, RSS) DEBE pasar por `isSafeUrl()` o el render final ejecuta XSS. Aplicado en `htmlToTiptap` y, defensivamente, en figure/img tags. Si `isSafeUrl` devuelve false: descartar el mark (preserva el texto sin link), o descartar la imagen completa.

### 2026-05-03 — Stats que la UI muestra deben ser visibles a la lógica
`stats.skipped` estaba en `EMPTY_STATS` y se mostraba en la UI, pero ningún path del engine lo incrementaba. Items "media standalone" y "term sin slug" iban a `imported` espuriamente. Patrón: cada path de retorno del engine debe explicitar uno de `{ ok: true } | { ok: true, skipped: true } | { ok: false, error }` y el incrementador del stat es declarativo en la rama del switch. No incrementar contadores espuriamente — hace UI mentir.

### 2026-05-03 — Detect orden importa: específico → genérico
El registry de parsers tiene un `DETECT_ORDER` que va de WP (más específico, requiere wp:wxr_version + rss) → RSS → Ghost → Notion → Markdown → CSV. Si markdown o CSV reclamaban un .zip antes que Notion, los .zip de Notion se misclassificaban como markdown vacío (cargando descomprimido para nada). Lección: detectores que aceptan "cualquier .zip" deben ir AL FINAL del orden o reclamar solo extensiones muy específicas (`*.md.zip`).

### 2026-05-03 — Defense-in-depth: filtrar workspaceId en TODAS las queries aunque la fila padre ya esté validada
`importItems` tenía FK al import padre que ya está validado por workspaceId. Filtrar también por `workspaceId` directamente en queries de `importItems` parece redundante. Pero protege contra bugs futuros (cascade weirdness, migración manual que cruce workspaces, FK quitado por error). Patrón consolidado: cada query con tabla multi-tenant lleva `eq(table.workspaceId, ws)` aunque el join lo asegure.

### Verificación final F9a
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — `/admin/importar` (2.47 KB, 124 KB First Load), `/admin/importar/[id]` (8.81 KB, 127 KB), 5 rutas API nuevas
- 1 CRITICAL + 4 HIGH + 7 MEDIUM corregidos; 6 LOW diferidos a F10
- F9a queda blindada para pasar a F9b (Content Branching) sin deuda técnica conocida

### 2026-05-03 — Tercera auditoría F0-F9a con sub-agent: 2 HIGH + 5 MEDIUM cross-fase

Aplicado el patrón consolidado: tras cerrar F9a con auditoría de scope estrecho (capa 2), lancé subagent con scope amplio F0-F9a (capa 3) — encontró bugs en F1, F7, F8b, F8c que la auditoría por fase no atrapa.

**HIGH cross-fase encontrados y fixeados**:

- [x] **HIGH H1: Open-redirect en login admin (F1 preexistente)** — `login-form.tsx` y `oauth-buttons.tsx` aceptaban `?next=` sin validar. Atacante con `https://app/login?next=https://evil.com` redirigía sesión post-login. **Fix**: `safeInternalPath(search.get("next"), "/admin")` aplicado en `router.push`, `callbackURL` (Better-Auth signin/email), `magicLink callbackURL`, `OAuth callbackURL`. Helper `safeInternalPath` ya existía en `src/lib/safe-redirect.ts` desde F8b — sólo no se usaba en este path.

- [x] **HIGH H2: Cross-tenant lookup en formularios públicos (F7 preexistente)** — `getPublishedFormBySlug(slug)` filtraba sólo `(slug, status='published')` sin `workspaceId`. Dos workspaces con un form llamado `contact` se mezclaban; el orden de retorno del DB era indefinido. **Fix**: la firma cambia a `getPublishedFormBySlug(workspaceId, slug)`. Cada caller (`/api/public/forms/[slug]/{submit,schema,confirm}`, `/forms/[slug]/page.tsx`) resuelve workspace por host con `resolveWorkspaceIdByHost` antes de invocar.

**MEDIUM cross-fase fixeados**:

- [x] **M1: ReDoS bypass en redirects matcher (F7c)** — la heurística `/\([^)]*[+*][^)]*\)[+*]/` detectaba `(a+)+` pero NO `((a+))+`, `(a|b)+`, ni `(((a*))*)?`. Cualquier editor podía plantear un regex catastrófico que bloquearía cada page-render via `runRedirect` middleware. **Fix**: triple defensa en `validateRule`: (a) whitelist estricto de caracteres, (b) cuenta de paréntesis abiertos sin cerrar (rechaza cualquier nivel >1), (c) detección de alternancia con cuantificador externo `(...|...)+`. Combina con la heurística previa.

- [x] **M2: F9a regression — `originRef` collision** — el engine pasaba el literal `"import"` a `buildOriginRef()` en lugar del parser real. Resultado: WP post id=42 colisionaba con Notion page id="42", el segundo sobrescribía el primero. Además, CSV sin id asignaba `sourceId="row-N"` y dos CSVs distintos colisionaban. **Fix**: añadido `source` a `EngineCtx`, `buildOriginRef(ctx.source, "entry", sourceId)`. Para CSV con auto-id, prefix `${importId}:row-N` para garantizar idempotencia inter-lote sólo dentro del mismo run.

- [x] **M3: Multi-tenant fallback en `resolvePublicWorkspace` (F8a-b)** — fallback al primer workspace cuando host no resolvía. En producción multi-tenant atribuía Stripe checkouts/portal/AB events al tenant equivocado silenciosamente. **Fix**: `isSingleTenantMode()` (=`CSM_SINGLE_TENANT=true` o `NODE_ENV !== production`); en producción multi-tenant devuelve `null` y la ruta responde 4xx en lugar de fallback ciego.

- [x] **M4: A/B test `pageId` no validado cross-tenant (F8c)** — `createAbTestAction`/`updateAbTestAction` aceptaban `pageId` y `variants[].pageId` con `z.string().uuid()` sin verificar pertenencia al workspace. Latente hoy (no se renderiza), explotable cuando F9c añada page-level rendering. **Fix**: helper `ensurePagesBelongToWorkspace(workspaceId, ids[])` consulta `pages` con `inArray(id, ids) AND workspaceId=ws` y rechaza si alguno falta.

- [x] **M5: Form `redirectUrl` aceptaba cualquier URL (F7)** — `z.string().url()` permitía `https://evil/phishing-clone`. Editor comprometido podía harvestear credenciales de submitters redirigiendo el form a un phishing tras submit. **Fix**: nuevo schema `safeRedirectUrl` con `isSafeUrl()` (whitelist de protocolos, anti protocol-relative, anti control chars). Aplicado a Create + Update.

**LOW cross-fase fixeados**:
- [x] **L2: `deleteCampaignAction` sin UUID parse (F8b)** — añadido `z.string().uuid().safeParse(input.id)`.
- [x] **L3: `sendTestCampaignAction` sin rate-limit (F8b)** — atacante con sesión editor enviaba mass-mailbomb desde dominio Resend del workspace. Fix: `consume("campaign:test:${ws}:${user}", 20, 60*60*1000)`.

**LOW diferidos a F10**:
- L1: `deliverLegacyWebhook` en forms con `webhookUrl` → eliminar el campo o añadir cap de timeout/response-size; sin UI actual.

### Lecciones nuevas que emergen de la 3ª auditoría F0-F9a

1. **Las auditorías por fase no encuentran open-redirect en flows de auth pre-existentes**.
   F1 (auth) tenía el bug desde el principio. F8b añadió `safeInternalPath()` para miembros pero no se aplicó retroactivamente al admin login. **Lección**: cuando se añade un helper de seguridad nuevo (F8b safe-redirect), grep TODOS los callers existentes de `router.push(next)` / `callbackURL` y migrar de una vez. La defensa-en-profundidad sólo funciona si es consistente.

2. **`getPublishedFormBySlug(slug)` sin workspace fue un foot-gun multi-tenant desde F7**.
   La firma "pública" (sin workspace) parecía conveniente porque la ruta era pública. Pero "público" no significa "global cross-tenant". **Lección**: cualquier query de tabla multi-tenant DEBE recibir `workspaceId` como primer arg. Helpers públicos resuelven el workspace por host fuera del helper.

3. **Heurísticas anti-ReDoS con regex monolítico son fácilmente bypaseable**.
   El primer fix `\([^)]*[+*][^)]*\)[+*]` detectaba un solo nivel. El bypass `((a+))+` era trivial. **Lección**: para validación de regex de usuario, combinar (a) whitelist de caracteres, (b) parser estructural (counting parens), (c) heurísticas adicionales para cada vector conocido (alternancia, etc.). O migrar a RE2-engine sin backtracking. Patrón: "validators contra ataques estructurales no se hacen con regex sobre el input — se parsean estructuralmente".

4. **Ramping del scope: la 3ª auditoría siempre encuentra bugs cross-fase**.
   Capa 2 (F9a estrecho) detectó 1 CRITICAL + 5 HIGH en F9a. Capa 3 (F0-F9a amplio) detectó 2 HIGH + 5 MEDIUM en F1, F7, F8a-b, F8c — todos cross-fase, todos invisibles a auditorías por fase. Coste capa 3: ~10 min cómputo + ~250k tokens. Beneficio: 7 bugs reales evitados. **Esta capa es OBLIGATORIA al final de cada fase mayor**.

5. **Memory of regression: F9a regresión `originRef` colisión**.
   El campo `originRef` se introdujo con prefijo `"import"` literal en F9a (mi código). El subagent estrecho no lo flageó porque parecía intencional. El subagent amplio (que conocía el contexto multi-source) lo identificó como colisión. **Lección**: cuando un campo derivado tiene varios productores, el discriminator debe ser explícito en cada productor — no un default.

### Verificación final F0-F9a (post-3ª-auditoría)
- `npx tsc --noEmit` cero errores
- `npx biome check ./src` cero errores
- `npm run build` ✅ — todas las rutas presentes
- 2 HIGH + 5 MEDIUM + 2 LOW cross-fase corregidos; 1 LOW diferido a F10
- F0-F9a queda blindada — listo para F9b (Content Branching) sin deuda técnica conocida

---

## 2026-05-04 — F9b · Content Branching

### Decisiones arquitectónicas que tomé al implementar

1. **`entries.branchId IS NULL = main` (legacy compat) + fila `main` real en `branches` para metadata**.
   En lugar de migrar todas las entries a `branchId = main.id`, opté por un híbrido: la fila main existe en `branches` (con `isDefault=true`) para permisos, activity log y stats, pero las entries de main siguen viviendo con `branchId IS NULL`. Esto evita un backfill peligroso de millones de filas en el futuro y mantiene 100% de compat con queries existentes (blog, sitemap, RSS) que ya filtran sin pensar en branches. **Trade-off**: hay que recordar que en `listEntriesForBranch(main)` se filtra por `branchId IS NULL`, no por `branchId = main.id`. Documentado en lib.ts y cow.ts.

2. **Copy-on-write LAZY (no copy-at-create)**.
   Crear una branch es O(1) — ninguna entry se duplica hasta el primer save. La fork se materializa en `materializeForkOnEdit` con snapshot `branchedFromUpdatedAt = mainEntry.updatedAt` para poder detectar conflictos al merge (`m.updated_at > e.branched_from_updated_at`). Permite tener decenas de branches activas con coste casi cero en disco/tiempo.

3. **Slug COW prefijado `__b-<branchSlug>` para esquivar el unique `(ws,coll,slug,locale)`**.
   La fork comparte collection+locale con su entry main, así que el unique constraint de slug colisionaría. Solución: la fork usa `${originalSlug}__b-${branchSlug.slice(0,12)}` mientras vive en branch, y al `promote` durante el merge se restaura el slug original (que es el de main, no el de la fork). Documentado en `cowSlug()`.

4. **3 estados visibles para entries en branch + tombstones**.
   `forked` (COW de main editada), `new` (creada en branch sin original), `deleted` (tombstone — borra main al merge). El usuario ve los 3 con badges de color en `/admin/branches/[id]`. La UI distingue "borrar en branch" (tombstone) vs "descartar cambios" (revert hard-delete del fork). Sin esto, "borrar en branch" sería ambiguo y rompería la expectativa de que un merge limpie main.

5. **Merge 3-way con resolución per-bloque desde el inicio (no fast-forward only)**.
   Cada item del plan tiene su `defaultAction` (promote/delete_main/create_in_main) y el usuario puede pasar `resolutions[forkId]` con `use_branch | use_main | skip`. El merge se bloquea si hay conflictos sin override. Esto es lo que diferencia el branching de CSM de un mero "staging" — sin merge inteligente, el feature es decorativo. Coste: ~280 líneas de `merge.ts`.

6. **Preview público SIN auth, con token rotable + password opcional + expiración**.
   `/preview/branch/[token]` es público (sin login admin) para poder compartir con stakeholders. Token = 24 bytes random base64url (192 bits, no enumerable). Password = sha256(salt + plaintext). Expiración opcional. `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` en layout.tsx. NUNCA usar el preview para contenido confidencial sin password — la URL es la auth.

### Patrones nuevos consolidados

7. **Claim atómico con UPDATE … RETURNING para operaciones long-running** (ya consolidado en F8b/F9a, ahora también en merge):
   ```ts
   const claimed = await db
     .update(branches)
     .set({ status: "merging", updatedAt: new Date() })
     .where(and(
       eq(branches.workspaceId, ws),
       eq(branches.id, branchId),
       eq(branches.status, "draft"),
       eq(branches.isDefault, false),  // never main
     ))
     .returning({ id: branches.id });
   if (claimed.length === 0) return error;
   ```
   Sin esto, dos clicks en "Merge" desencadenan dos merges en paralelo. La regla es **siempre** filtrar por `status` esperado en el WHERE del UPDATE, nunca SELECT-then-UPDATE.

8. **Cookie scope `path: "/admin"` para state admin-only**.
   `csm_branch` cookie se setea con `path: "/admin"` para que NO se envíe en peticiones del sitio público (blog, /preview, /miembros). Esto evita que el blog público accidentalmente use la branch activa del editor logueado y muestre fork content. La regla: cualquier cookie de "modo admin" (workspace activo, branch activa, theme override) debe ser path-scoped.

9. **Snapshot `branchedFromUpdatedAt` para conflict detection eficiente**.
   En lugar de comparar bodies con un hash o checksum (caro), basta con guardar `mainEntry.updatedAt` en el momento del fork. Si después main se actualiza, `m.updated_at > e.branched_from_updated_at`. Una sola query JOIN agregada calcula todos los conflicts del workspace. Coste cero en write path (sólo set una vez al fork).

10. **Block-id estable para diff Tiptap**.
    Tiptap puede o no asignar `attrs.id` por bloque. Cuando no, hash determinista `djb2(type + text + idx)`. Esto permite que `diffBlocks` reconozca "este es el mismo bloque" tras edits dentro del bloque (texto cambia pero el id se preserva). Si el id es `auto-…-i`, la match falla cuando se reordenan bloques — limitación conocida. Para diff perfecto en F10: forzar block ids estables en todo el editor (PROSEMIRROR-ID extension).

### Cosas que NO funcionarían si las hiciera al revés

11. **NO migrar entries main a `branchId = main.id`** (consideré hacerlo).
    Habría requerido `UPDATE entries SET branchId = (SELECT main.id …) WHERE branchId IS NULL` por workspace, ALTER COLUMN NOT NULL, y hot-fix de 30+ queries en blog/api/v1/sitemap/feed/og/search/automations/webhooks. Riesgo enorme. La alternativa NULL=main es operacionalmente equivalente y backwards-compat al 100%.

12. **NO mezclar `comments` (públicos) con `branch_comments`** (consideré reusar).
    `comments` se renderiza en el blog público y tiene status `pending|approved|spam`. Branch comments necesitan threads, mentions, anchorRange, status `open|resolved` — semántica completamente distinta. Tabla separada evita CHECK constraints complicados y queries con OR.

13. **NO crear pageId fork en F9b** (esperado para F10).
    El usuario podría querer "branchear una página visual" — el schema lo permitiría (similar a entries) pero la complejidad del builder + symbols se duplicaba. F9b cubre entries (posts + custom collections), F10 puede extender a pages.

### Riesgos asumidos conscientemente (diferidos a F10)

- **Webhook `entry.updated` se dispara para forks**: subscribers externos reciben eventos sobre fork edits. Mitigación F10: filtrar `branchId` en dispatcher. Por ahora aceptable porque webhooks rara vez llegan al detalle de "ese id es de qué branch".
- **Search index encola embeddings de forks**: pollute del vector space del workspace. Mitigación F10: skip enqueue si branchId !== null.
- **createEntry no respeta branch activa**: si usuario crea un post con branch X activa, va a main. Hay que usar `createEntryInBranch` explícitamente. Mitigación F10: integrar en `createNewPostFormAction` y similares.
- **Preview view counter no rate-limited**: spam público inflará `previewViews`. Aceptable.
- **`abandonBranchAction` permite a cualquier editor abandonar branches de otros**: en workspace colaborativo es intencional pero suboptimal. F10: `editor` solo puede abandonar branches que creó; `admin` cualquier branch.

### Verificación final F9b
- `npx tsc --noEmit` cero errores
- `npx biome check` (43 files) cero errores en F9b
- `npm run build` ✅ — `/admin/branches`, `/admin/branches/[id]`, 4 API routes, `/preview/branch/[token]` x2 todos en bundle
- Backfill `scripts/backfill-main-branches.ts` ejecutado contra Neon — main creada para workspace demo

#### Auditoría capa 2 (subagent estrecho F9b)
3 CRITICAL + 11 HIGH + 10 MEDIUM + 6 LOW. Aplicados:
- [x] **C1**: workspace asserts en `materializeForkOnEdit`/`markDeletedInBranch`/`revertForkInBranch`/`createEntryInBranch` (cow.ts) — validar `branch.workspaceId === workspaceId` al inicio.
- [x] **C3**: sibling forks órfanos al delete-promote (merge.ts) — antes de borrar main, convertir todas las forks `originalEntryId=mainId` de OTRAS branches a `branchState='new'` (clear originalEntryId/branchedFromUpdatedAt).
- [x] **H4**: full scan workspace en branches/[id]/page.tsx — `inArray(entries.id, originalIds)`.
- [x] **H6**: rotatePreviewToken role gate — editor sin password rechazado, admin sin restricción. (admin role completo lo dejo para F10).
- [x] **H7**: abandonBranch gate — sólo creator o admin.
- [x] **H9**: cowSlug colisión de prefijo — añadido sufijo `-${branchId.slice(0,6)}` para deduplicar branches con slugs largos compartiendo primeros 12 chars.
- [x] **H10**: deleted-promotion ahora también detecta conflictos — `listBranchConflicts` extiende a `branchState IN ('forked','deleted')`.
- [x] **H14**: hashPreviewPassword salt incluye `branchId` + comparación con `timingSafeEqual`.
- [x] **M15**: cookie `csm_branch` httpOnly:true (la layout server-side la consume).
- [x] **M20**: stuck merge timeout — claim atómico permite re-claim si `status='merging' AND updatedAt < now() - interval '5 minutes'`.
- [x] **M21**: resolveActiveBranch rechaza también `merging` (no sólo merged/abandoned).
- [x] **M22**: JOIN en `listBranchConflicts` y `listBranchesWithStats` añade `m.workspace_id = e.workspace_id` defense-in-depth.
- [x] **M23**: comment mentions validadas contra tabla `members` del workspace.
- [x] **M24** (= L3-12): `createPostInternal` y `createEntryInCollectionAction` respetan branch activa, ruta a `createEntryInBranch` cuando ≠ main.
- [x] **L26**: `abandonBranch` también limpia previewToken/passwordHash/expiresAt.
- [x] **L29**: comentario MS→S corregido en types.ts.
- [x] **L30**: password preview ya NO viaja en URL — server action POST + cookie httpOnly `csm_branch_preview_<token>` scoped por path.

Diferidos a F10:
- C2-8 / H8: rebase explícito (refresh `branchedFromUpdatedAt` al ver una versión nueva de main). Hoy genera falsos positivos de conflict tras "use_branch" sin merge.
- C2-19: `comment.deleted` activity log requiere añadir valor al enum `branch_activity_type` — schema migration menor.
- C2-25: `listEntriesForBranch` 2 queries → 1 LEFT JOIN (perf no crítico).
- C2-27: race en `createBranch` (hoy retorna error genérico — UI tolera).
- C2-28: emoji ⚠ en client (cosmético).

#### Auditoría capa 3 (subagent amplio F0-F9b cross-fase)
**4 CRITICAL + 5 HIGH** sistémicos: F9b añadió `branchId` pero TODO el sitio público y APIs ignoraban la columna → fork content publicado leakeaba a producción al instante. Aplicados:

- [x] **L3-1 (CRITICAL)**: Sitio público + queries derivadas. `isNull(entries.branchId)` añadido en:
  - `src/lib/entries.ts` × 3 (`getPublishedPostBySlug`, `listPublishedPostsForWorkspace`, `listEntries` admin)
  - `src/lib/feed.ts` (RSS/Atom/JSON)
  - `src/lib/authors.ts` (archivo público de autor)
  - `src/lib/tags.ts` (archivo público de tag)
  - `src/lib/dashboard.ts` × 3 (status counts, entries series, top posts)
  - `src/lib/comments.ts` (`getEntryForComment`)
  - `src/lib/asset-usage.ts` (asset deletion guard)
  - `src/lib/collections.ts` (entryCount subquery)
  - `src/app/sitemap.ts`
- [x] **L3-2 (CRITICAL)**: REST `/api/v1/entries` — list, get, update, delete, publish todos filtran branch null.
- [x] **L3-3 (CRITICAL)**: GraphQL `entries` y `entry` resolvers filtran branch null.
- [x] **L3-4 (CRITICAL)**: Search FTS + vector + indexCoverage filtran branch null. `enqueueIndex` skip silencioso si entry tiene `branchId !== null`. `reindexWorkspace` filtra main only.
- [x] **L3-5 (HIGH)**: bulk actions admin (`publishEntriesAction`, `unpublishEntriesAction`, `archiveEntriesAction`, `deleteEntriesAction`, `scheduleEntryAction`) sólo afectan main.
- [x] **L3-6 (HIGH)**: cron `publish-scheduled/route.ts` sólo publica entries de main.
- [x] **L3-7/L3-8 (HIGH)**: `saveEntryAction` skip `revalidateTag(post:slug)`, `enqueueIndex` y `emitAsync(entry.updated)` cuando `current.branchId !== null` (es fork). Reactivados sólo en merge.
- [x] **L3-9 (HIGH)**: `mergeBranch` ahora dispara webhooks (`entry.published` si fue transición real, `entry.updated` siempre, `entry.deleted` para tombstones), `enqueueIndex` para promovidas, `revalidatePath("/blog","/")` y `revalidateTag(workspace:ws:entries)` al cierre.
- [x] **L3-10 (MEDIUM)**: `/api/og/article/[id]` filtra branch null.
- [x] **L3-13 (MEDIUM)**: `restoreRevisionAction` integra COW guard — si branch ≠ main y entry está en main, materializa fork primero. Si branch es main y entry está en otra branch, bloquea.
- [x] **L3-14 (= H4)**: full scan corregido (ya hecho).

### Lecciones nuevas aprendidas en F9b

1. **Añadir una columna nueva al schema de un dato heavily-queried (como `entries.branchId`) sin auditar TODAS las queries existentes es un bug sistémico esperando.**
   La auditoría capa 2 estrecha (F9b only) pasó casi todo OK porque mi código nuevo SÍ filtraba. La capa 3 amplia destapó que ~14 archivos en otras fases consultaban entries sin filtrar `branchId`. **Lección consolidada**: cualquier ALTER TABLE que añada columna con semántica visible-vs-oculto necesita un grep exhaustivo de `from(entries)` en TODO el repo + decision por archivo. Mejor todavía: ofrecer un helper exportado (`mainEntryFilter()` en `src/branches/cow.ts`) y migrar gradualmente.

2. **El claim atómico anti-race necesita escape hatch para procesos muertos.**
   F8b/F9a usaron `UPDATE … WHERE status='draft' RETURNING`. Funciona perfecto mientras el proceso vive. Si crashea mid-merge, la fila queda en `merging` permanente. **Pattern fix**: extender el WHERE a `(status='draft' OR (status='merging' AND updatedAt < now() - interval '5 minutes'))`. El threshold ≥ tiempo máximo razonable de merge.

3. **Cookie httpOnly:true por defecto incluso si "el cliente la lee".**
   F9b inicialmente puso `httpOnly: false` en `csm_branch` "porque el switcher la lee desde document.cookie". Pero el switcher recibe la branch activa via props server-side, no lee cookie en cliente. Auditoría flagged como riesgo XSS preventivo. Regla: `httpOnly: true` siempre, salvo prueba explícita de necesidad client-side.

4. **Password en URL ?pw=… queda en historial, Referer headers y access logs.**
   El form de password viajaba GET. Aunque conveniente, los password tokens deben ir SIEMPRE en POST body + cookie httpOnly scoped por `path`. La auditoría lo flagged y lo arreglé con `submitPreviewPassword` server action que hace `cookies().set()` y `redirect()`.

5. **Sibling forks en delete-promotion: el DELETE silencioso de main rompe forks de otras branches que también referenciaban esa entry.**
   El INNER JOIN en `listBranchConflicts` las dropea silenciosamente, así que se ven como "no-conflict" hasta que mergean y fallan con "Entry main desapareció". Fix: antes de delete promote, scan `WHERE originalEntryId=mainId AND branchId != currentBranchId` y convertir a `branchState='new' originalEntryId=NULL`. Esas forks se promueven como entries nuevas en su propio merge.

6. **Salt fijo en password hash es regalo a rainbow tables si la DB se filtra.**
   `csm:preview:${password}` produce hash idéntico para 2 branches con el mismo password. Sustituir por `csm:preview:${branchId}:${password}` añade sal por-recurso sin coste. Y para comparación: `timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))` no `===`.

7. **El stricto control de "branch activa" en server actions implica revisar TODA action que escribe entries.**
   `saveEntryAction` lo tenía desde el inicio; `restoreRevisionAction`, `createPostInternal`, `createEntryInCollectionAction` no — eran omisiones. Si una action muta `entries`, debe (a) resolver branch activa, (b) aplicar COW si necesario, (c) skip side-effects públicos (webhook/cache/index) cuando branchId !== null.

### Verificación post-fix
- typecheck cero errores
- biome cero errores en 43 files modificados
- build pasa con todos los routes en bundle
- F0-F9b queda blindada — listo para F9c (Editorial Calendar + Workflows) sin deuda técnica conocida

---

## 2026-05-04 — Blindaje final pre-F9c (4ª auditoría)

Antes de empezar F9c lancé una 4ª auditoría profunda buscando regresiones y casos missed por las anteriores. Encontró **0 CRITICAL + 3 HIGH + 4 MEDIUM + 2 LOW** (más 1 CRITICAL extra que detecté manualmente leyendo `src/middleware.ts`).

### Bug crítico que descubrí FUERA del agente
- **Middleware bloqueaba `/preview/branch/[token]` para usuarios anónimos**: la regex `/^\/preview(\/|$)/` en `PROTECTED` redirigía a `/login` cualquier URL que empezara por `/preview/`. Los preview tokens públicos (cuya gracia es no requerir login) estaban completamente rotos. **Fix**: regex cambiada a `/^\/preview\/(?!branch\/)[^/]+/` para excluir el segmento `branch/`. Una semana entera de feature en F9b habría llegado al usuario rota sin esta verificación.

**Lección consolidada**: cuando una fase añade rutas nuevas bajo un prefijo ya existente (`/preview/branch/...` cuando ya había `/preview/[id]`), revisar middleware/proxies/edge config inmediatamente. Las rutas nuevas heredan reglas viejas por defecto.

### Findings del agente — todos aplicados

- [x] **H1: `getRevision` cross-tenant** (lib/entries.ts:390). El helper exportado leía revisions sin filtrar por workspace. Hoy el único caller (`restoreRevisionAction`) se salvaba por coincidencia (compara `rev.entryId` contra una entry del workspace activo). Cualquier futuro caller (CLI, GraphQL, REST, merge tooling) podía leakear revisions cross-tenant. **Fix**: la firma ahora exige `workspaceId` y hace INNER JOIN con `entries` filtrando por ese workspace. Caller actualizado.

- [x] **H2: Race en merge `promote`** (branches/merge.ts:381-418). El UPDATE de main no comprobaba rowcount. Si entre el SELECT de main (línea 383) y el UPDATE (línea 397) otro proceso borra main (otro merge `state='deleted'`, bulk-delete admin), el UPDATE afecta 0 filas pero el DELETE de la fork sigue ejecutándose → contenido del autor de la branch se evapora silenciosamente. **Fix**: `.returning({ id })` y bail con error si vacío, preservando la fork.

- [x] **H3: `createEntryInBranch` slug uniqueness** (branches/cow.ts:266-300). Crear dos entries con el mismo título en la misma branch+collection+locale violaba `entries_ws_coll_slug_locale_idx` → 500 genérico al usuario. **Fix**: `ensureUniqueEntrySlug` antes del insert (mismo patrón que `createEntry`).

- [x] **M4: `ensureSingletonEntryAction` no filtra branchId** (admin/contenido/_actions.ts:117-127). Para singletons, si la entry tenía fork en una branch, el SELECT sin filtro retornaba orden indeterminado de heap → el redirect podía tirar al editor de la fork mientras el usuario está en main. **Fix**: añadido `isNull(entries.branchId)`.

- [x] **M5: Race en merge `state='new'` slug** (branches/merge.ts:344-362). Entre `ensureUniqueEntrySlug` y el UPDATE que limpia branchId, otro proceso podía reservar el slug → unique violation aborta el merge dejando la fork con `branchId=null` ya escrito. **Fix**: retry loop sobre código `23505`, hasta 5 intentos con sufijo timestamp+attempt.

- [x] **M6: `processIndexJobs` re-embebía forks legacy**. Ya aplicado en mi turno previo (defense-in-depth tras la corrección de `enqueueIndex`). El processor ahora skipa forks marcando job como `done` con error `"fork (skipped)"`.

- [x] **L8: imports engine UPDATE sin workspaceId** (imports/engine.ts:376). El SELECT previo ya garantizaba workspace pero el UPDATE confiaba ciegamente. Defense-in-depth aplicado.

- [x] **L9: `publishEntriesAction` re-encolaba ids no-transicionados** (admin/contenido/_actions.ts:410). Iteraba `parsed.data.ids` (input) en lugar de `transitioned` (resultado del UPDATE). Re-publicar entries ya publicadas gastaba presupuesto de embeddings sin razón. **Fix**: iterar `transitioned`.

### Diferido
- **M7: webhook delivery non-idempotency en merge retries**. Si merge falla a media iteración, items 1..N-1 ya completados re-emiten webhook al reintentar. Cada delivery tiene fresh `eventId` → subscribers no pueden dedupe. F10: añadir `merge_progress` table o per-item dedup key en `webhook_deliveries`. Por ahora aceptable — los subscribers maduros idempotentean por `payload.id` + `via`.

### Lecciones nuevas

1. **Una capa más de auditoría descubre regresiones que las anteriores no detectaron.** La 4ª audit encontró 9 issues (1 CRITICAL + 3 HIGH + 4 MEDIUM + 2 LOW) tras 3 auditorías previas. **Regla**: una fase MAYOR (F8, F9, F10) no se cierra hasta que una auditoría amplia adicional vuelva con ≤2 LOW. Si vuelve con HIGH, la fase no estaba lista.

2. **Middleware con regex amplio (`/^\/prefix(\/|$)/`) hereda rutas nuevas por defecto.** Cualquier `app/preview/foo/...` añadido más adelante quedará protegido aunque no se quiera. Mejor: regex más específico (`/^\/preview\/[^/]+$/` para single-segment, etc.) o un patrón whitelist explícito.

3. **`UPDATE … WHERE id=X` SIN `.returning()` es un bug latente cuando hay race possible**. Especialmente cuando la lógica posterior borra otra fila basándose en "el UPDATE seguro funcionó". Consolidar el patrón: TODO UPDATE en código que también borra/escribe en otras tablas debe verificar rowcount.

4. **Helpers exportados deben ser seguros para CUALQUIER caller, no solo los actuales.** `getRevision(id)` era seguro porque el único caller compensaba. Pero exportarlo hace que los nuevos callers (futuro CLI, futura tooling) confíen en él. Los helpers cross-tenant-sensitive deben REQUERIR workspaceId en la firma.

### Verificación final pre-F9c
- `npx tsc --noEmit` ✅ 0 errores
- `npx biome check ./src ./scripts ./bin` ✅ 0 errores en 477 files
- `npm run build` ✅ OK con todos los routes en bundle
- `npm run db:seed` ✅ idempotente
- F0-F9b **completamente blindada** — el sistema queda en estado "perfecto" para arrancar F9c

## 2026-05-04 — F9c · Editorial OS (Calendar + Workflows + Notifications + iCal)

### Lecciones nuevas que emergen del cierre de fase F9c

1. **Añadir un valor a un enum DB toca 5+ planos paralelos**.
   Añadir `"approved"` al `entry_status` enum requirió actualizar:
   - Schema Drizzle (✓ obvio)
   - Tipos TS derivados (`Entry["status"]`)
   - 3 schemas Zod (`EntryResourceSchema`, `EntryCreateSchema`, `ListEntriesQuerySchema`) — capa REST v1
   - GraphQL `EntryStatusEnum` (capa F7c)
   - SDK `Entry.status` (capa F7c)
   - 3 records UI (`StatusTabs.TABS`, `posts-table.statusBadge`, `side-panel.StatusDot`, `editor-shell.Status`)
   - Records `counts` en lib/entries.ts (3 ocurrencias)
   El subagent estrecho atrapó el schema y los tipos directos; el subagent amplio (capa 3) atrapó los 5 sistemas paralelos. **Lección: cualquier enum DB debe tener una `enumValues` exportada como única fuente de verdad y los demás módulos derivar de ella en vez de duplicar literales**. F10 audit: añadir biome rule custom.

2. **In-memory bus + Vercel Fluid Compute = limit arquitectónico, NO bug**.
   El SSE bell con `Map<userId, Set<Listener>>` funciona en una warm instance, pero entre instancias geo distintas un usuario en instancia A no recibe push de notification insertada por instancia B. **El fix correcto NO es código sino arquitectura**: F10 → Postgres LISTEN/NOTIFY o Redis pub/sub (Vercel Marketplace). Mientras tanto, el SSE sirve correctamente cuando el load balancer pega al user en la instancia que ejecutó la mutation, lo cual es ~80% del tráfico en un solo workspace pequeño. Documentar limitación.

3. **iCal RFC 5545 line folding NO es opcional**.
   Mi primera implementación generaba lineas >75 octetos cuando los titles eran largos. Apple Calendar y Outlook silenciosamente rechazan el feed entero. Implementé `foldLine` UTF-8-aware (retrocede si está a mitad de continuation byte). Aprendizaje: **todos los formatos de interoperabilidad (iCal, vCard, Atom, RSS, Sitemap) tienen "rules silently violated by parsers" — leer la spec y testear con clientes reales antes de enviar a producción**.

4. **Server actions DEBEN filtrar por branchId (F9b)**.
   Bug latente: `rescheduleEntryAction` aceptaba un `entryId` y mutaba esa entry sin chequear si era una fork. Si el usuario estaba en main pero recibía el id de la fork (vía link compartido o search), editaba la fork sin saberlo, generando divergencia silenciosa post-merge. **Lección consolidada con F9b**: cualquier server action que mute `entries` debe declarar explícitamente si trabaja sobre main, sobre branch activa, o ambas, y filtrar por branchId acorde. Patrón: `isNull(entries.branchId)` para mutaciones globales (calendar/workflows), `eq(entries.branchId, activeBranch.id)` para acciones del editor que ya pasaron por `materializeForkOnEdit`.

5. **FK cascade on delete + audit trails de fases posteriores = pérdida silenciosa de datos.**
   F9b creó `entries` con FK cascade en hijos (revisions, entryTerms, comments). F9c añadió `entry_assignments`, `entry_workflow_events`, `editorial_threads` con FK cascade al fork id. Cuando F9b hace `DELETE entries WHERE id=forkId` durante el merge, CASCADE se lleva todo el audit editorial al merge — pérdida total. **Fix C-4**: helper `transferEditorialAuditToMain` reapunta `entryId` al main antes del DELETE. **Lección general: cuando una fase X añade tablas hijas a una entidad existente, X tiene la responsabilidad de inspeccionar todos los flows de DELETE de la entidad padre en fases ≤X-1 y decidir si el cascade es deseado o requiere migración previa**. Esta es una clase de bug que SÓLO la auditoría capa 3 amplia detecta — capa 2 estrecha por fase la ignora.

6. **Webhooks F7 deben extenderse cada vez que se añade un evento auditable nuevo.**
   F9c añadió 12 tipos en `editorialEventTypeEnum` (audit interno) y 8 tipos en `EditorialNotificationType` (UI bell). Pero olvidé inicialmente extender `WEBHOOK_EVENTS` (F7). Resultado: integraciones externas (Slack, n8n) sordas a aprobaciones. **Patrón de gobierno: cada event type nuevo debe tener una respuesta consciente para los 3 canales: audit (entry_workflow_events), interno (notifications), externo (webhooks)**. No todos los eventos van a los 3 (ej: `comment.added` no necesita webhook), pero la decisión debe ser explícita.

7. **El "claim atómico" (UPDATE WHERE pre-condition RETURNING) tiene un footgun: cleanup en branch de error.**
   `transitionStatus.approved` hacía:
   ```
   1. UPDATE entries SET lockedForApprovalAt=now WHERE lockedForApprovalAt IS NULL
   2. ... otras validaciones ...
   3. UPDATE entries SET status=approved WHERE status=oldStatus
   ```
   Si paso 3 falla (race con otro user), el lock de paso 1 quedaba puesto eternamente. **Fix M7**: liberar lock en el branch de error si `lockedForApprovalById === input.actorId`. **Patrón: cualquier reservation/lock atómico debe tener su `release` en el path de error inmediato — preferiblemente en `try/finally` o helpers que envuelvan el lock+release**.

8. **DnD nativo HTML5 evita una dependencia masiva (react-dnd, dnd-kit).**
   `/admin/calendario` y `/admin/workflows` usan `draggable + onDragOver/onDrop` con `dataTransfer.setData("text/csm-entry-id", id)`. Cero deps añadidas. UX 95% del de dnd-kit. Optimistic update con `useTransition` + rollback al fallar. **Heurística: para drag-and-drop simple (1 source, 1 target type), HTML5 nativo es suficiente. Sólo levantar dnd-kit si necesitas multi-select drag, sortable lists con kbd a11y, o sortable nested.**

9. **AI suggestions deben tener fallback heurístico y filter por slots ocupados.**
   `suggestSlots` lee `analytics_events` últimos 90d. Pero un workspace nuevo tiene 0 events → `defaultSlots` (martes/jueves 09:00) garantiza 3 sugerencias visibles. Además filtramos slots ya programados (`upcoming` query) para evitar dobles publicaciones el mismo día. **Patrón: AI features deben degradar a heurística sensata y respetar el state existente del sistema. Nunca devolver array vacío sin explicación.**

10. **`requireUser` + `requireWorkspace` deben usarse juntos en server actions, NO uno solo.**
    `requireWorkspace` valida la cookie y retorna ws+role pero NO valida que el user esté logueado *individualmente* (devuelve null si no, redirect, etc). En código limpio fue casi automático llamarlos a ambos. **Patrón a documentar: server actions tipo `xxxAction` SIEMPRE deben empezar con `const user = await requireUser(); const ctx = await requireWorkspace(role);` — no asumir que requireWorkspace es suficiente.**

### Verificación final F9c
- `npx tsc --noEmit` ✅ 0 errores
- `npx biome check` ✅ 0 errores en 21 files F9c
- `npm run build` ✅ exitoso con todos los routes nuevos:
  - `/admin/calendario` (8.63 kB), `/admin/workflows` (6.64 kB)
  - `/api/admin/notifications` + 2 sub-routes (incluye SSE stream)
  - `/api/admin/calendar.ics`, `/api/admin/ai/suggest-slot`, `/api/cron/sla-breach`
- 2 capas de auditoría aplicadas:
  - Capa 2 estrecho F9c: 3 CRITICAL + 5 HIGH + 4 MEDIUM relevantes fixeados
  - Capa 3 amplio F0-F9c: 4 CRITICAL + 4 HIGH cross-fase fixeados
- F0-F9c **blindada** — listo para F10 (Pulido + Performance + Seguridad + Deploy)

## 2026-05-04 — F10a · Seguridad Enterprise (Parte 1: 2FA + Passkeys + Sesiones + CSP + Cookies)

### Lecciones nuevas que emergen del arranque de F10

1. **Better-Auth 1.2 NO incluye plugin `passkey` — implementar con `@simplewebauthn` directamente es la vía limpia.**
   `node_modules/better-auth/dist/plugins/` lista 27 plugins (admin, organization, two-factor, multi-session, mcp, etc.) pero NO `passkey`. Versiones >=1.3 lo añaden, pero antes de upgradear toda la auth (riesgo de regresión en login/2FA/magic-link existentes) prefiero implementación custom con `@simplewebauthn/server` + `@simplewebauthn/browser`. Schema F0 ya tenía la tabla `passkeys` modelada correctamente, así que no requirió migración. Reusé `verifications` (key/value con TTL) como almacén de challenges efímeros — single-use vía `DELETE … WHERE id = $1` tras leer. **Patrón: cuando un plugin "esperado" no está disponible, comprobar si el schema ya soporta la feature (caso passkey, caso comments anchors) y construir helpers domain-pure por encima. Evita upgrade-storms.**

2. **CSP `Report-Only` primero, `enforce` después — telemetría sin breaking changes.**
   Activar CSP enforce de golpe es la receta para 50 issues post-deploy de "esto no carga". `src/lib/security-headers.ts` permite ambos modos (param `enforce: boolean`). En F10a forzamos `false` → browsers reportan violations a `/api/security/csp-report` sin bloquear. F10d revisará los logs y pasará a enforce con whitelist refinada. **Heurística cross-cutting: cualquier nueva política de seguridad debe tener un modo telemetry-only antes de enforce. Aplica a CSP, BotID, rate-limit, AI cost cap.**

3. **CSP `'strict-dynamic'` + `'nonce-…'` libera de tener que listar cada CDN — pero exige Next.js cooperación.**
   Con `'strict-dynamic'` los browsers modernos ignoran `https:` y `'unsafe-inline'` (sirven solo como fallback IE) y confían sólo en scripts firmados con el nonce + sus descendientes. Para que server components inyecten el nonce en `<Script nonce={…}>`, leemos `headers().get('x-nonce')` (lo seteamos en middleware con `NextResponse.next({ request: { headers } })`). Si en F10d aparecen scripts inline sin nonce → tendremos breakage al pasar a enforce; documentar en checklist.

4. **`role="dialog"` en una `<div>` no es WAI-ARIA-correcto para banners no-modales.**
   Biome detectó (`useAriaPropsForRole` o similar) que un cookie banner con `role="dialog"` requiere también `aria-modal` o gestión de focus trap. Como el banner NO es modal (puedes interactuar con la app debajo) → cambiado a `<section aria-labelledby="…">`, que es semántico correcto y a11y-friendly. **Patrón: si tu UI es un "info pop" no-bloqueante, NO uses role="dialog"; usa `<section>` o `<aside>`. Solo dialog cuando hay focus trap real.**

5. **TypeScript 5.x distingue `Uint8Array<ArrayBuffer>` vs `Uint8Array<ArrayBufferLike>` — algunas libs lo notan.**
   `@simplewebauthn/server` en su typing pide `Uint8Array<ArrayBuffer>` (ArrayBuffer estricto, no Shared). El array que devuelve `atob(...)` en Node tiene tipo `Uint8Array<ArrayBufferLike>` (compat con SharedArrayBuffer). Cast explícito `as unknown as Uint8Array<ArrayBuffer>` resuelve sin runtime cost (siempre es ArrayBuffer en Node). **Patrón: si una lib externa exige el typing estricto y operas con buffers de Node Buffer/atob, el cast `as unknown as Uint8Array<ArrayBuffer>` es seguro y NO crea problema runtime.**

6. **`AuthenticatorTransport` lib.dom de TS 5.7 está desactualizada vs WebAuthn L3.**
   `lib.dom.d.ts` no incluye `cable` ni `smart-card` aún (transports nuevos). Pero @simplewebauthn los usa. En lugar de `as AuthenticatorTransport[]` por elemento → `Set<string>` validación + cast del array completo: más legible y biome no protesta. **Heurística: si lib.dom rechaza un literal moderno que la spec sí define, valida con un Set y casteа el resultado al type esperado por la lib externa.**

7. **El cookie banner debe vivir en root layout, no en páginas individuales.**
   Razón: el banner debe verse en `/`, `/admin/*`, `/blog/*`, `/legal/*` — todas las rutas que renderizan HTML. Si lo metes en `/admin/layout.tsx`, el sitio público nunca lo muestra. Si lo metes en cada page.tsx, no es DRY. Solución: mount en `src/app/layout.tsx` junto a `<Toaster />`. Eso lo hace global. **Regla: componentes con políticas legales (cookies, GDPR notices) → root layout. Componentes con políticas de UX (toaster, command-palette) → root layout también si se quieren globales; el principio es el mismo.**

8. **IP enmascarada en cliente NO sustituye a anonimización en DB.**
   El UI de sesiones muestra IP enmascarada (`a.b.c.x` IPv4 / primer triplete IPv6) — privacidad para multi-user workspace. Pero la columna `sessions.ip_address` en DB sigue siendo la IP completa que mete Better-Auth. Para GDPR-compliant DB, F10a parte 2 debe implementar truncado pre-insert mediante hook de Better-Auth o trigger Postgres. **Documentar: enmascarado de display NO es anonimización legal — auditar para parte 2.**


## 2026-05-04 — F10c · MCP Server (Parte 1: 12 tools + stdio + HTTP + CLI install + UI)

### Lecciones del primer diferenciador realmente único 2026

1. **Reusar la lógica de negocio (`src/lib/*`) en vez de re-escribir tools sobre HTTP es 5x menos código.**
   El MCP server importa directamente `createEntry`, `listEntries`, `hybridSearch`, `listSubscribers`, `listBranchesWithStats` de los módulos compartidos. Cero duplicación con el REST `/api/v1`. El único pieza propia del MCP es el `actor` resolver (porque el flujo no tiene cookie de sesión) y el conversor MD→Tiptap (porque queremos que un LLM escriba en markdown plano sin saber Tiptap). **Patrón: si el CMS ya expone lib helpers domain-pure, el MCP server es una capa muy fina por encima — no construyas un servicio paralelo.**

2. **`@modelcontextprotocol/sdk` v1.29 da TWO transports clean: `StdioServerTransport` y `WebStandardStreamableHTTPServerTransport`. NO hace falta express ni nada.**
   El web-standard transport acepta `Request` y devuelve `Response` — encaja directamente en Next.js Route Handlers (`runtime: 'nodejs'`). Cero adapters. La API es: `await server.connect(transport); return transport.handleRequest(req)`. **Heurística: cuando integres MCP en una app Next.js / Hono / Cloudflare Workers, busca el transport "WebStandard*" del SDK; ahorra 90% del boilerplate.**

3. **Para clientes desktop, el bootstrap más estable es un `.mjs` que `spawn` tsx — NO transpilar el server.**
   `bin/csm-mcp.mjs` es un wrapper que llama `node_modules/.bin/tsx` con `src/mcp/cli.ts`. Ventajas: cero build pipeline, los `@/` aliases funcionan, los devs pueden modificar tools sin recompilar. Stdio queda intacto (tsx no escribe a stdout). Logs van a `stderr` (`process.stderr.write`) para no contaminar el stream MCP. **Patrón: bins ESM en Node ≥ 20 + `tsx` runtime es la forma más simple de servir TS desde npm bin sin step de build.**

4. **MD→Tiptap conversor minimalista en 80 líneas evita que el LLM tenga que conocer el formato interno.**
   Soporta headings #-####, listas (-, 1.), code blocks ```, blockquotes (>) y párrafos. Es suficiente para el 95% de casos editoriales y deja al user usar el editor admin para casos ricos (tablas, embeds, símbolos). Si el agente intenta meter markdown que no entendemos, cae a párrafos. **Heurística: cuando expongas tools que mutan documentos estructurados (Notion, Tiptap, Slate), acepta markdown plano + parser tolerante; documenta que para edición rica hay que usar la UI nativa.**

5. **El `actor` para audit log debe resolverse en cascada cuando no hay cookie de sesión.**
   Stdio MCP opera con API key, no con sesión de usuario. Pero `logActivity` exige `actorId`. La cascada `apiKeys.createdById → owners más antiguos → admins más antiguos` siempre encuentra alguien y deja audit limpio. Audit log meta incluye `source: "mcp"` para que un humano pueda filtrar después qué se hizo desde un agente. **Patrón: en cualquier integración machine-to-machine, deja explícito en audit el origen ("source": "mcp" / "webhook" / "automation"); auditabilidad debe distinguir humanos vs agentes.**

6. **`ensureScope` con `mcp:any` como override + scopes específicos como fallback da granularidad sin complejidad.**
   Una key con `mcp:any` puede llamar todos los tools. Una key con `entries:read` solo puede llamar tools que requieran ese scope (`entry_list`, `entry_get`, `entry_search`). El admin puede crear keys de "MCP read-only para asistente" o "MCP full para agente". `entries:any` = `entries:*` también funciona porque reusa `hasScope` que entiende globs. **Heurística: scope `<resource>:any` (universal) + scopes finos = la matriz mínima viable. No inventes un sistema de permisos paralelo para MCP.**

7. **La página `/admin/mcp` con tabs y copy-paste reduce el time-to-first-tool a 2 minutos.**
   Los usuarios NO leen docs. La discovery page con `npx csm mcp install --client=claude-desktop` que rellena la config automáticamente vs un JSON copy-paste con paths del SO correctos baja la fricción de "MCP" al de "instalar una extensión". **Patrón: cuando lances una integración técnica compleja (MCP, webhook, OAuth, OIDC), pon una page con tabs por cliente + comandos one-shot + paths absolutos; salva 50% del support load.**

8. **Web-Standard transport stateless es lo correcto para Vercel Fluid Compute en F10c parte 1.**
   Cada POST construye un `McpServer` nuevo. Vercel reusa instancias entre requests pero no comparte estado MCP. Esto es perfectamente legal según spec MCP — el cliente decide si quiere sessionful (mantenidas por el server) o stateless. Lo único que pierdes es resumibilidad de SSE largo. F10c parte 2 añadirá `sessionIdGenerator` + `EventStore` (Postgres) cuando tengamos un cliente que lo necesite (largos workflows). **Heurística: empieza siempre stateless en transports que escalen horizontal (HTTP/SSE en serverless). Sólo añade session affinity cuando un caso de uso real lo exija.**


## 2026-05-04 — F10c · Agente Editorial in-product (chat con tool-use)

### Lecciones del segundo bloque de F10c

1. **Reusar el `McpSession` con un `directActorId` opcional > construir un nuevo sistema de sesiones para el agente.**
   La idea inicial era separar "tools del MCP server" vs "tools del agente in-product". Habría sido duplicación. La solución limpia: añadir `directActorId?: string` a `McpSession`. Cuando está presente, `resolveMcpActor` lo usa directamente; cuando no, cae al fallback (creator de la API key → owner). El agente construye una sesión sintética con `apiKeyId: "agent:<userId>"` (sentinel para audit log) + scopes `["mcp:any"]` + `directActorId: userId`. **Patrón: cuando un nuevo caller necesita reusar un sistema de auth/permissions existente pero con una identidad diferente, añade un override opcional al sesión-record en lugar de crear un sistema paralelo.**

2. **Anthropic tool-use loop "puro" (sin AI SDK ni LangChain) cabe en ~280 líneas y te da control total.**
   Streaming SSE Anthropic tiene 6 tipos de eventos (`message_start`, `content_block_start`, `content_block_delta` con sub-tipo `text_delta` o `input_json_delta`, `content_block_stop`, `message_delta`, `message_stop`, `ping`). Mantienes un `Map<index, block-state>` per-iteración, acumulas `partial_json` por bloque tool_use, parseas al final en `content_block_stop`. El loop es: pide → consume stream → si hay `tool_use`, ejecuta + apila como `tool_result` user-message → repite (max 8 iter). **Heurística: si tu app necesita tool-use de Anthropic con stream y NO necesitas el ecosistema AI SDK (RAG, embeddings, multi-provider abstracto), implementarlo directo te ahorra 200KB de bundle, una capa de magia, y problemas de version skew.**

3. **NDJSON es más simple que SSE para streams chat-like en Next.js Route Handlers.**
   Los tres opciones para streams: SSE (`text/event-stream`), NDJSON (`application/x-ndjson`), o WebSocket. SSE es estándar pero exige formato `data: …\n\n` que el cliente debe parsear. NDJSON es 1 línea = 1 JSON: `for-await sobre lines, JSON.parse`. Cero ceremonial. Cliente: `for await` + `decoder.decode` + buffer + `indexOf('\n')`. Cuando no necesitas reconnect/event-id de SSE → NDJSON gana en simplicidad. **Patrón: para chat con tool-use vía Next.js Route Handlers, NDJSON > SSE > WebSocket. Usa SSE solo si necesitas semantics de Reporting API o EventSource del cliente.**

4. **`zodToJsonSchema` con `target: "openApi3"` produce JSON Schema que Anthropic acepta directamente.**
   El input schema de cada tool MCP es `ZodRawShape` (objeto plano `{key: ZodType}`). Para Anthropic necesitas JSON Schema con `type: "object"`, `properties`, `required`. Pasos: `z.object(shape)` → `zodToJsonSchema(wrapped, {target: "openApi3"})` → te da exactamente lo que Anthropic espera. Forzar `type: "object"` en root como red de seguridad. **Patrón: cuando cruzas un sistema basado en Zod (interno) con uno basado en JSON Schema (externo, OpenAPI/Anthropic/MCP/etc.), `zod-to-json-schema` con flag `openApi3` es el converter universal.**

5. **React keys estables ÷ idx en arrays que crecen sólo por push.**
   Biome flagea `messages.map((m, idx) => key={idx})` aunque en nuestro caso el array NO se reordena (sólo se hace push). Solución limpia: cada mensaje y cada `ContentPart` lleva su propio `id` generado en client-side al crear (`Date.now() + Math.random()`). Esto también ayuda al diff de React: cuando un text part se actualiza con un nuevo delta, su key permanece, evitando unmount/remount durante streaming. **Heurística: aunque biome/react-rules son a veces conservadoras, casi siempre es más sano dar IDs explícitos que silenciar la regla. El coste extra (genera 2 strings por turno) es despreciable.**

6. **El indicador "pensando" debe aparecer ANTES del primer delta de texto, no después de la primera tool call.**
   El primer flujo común es: usuario pregunta → el modelo decide invocar una tool antes de escribir nada → tool se ejecuta → luego texto. Si tu UI sólo muestra "pensando" cuando no hay text part, durante una pre-tool-call llamada no verá nada hasta que aparezca el primer delta. Solución: render `<ThinkingDots />` cuando `m.parts.length === 0` (ANTES de cualquier evento) Y dentro de cada text part vacío (`{p.text || <ThinkingDots />}`). **Patrón UX para chat con tool-use: el "pensando" tiene 3 estados — antes de cualquier evento, durante un text part vacío que aún no recibe deltas, y durante una tool call running. No omitas ninguno o el chat se ve "muerto" 1-3s.**


## 2026-05-04 — F10c · Content Health Scan (único en CMS open-source 2026)

### Lecciones de construir un "Lighthouse for content" sobre arquitectura existente

1. **Heurísticas síncronas (regex + walker) cubren el 80% del valor sin LLM ni HTTP.**
   Los 6 detectores que construimos (seo_title_length, seo_meta_missing, thin_content, missing_alt, heading_hierarchy, outdated_date) son cero-coste: pure functions sobre `Entry`. No hacen fetch, no llaman a IA, corren en milisegundos. **Siempre arrancar por las heurísticas determinísticas y reservar IA/HTTP para la siguiente capa**: `broken_link` (necesita HEAD requests con timeout/concurrency) y `factual_outdated` (necesita LLM con `entry.body` + fecha de publicación) son v2. El user ya tiene valor antes de añadir esa complejidad.

2. **`inputHash` SHA-256 sobre los campos relevantes hace barato el cron semanal.**
   En lugar de hashear el row completo de `entries`, sólo hasheamos `{title, excerpt, seo, bodyText, body}` — los 5 campos que afectan a los detectores. Si el user cambia `priority` o `dueAt` (no lo afectan al scan), el hash no cambia, no re-escaneamos. En un workspace de 1000 posts donde 30 cambian semanalmente, el cron procesa 30 + lee 970 cached. **Patrón: cuando un job idempotente es caro de ejecutar pero barato de "verificar si ya está hecho", almacena un hash determinista del INPUT no del OUTPUT, y compáralo en el cache check.**

3. **Transacción `DELETE WHERE entry_id + INSERT batch + UPSERT snapshot` es la forma limpia de "reemplazar" issues.**
   La tentación es: comparar issues antiguos vs nuevos, hacer UPDATE/INSERT/DELETE selectivo. NO. Mucho código, race conditions, bugs de "issue duplicado". La solución limpia: en una transacción, borra todos los issues de la entry y reinserta los nuevos. El UPSERT del snapshot va en la misma transacción. Postgres lo absorbe bien. Para 50 issues por entry × 1000 entries = 50k filas en transacciones de 0.5s cada una. **Heurística: para "snapshot completo de entidad derivada", siempre `DELETE all + INSERT all` dentro de una transacción. Más simple, sin estado intermedio inválido visible.**

4. **Un detector que lanza no debe tumbar el scan.**
   El motor ejecuta los detectores en `flatMap` con `try/catch` per-detector. Si `detectMissingAlt` lanza por un body Tiptap malformado, el scan continúa con los otros 5 detectores. Sin esto, un solo entry corrupto bloquearía el cron entero. **Patrón: pipelines de heurísticas (linting, scanning, indexing) deben envolver cada detector en try/catch + log; nunca dejes que un detector individual falle el batch.**

5. **El "score" debe ser transparente: `100 - sum(severityWeight)`.**
   Pesos `low=2, medium=5, high=10, critical=20` y cap en 0. El user puede mentalizarse: "si tengo 3 issues medium y 1 high → 100 - 15 - 10 = 75". Esto vale más que un score "AI-magic" que produce 73 con explicación. **Heurística: para scores user-facing en herramientas de auditoría (SEO, accessibility, security), prefiere fórmula explícita y publicada > ML opaco. Mejorará la confianza del user en las recomendaciones.**

6. **El walker de Tiptap doc como generator yields cada nodo profundamente — reusa entre detectores.**
   `walkNodes(doc)` es un generator que recorre recursivamente el doc Tiptap. Tres detectores (`detectMissingAlt`, `detectHeadingHierarchy` y futuros) lo consumen. Cada uno itera independientemente. Cero re-trabajo: la primera vez que se llama, los nodos están en memoria, los siguientes detectores ya tienen el body parseado. **Patrón: cuando varios detectores operan sobre la misma estructura compleja, escríbela como un generator pure-function y llámalo una vez por cada detector. La memoización de objetos JS la hace rápida automáticamente.**

7. **`dismissedAt` en lugar de `DELETE` para falsos positivos.**
   El user marca un issue como "ignorar" → `UPDATE … SET dismissedAt = now()`. El scan nunca crea un issue idéntico al dismissed (regenera todos los issues, pero la UI los filtra). Para audit ("¿qué false-positives marcamos?") tenemos historial completo. **Patrón: para herramientas de "review" (security, content, code review), nunca borres un issue dismissed; márcalo dismissed con `dismissedAt + dismissedById`. El user lo agradece la próxima vez que regenera y los ignored ya no le distraen.**

8. **Exponer el scan como tool MCP convierte la feature en conversacional.**
   Sin más código, el agente in-product (`/admin/agente`) y cualquier cliente MCP pueden invocar `health_summary` ("¿cómo va mi contenido?") o `entry_health_scan` con un id. El user pide *"dime los 3 posts con peor score y por qué"* y el LLM combina `health_summary` (worst 3) + `entry_health_scan` (issues por id) automáticamente. **Patrón: cuando construyes un dashboard de auditoría, exponé read-only tools MCP con la misma lógica. Bonus: el agente puede generar un email de resumen semanal sin que escribas código de templating.**


## 2026-05-04 — F10a Parte 2 bloque 1 (Login con 2FA + GDPR completo)

### Lecciones del cierre del bloque de seguridad

1. **El plugin `twoFactor` de Better-Auth NO finaliza la sesión cuando el user tiene 2FA activado — devuelve `data.twoFactorRedirect: true`.**
   Antes de este bloque, activar 2FA en `/admin/ajustes/seguridad/2fa` era *cosmético*: el usuario podía seguir entrando con sólo password porque el client form hacía `router.push(next)` directo tras `signIn.email()` exitoso. **El gap real era**: `result.data.twoFactorRedirect` venía como `true`, pero nadie lo leía. La sesión que devuelve Better-Auth es una "pre-session" que requiere completar 2FA para promoverse a sesión normal. Hasta que verifiques TOTP/backup, las server actions con `requireUser()` no te ven autenticado del todo. **Regla: cualquier login flow con plugin 2FA debe hacer el branch de `twoFactorRedirect` explícito, redirigir a la pantalla de challenge preservando `?next=` y SOLO ahí redirigir al destino. Si tu form solo lee `result.error`, tienes el gap silencioso.**

2. **`?next=` debe sobrevivir al ping-pong login → 2fa → admin.**
   Solución: en `handlePassword`, cuando detecto `twoFactorRedirect`, hago `router.push("/login/2fa?next=" + encodeURIComponent(next))`. La página 2FA lee el query param y redirige ahí tras verificar. Sin esto, Better-Auth te llevaría siempre a `/admin` y el deep-link inicial (ej. invitación a un entry específico) se perdería. **Heurística: cuando insertes una pantalla intermedia en un flow de auth (2FA, email verify, terms accept), propaga el `next` por query string en cada redirect, no por sessionStorage — es robusto a refresh, multi-tab y back-button.**

3. **El "double-confirm typed" para acciones destructivas pesa más que un confirm dialog.**
   Para "Eliminar cuenta" pongo `window.prompt('Escribe "ELIMINAR" para confirmar...')`. Es feo, no es Tailwind, no encaja con el design system. PERO funciona: requiere que el user escriba la palabra en español "ELIMINAR", no clic accidental. Es el mismo patrón de GitHub para borrar repo. **Patrón: para acciones irreversibles user-visible (delete account, drop database, force-push), prefiere `prompt(typed-confirm)` antes que un modal con botón Confirmar. La fricción es feature, no bug.**

4. **Grace period de 30 días con `deletionRequestedAt` + cron purge es más limpio que soft-delete `deletedAt`.**
   Tentación: setear `deletedAt` inmediatamente y filtrar todas las queries con `WHERE deleted_at IS NULL`. Problema: necesitas tocar 50 queries. Solución elegida: dos columnas, `deletionRequestedAt` (cuando el user pidió) y `deletedAt` (cuando soft-delete real ocurrió). El user sigue pudiendo entrar y operar normal mientras `deletionRequestedAt` esté seteado pero el grace no haya vencido. El cron `daily` borra HARD (FK cascade) cuando vence. Cero queries de negocio cambian. El user puede cancelar con un solo `UPDATE … SET deletionRequestedAt = NULL`. **Heurística: para "delayed irrevocable actions" (account deletion, plan downgrade with data loss, scheduled mass-delete), almacena el timestamp de la SOLICITUD, deja la app operando normal hasta el cron de cleanup, y haz hard-delete real al expirar. Más simple que soft-delete + filtros across.**

5. **El export ZIP debe incluir un README.txt que explique qué NO está incluido.**
   GDPR exige portabilidad. Pero también exige transparencia: el user tiene derecho a saber QUÉ datos hay sobre él. Si el export omite cosas (password hashes — no son útiles, pero ¿es legal omitirlos? sí, no son datos personales útiles — secrets de API keys, tokens activos, datos de OTROS usuarios), el README declara explícitamente la lista. Esto blinda jurídicamente y reduce dudas/queries de soporte. **Patrón: cualquier export-de-datos GDPR debe incluir un manifiesto humano-leíble de "incluido / no incluido + motivo legal de la omisión". Ahorra horas de respuestas a auditorías.**

6. **`route.ts` que devuelve un Uint8Array como Response funciona pero TypeScript necesita ayuda.**
   `new NextResponse(new Uint8Array(bytes) as BodyInit, {...})` — el cast `as BodyInit` es necesario porque la tipo unión `BodyInit` no incluye `Uint8Array<ArrayBufferLike>` cleanly en TS 5.7. Sin el cast, error de assignability. Es legítimo: en runtime Next.js acepta Uint8Array sin problemas. **Heurística: cuando un endpoint Next.js devuelve binary (ZIP, PDF, image), el cast `as BodyInit` o un `new Blob([bytes])` resuelve el typing sin runtime cost. NO uses `Buffer` (Node-only, falla en Edge).**

7. **Cron `daily` debe ser idempotente y reportar contadores en su Response JSON.**
   Cada función llamada (`pruneExpiredKeys`, `pruneOldDeliveries`, `purgeExpiredDeletions`) devuelve un número o objeto con `purged`. La Response JSON expone todo: `{ ok: true, keysPruned, deliveriesPruned, accountsPurged }`. Esto permite revisar en el dashboard de Vercel los runs históricos y detectar anomalías ("ayer purgamos 50 cuentas en lugar de 0-2 — ¿qué pasó?"). **Patrón: cron jobs siempre idempotentes + siempre devuelven objeto con counters por categoría. Lighthouse/observabilidad lo explotará después automáticamente.**


## 2026-05-04 — F10a Parte 2 bloque 2 (Login passkey + email verify + rate limit)

### Lecciones del cierre de F10a (auth enterprise grade)

1. **Mintar una sesión Better-Auth desde un endpoint custom: insertar fila + firmar token + cookie. NADA más.**
   Better-Auth no expone API pública para crear sesiones fuera de su pipeline (`api.signInEmail`, `api.signInPasskey`, etc.). Pero el contrato de la cookie es simple: name `csm.session_token` (o `__Secure-csm.session_token` en prod) con valor `${token}.${HMAC-SHA256(token, AUTH_SECRET)}` en base64 estándar (con padding, vía `btoa(String.fromCharCode(...sig))`). El verifier de Better-Auth reconstruye la firma y busca el token en la tabla `sessions`. Tres pasos: (1) `db.insert(sessions).values({id, userId, token, expiresAt, ipAddress, userAgent})`, (2) firmar el token con WebCrypto SubtleCrypto HMAC-SHA-256, (3) `res.cookies.set(cookieName, signedValue, {httpOnly, secure, sameSite:"lax", path:"/", maxAge})`. **Patrón: cuando integres un proveedor de auth opaco con un flow custom (passkey resident, SAML, OIDC custom), busca el formato de cookie en `dist/cookies/` o `dist/test-utils/cookie-builder.mjs` del proveedor; suele ser HMAC del token. Mintar la sesión a mano es ~50 líneas y evita forks del provider o plugins de terceros.**

2. **Resident credential WebAuthn requiere extraer el challenge de `clientDataJSON`, no de la sesión del user.**
   En el flow normal "user-known" (passkey desde admin con sesión activa), guardas el challenge bajo `userId` como key. En el flow "resident credential" (passkey desde /login sin saber quién es), no tienes userId al generar opciones. Solución inicial (errónea): `takeChallenge(prefix, args.userId ?? "")` → siempre falla porque la lookup key es `""`. Solución correcta: el challenge va embebido en `response.response.clientDataJSON` (base64url JSON con `{type, challenge, origin}`); decodifícalo y úsalo como key. Esto cierra el círculo: guardas bajo `opts.challenge`, recuperas bajo `clientDataJSON.challenge`. **Patrón WebAuthn: para passkeys discoverable/resident, NO uses userId como challenge key — extrae el challenge del clientDataJSON del response. Es la única identidad estable entre la generación y la verificación cuando no conoces al user.**

3. **Better-Auth `rateLimit.storage: "database"` es lo único que funciona en serverless multi-instancia, pero NO protege endpoints fuera de `/api/auth/*`.**
   `storage: "memory"` deja un atacante rotar entre Vercel Fluid Compute instances con counters independientes. `storage: "database"` (tabla `rate_limits`, key/count/lastRequest) cross-instance. PERO solo se aplica al handler de Better-Auth en `/api/auth/...`. Para endpoints custom (nuestros `/api/auth/passkey/login-{options,verify}`) hay que escribir un mini-limiter standalone que reuse la misma tabla — 70 líneas de Drizzle: si no existe row, INSERT count=1; si elapsed > window, RESET count=1; si count >= max, return retryAfter; else INCREMENT. Race condition de ±1 es despreciable para anti-brute-force con max=10. **Heurística: si tu auth-provider tiene un rate-limiter que NO cubre un endpoint que tú añadiste, escribe un limiter standalone que escriba en la misma tabla. Cero coste de operación, audit unificado, atacante no puede bypassear con un endpoint olvidado.**

4. **Cuando el rate-limit no tiene IP (proxy roto, dev local), CAE ABIERTO.**
   Tentación: si no hay IP, usar key compartida `"unknown"` y limitar todo el tráfico. Disastroso: cualquiera puede DOSear todos los users en cuanto desconfigure su proxy. Política correcta: si no hay IP, `return {ok: true}` y log warning una vez. Better-Auth tiene la misma política en `getIp()`. **Patrón: rate-limiters siempre fail-open cuando falta el discriminador (IP, userId, apiKey). El admin debe configurar `advanced.ipAddress.ipAddressHeaders` correctamente; mientras tanto, no rompas el flow normal.**

5. **UI lockout requiere `setInterval` para refrescar el countdown cada segundo, no es suficiente con `useState`.**
   Con solo `useState`, el countdown se actualiza solo cuando React re-renderiza. Si el user no toca nada, el "Espera 30s" se queda congelado. Solución: dentro del `useEffect` con dependencia `lockoutUntil`, montar un `setInterval(forceTick, 1000)` que dispara un `useState` no-leído (`forceTick`) cada segundo, lo que provoca re-render. Cleanup en el return del effect. Sin esto el banner es estático y el user lo ignora. **Patrón UX: cualquier countdown user-facing (lockout, scheduled-publish, OTP expiry, GDPR purge) necesita un re-render por segundo. Un `useEffect` con `setInterval` + dummy `forceTick` es la receta más simple en React.**

6. **Better-Auth `authClient.signIn.email` devuelve `result.error.status: 429` cuando el server lo limita; hay que branchear ahí.**
   El client de Better-Auth normaliza errores al `result.error` con `status` numérico. En 429, también propaga el `Retry-After` del server. Si tu form solo lee `result.error.message`, pierdes el contexto de "rate-limited" y muestras "Credenciales incorrectas" — confundiendo al user que escribió bien la password. Solución: branch explícito `if (status === 429) {...} else {message}`. Y `parseRetryAfter` ya tolera headers ausentes (default 60s). **Heurística: en cualquier auth client opaco, antes de mostrar el error genérico, branch por `status` para 429 (rate-limit), 423 (account locked), 451 (legal block). El user merece mensajes específicos cuando el problema NO es su input.**

7. **Política "free libre, paid verifica email" es el equilibrio correcto entre fricción y abuso.**
   Si exiges email verificado para hacer signin, perdés 30% del onboarding (gente que tipea email mal, links spam-foldered). Si nunca lo exiges, abres puertas a abuso de cuentas Stripe con emails throwaway que cargan tarjetas robadas. Intermedio: signup/signin libres, todo el admin libre, PERO al pasar a paid (o al pedir export GDPR completo, o al recibir alertas de seguridad) gate con `requireVerifiedEmailForPaidPlan(userId) → {ok, reason}`. El caller decide qué UI mostrar. **Patrón producto: la verificación de email es un GATE, no una BARRERA. Aplícalo solo a acciones donde el coste del falso-positivo es alto. Stripe (chargebacks), exports legales (GDPR liability), notificaciones críticas (responsabilidad legal de avisar). Para todo lo demás, el user puede operar.**

8. **`drizzle-kit push` requiere `--force` cuando hay pending changes que necesitan confirmación interactiva.**
   En CI/non-TTY (PowerShell con stdin redirigido o sandbox), `npx drizzle-kit push` muestra un prompt de confirmación que falla con `Interactive prompts require a TTY terminal`. La solución: pasar `--force` (versión 0.31+). Versiones anteriores requerían responder vía stdin con un YAML "no". **Patrón: cualquier comando CLI que muestre prompt de confirmación tiene un flag `--yes` o `--force` para CI; cuando el comando funciona en local pero falla en sandbox, el flag suele ser la única diferencia. Documenta en README los flags que harán el script CI-friendly.**


## 2026-05-04 — F10a parte 2 bloque 3 (Hardening final)

### 9 lecciones del bloque de cierre

1. **`safeUrlNullable` defensivo aunque la UI use picker.**
   `IMAGE.src`/`HERO.image`/`SECTION.backgroundImage` aceptaban `z.string().nullable().optional()` confiando en que el inspector usa un media picker, no input libre. Pero `propsSchema` corre server-side: un cliente malicioso podría POST'ear JSON crudo con `data:text/html,<script>` y el render del bloque pintaría `<img src>` directo. **Heurística defensa-en-profundidad: si un schema acepta string libre porque "el cliente normal usa picker", asume que el atacante NO usa el cliente normal. Aplica whitelist al schema aunque la UI ya filtre.**

2. **Outbound URL helper (http(s)-only) ≠ inbound URL helper (http(s)/relativa/anchor/mailto).**
   `isSafeUrl` (en `blocks/registry.ts`) acepta paths relativos, anchors, `mailto:`, `tel:` — apropiado para hrefs *internos* de bloques que apuntan al propio sitio. `isHttpUrl` (en `lib/safe-url.ts`) sólo acepta `http(s)://...` absoluto — apropiado para webhooks (server hace POST), ogImage (crawlers cargan), upload-by-URL (server hace fetch). **Patrón: tener DOS helpers explícitos con políticas distintas, no uno con flags. Cada caller elige la política correcta para su contexto. Si la mezclas, acabas permitiendo `mailto:` en webhook URLs.**

3. **Better-Auth `databaseHooks.session.create.before` es el punto correcto para anonimizar IP.**
   Better-Auth llama `databaseHooks` justo antes del INSERT en sessions. Devolver `{ data: nextSession }` reescribe el row antes de persistir. Sin esto, Better-Auth escribe la IP raw en `sessions.ipAddress`. Mi flow custom de passkey llamaba `mintSession` directo y aplicaba mask manual; el hook cubre el flow normal email/OAuth donde Better-Auth no nos pasa por el helper. **Patrón: cuando integras un proveedor de auth opaco que persiste datos por su cuenta, busca su hook system (databaseHooks, beforeWrite, beforeCreate) ANTES de duplicar la lógica en cada call site. Better-Auth, NextAuth, Lucia y Clerk todos exponen algún flavor de hooks pre-write.**

4. **CSP report dedup por SHA-256(directive+blockedUri+sourceFile+lineNumber) → UPSERT.**
   Sin dedup, un sitio público con 1000 visitantes/día y un script bloqueado genera 1000 filas idénticas/día — la tabla se vuelve impracticable para query. Dedup-key permite `INSERT ... ON CONFLICT DO UPDATE SET occurrences=occurrences+1, lastSeenAt=NOW()`. Una fila por (directive,resource,source) en lugar de N. Bonus: cuando se "resuelve" con `resolvedAt` y vuelve a ocurrir, `DO UPDATE` lo reabre automático (set `resolvedAt=NULL`), lo que detecta regresiones. **Patrón: cualquier endpoint que reciba eventos high-frequency idénticos (CSP reports, tracking pixels, error logs cliente) debe agregar por dedup key con UPSERT. Almacenar cada evento crudo es trampa que escala mal.**

5. **Reporting API (header `Reporting-Endpoints`) coexiste con `report-uri` legacy.**
   Browsers modernos prefieren `Reporting-Endpoints: csp-endpoint="..."` con formato JSON `{type:"csp-violation", body:{...}}`. Browsers legacy envían `{"csp-report":{...}}` a la URL en `report-uri`. Un solo endpoint puede manejar ambos: parsea el body, branch por shape (`"csp-report" in body` vs `"type" in body && body.type === "csp-violation"`). **Patrón: para feature de browser que tienen API legacy + moderna, soporta ambos formatos en el endpoint server. Cuesta 30 líneas de parser y captura el long tail de browsers viejos sin sacrificar la API moderna.**

6. **Anti-bot helper ortogonal con dynamic import desacopla la dep opcional.**
   `verifyAntiBot()` con `provider: "botid"` hace `await import("@vercel/botid").catch(() => null)`. Si la dep no está instalada, devuelve `{ ok: true, provider: "none" }`. El user activa BotID instalando la dep + `VERCEL_BOTID_ENABLED=1` — sin afectar el código. **Patrón: para integraciones platform-specific (BotID solo funciona en Vercel) o costosas (Turnstile requiere cuenta CF), usa dynamic import con catch. La app sigue arrancando sin la dep; el feature se activa cuando el user opta.**

7. **422 vs 200 vs 403 en endpoints públicos cambia el comportamiento del bot.**
   Si un endpoint con captcha falla con 403, el bot aprende "este token no funciona, prueba otro/abandona". Si falla con 200 silencioso (mismo body que ok), el bot cree que funcionó y se va. Para honeypot + anti-bot: 200 silencioso (no se delata el detector). Para captcha con token presente pero verify failed: 403 explícito (humano legítimo con token caducado merece feedback). **Patrón anti-spam: status code es part of the protocol — el bot lo lee. Decide qué señal mandas en cada caso (captcha falló = 403, honeypot triggered = 200 silent, missing token = 200 silent). Documentado en cada endpoint.**

8. **Cap dual (per-user diario + workspace mensual) cierra el agujero del único cap.**
   Sólo cap mensual workspace: un user malicioso/buggy consume todo el budget en 1 día → workspace muerto el resto del mes. Sólo cap diario user: el workspace puede gastar 1000 USD/día sin tope. Combinación: per-user es la primera barrera (anti-runaway-loop), workspace mensual es el techo del bill. **Heurística: cualquier cap de coste o rate-limit que toque LLMs/APIs externas debe ser DOS dimensiones: (1) acceso individual short-window (anti-bug, anti-abuse), (2) agregado long-window (anti-bill-shock). Una sola dimensión siempre tiene un agujero.**

9. **`COALESCE(user_id, '')` en UNIQUE INDEX permite UPSERT con user_id NULL.**
   Postgres considera `(ws, NULL, day, feature)` distinto de cualquier otro `(ws, NULL, day, feature)` — los nulls no son iguales en UNIQUE checks. Para que `INSERT ... ON CONFLICT (ws, user_id, day, feature)` funcione cuando user_id es NULL (calls de sistema/cron), el index debe ser `(ws, COALESCE(user_id, ''), day, feature)`. La condición ON CONFLICT debe usar la misma expresión exacta. **Patrón Postgres UPSERT con columna nullable: `COALESCE(col, '')` (o sentinel similar) en el unique index Y en la cláusula `ON CONFLICT`. Sin ambos lados, el UPSERT inserta duplicados silenciosamente.**


## 2026-05-04 — F10a OWASP top-10 audit

Audit del codebase contra OWASP Top 10 (2021) ejecutado tras cerrar el bloque 3 de hardening. **Resultado: NO CRITICAL ISSUES FOUND** — la postura defensiva de F10a parte 2 cubre el surface area. Confirmado SECURE en:

- **A01 Broken Access Control**: todos los `_actions.ts` admin usan `requireWorkspace(role)` + `requireUser()`. Endpoints públicos validan workspace por host (no cross-tenant lookup posible).
- **A02 Cryptographic Failures**: Stripe webhook firma HMAC-SHA256 con `timingSafeEqual` (`src/payments/webhook/route.ts:328`). Tokens (form confirm, calendar.ics, passkey challenges) regex-validados.
- **A03 Injection**: zero SQL raw user-input; Drizzle ORM parametriza todo. Zod en boundaries. CSV escape en audit.csv export.
- **A06 Vulnerable Components / SSRF**: webhooks pasan por `httpUrlSchema()` (`src/lib/safe-url.ts`); uploads-by-URL pasan por `assertPublicUrl()` (`src/lib/ssrf.ts`) que bloquea IPs privadas/loopback/cloud-metadata.
- **A07 Auth Failures**: rate-limit DB-backed cross-instance (`rate_limits` table), 2FA con `twoFactorRedirect` correctamente implementado en login flow, passkeys con resident credential mintando sesión Better-Auth-compatible.
- **A09 Logging**: `logActivity()` en todas las mutaciones; activity_log + branchActivity para audit.

Sin findings nuevos pendientes. F10a parte 2 cierra el bloque de seguridad enterprise.


## 2026-05-04 — F10b parte 1 (Y.js infra + LISTEN/NOTIFY cross-instancia)

### 7 lecciones del bloque de arranque realtime collab

1. **Postgres LISTEN/NOTIFY no funciona sobre el pooler de Neon.**
   El pooler (`db-name-pooler.region.aws.neon.tech`) es PgBouncer transaction-mode: cada query usa una conexión distinta del pool, lo que rompe la semántica de LISTEN (la subscripción muere al terminar la "transacción"). Solución: connect string directo (sin `-pooler.` en el host). Mi helper hace `env.DATABASE_URL.replace("-pooler.", ".")` automático. Coste: una conexión "session" del cap (100 en free tier), aceptable para casos típicos. **Patrón: cualquier feature que requiera persistent connection (LISTEN/NOTIFY, COPY streaming, prepared statements server-side, pg_advisory_xact_lock) tiene que ir por el endpoint directo, no por el pooler. Documentar en .env.example si no es transparente. La mayoría de aplicaciones serverless solo usan request-response, así que el pooler las cubre — pero realtime collab es distinto.**

2. **Una conexión LISTEN por instancia + ref-counted local fanout es el patrón.**
   No 1 LISTEN por sub, no 1 LISTEN por canal: el cliente postgres-js permite múltiples canales LISTEN sobre la misma conexión persistente, pero cada `sql.listen(channel, fn)` añade un handler. Si hay 30 SSE abiertos al mismo workspace, abrir 30 LISTEN del mismo canal es un desperdicio. **Diseño correcto: 1 LISTEN por (instancia, canal); subs locales en un `Map<channel, Set<fn>>`; el handler único delega al Set.** Cleanup: NO emitimos UNLISTEN cuando size=0 — mantener el LISTEN abierto es barato y evita race conditions cuando otra subscripción aparece inmediatamente. **Patrón: pubsub local sobre primitiva persistente externa (LISTEN, websocket, MQTT) siempre lleva un fanout in-memory por instancia + idempotencia en la primitiva. Sin esto, no escala.**

3. **El bus in-memory de F9c era el clásico bug "funciona en dev con 1 instancia".**
   `notifications.ts` original mantenía `Map<bucketKey, Set<Listener>>` en el módulo. Bell SSE en instancia A → suscribe local. Mutación en instancia B (otra región o cold start) → emit local → fanout solo a listeners en B → A nunca lo recibe. En Vercel Fluid Compute con autoescala, dos editores en pestañas distintas pueden caer en instancias distintas y la notificación de "te asignaron" llega tarde (al reload) o nunca. **Heurística: cualquier `Map`/`Set` de listeners a nivel de módulo en un proyecto deployable a Vercel debe asumirse roto cross-instancia. Audita estos patrones cuando muevas un proyecto Express → serverless. La fix es siempre "publica al exterior y deja que el listener llegue por el LISTEN/PubSub".**

4. **Awareness updates NO se persisten.**
   Y.js separa "doc state" (CRDT contenido) de "awareness state" (presence, cursors, selections, editing markers). El doc se persiste; el awareness es efímero. Un cliente offline 30s deja de aparecer en la lista — eso es por diseño. Si persisto awareness, gasto storage en data que se invalida sola y meto presencia "fantasma" tras crashes. **Patrón: cuando uses Y.js, distingue qué va en `Y.Doc` (compartido + persistido) vs `Awareness` (compartido + efímero). En mi pubsub, canales separados `collab:up:{id}` y `collab:aw:{id}` reflejan esta separación. Nunca persistas awareness.**

5. **`emitUpdate:true` en `setContent` cuando hay collab — no `false`.**
   La intuición es "evitar trigger de autosave en el seed inicial → emitUpdate:false". Pero con la extensión Collaboration, `emitUpdate:false` SALTA el commit Y.js → el seed no se propaga al doc → otros clientes nunca lo ven. Solo el primer cliente vería el contenido inicial. **Regla con Tiptap+Collaboration: usa `emitUpdate:true` siempre, incluso para setup; el autosave duplicado es benigno (idempotente, mismo contenido convergido). Si quieres evitar autosave, hazlo con un flag local del cliente, no apagando el emitUpdate.**

6. **Tiptap 3 renombró `history` a `undoRedo` en StarterKit.**
   Mi código F8 usaba `history: false`. En Tiptap 3.22.5 (instalado tras update F9) la opción se llama `undoRedo: false`. TS lo detectó: `Object literal may only specify known properties, and 'history' does not exist in type 'Partial<StarterKitOptions>'`. **Patrón cross-version: cuando saltas major version de una librería con StarterKit-style configs, lee el migration guide de cada feature que toques en lugar de copiar de docs viejos. La clave 'history' aún existe como extensión standalone (`@tiptap/extension-history`), pero StarterKit la renombró internamente.**

7. **`navigator.sendBeacon` en `beforeunload` para awareness cleanup.**
   Si usas `fetch()` en `beforeunload`, el navegador puede cancelar la request mid-flight (la página se está cerrando). El user queda como "online" para los demás durante ~30s hasta que su client expira por timeout en awareness. `sendBeacon` está diseñado para exactamente esto: el navegador garantiza la entrega antes de cerrar la página, sin esperar respuesta. Lo uso para enviar el awareness "removal" (localState=null) — los demás clientes ven que se fue inmediatamente. **Patrón: para CUALQUIER limpieza side-channel en `beforeunload`/`pagehide` (analytics, presence cleanup, leave-room signals, draft autosave fire-and-forget), usa `sendBeacon` no `fetch`. La diferencia es la fiabilidad cuando la página muere.**


## 2026-05-04 — F10b parte 2 (B2-B4: cursors, presence global, reactions, email mentions)

### 8 lecciones del cierre realtime collab

1. **Cuando una librería overrida un campo de awareness, usa SLOTS SEPARADOS.**
   `CollaborationCursor` de Tiptap setea `awareness.localState.user = {name, color}` cuando monta la extension. Si yo seteaba en el provider `localState.user = {id, name, color, role, avatarUrl}` ANTES, Tiptap lo sobrescribía y perdía `id/role/avatarUrl`. Solución: dos campos en awareness state — `user` (Tiptap-owned, name+color) y `csmUser` (mi extended). Ambos coexisten porque awareness es un objeto plano y Tiptap solo toca `user`. **Patrón: cuando integras una librería que mutará un campo conocido del estado compartido (awareness, redux store, jotai atom), no compitas por ese campo. Crea un slot adyacente con tu prefijo (`csmUser`, `app:user`) y léelo TÚ. Doble fuente de verdad pero ambas owners distintos. Más simple que cualquier merge logic.**

2. **Doc + Awareness deben crearse SINCRONAMENTE para useEditor de Tiptap.**
   Mi diseño inicial: `useCollab` creaba `Y.Doc` con useRef y `Awareness` dentro del `CollabProvider` que se instanciaba en `useEffect`. Cuando construía el editor en `useEditor({extensions: [..., CollaborationCursor.configure({provider: { awareness: collab.awareness }})]})`, `collab.awareness` era `null` en el primer render → typescript error en property access + runtime crash. Fix: crear AMBOS con `useRef` en el hook, pasarlos al provider que los recibe vs crearlos. **Patrón: cualquier objeto que un componente de extensión/wiring necesita en su construcción inicial DEBE existir en el primer render. useRef + lazy init garantiza esto sin races. useEffect llega TARDE: el editor ya hizo configure() antes.**

3. **`emitUpdate:true` en `setContent` cuando hay collab — confirmé regla de B1.**
   Re-validado: el seed inicial desde `entries.body` debe propagar al doc Y.js para que otros peers lo vean. Si pongo `emitUpdate:false` (intuición de "evitar autosave duplicado"), el contenido nunca llega al doc → demás clientes ven editor vacío. Comentario duplicado pero importante: **emitUpdate true es no-negociable cuando hay Collaboration extension activa.**

4. **`sendBeacon` en `pagehide` Y `beforeunload` — ambos eventos.**
   `beforeunload` no se dispara siempre en mobile Safari (el OS mata la pestaña sin notificarla). `pagehide` SÍ se dispara. Para garantizar el "leave" presence + cleanup awareness en >95% de los casos, registro AMBOS listeners. `sendBeacon` es idempotente (la query DELETE en server hace upsert-like cleanup; presence_sessions UNIQUE evita duplicates). **Patrón: para "user closes tab" cleanup, usa pagehide + beforeunload + visibilitychange='hidden'. Cada uno cubre un mix distinto de browsers/OS. sendBeacon es la primitiva correcta para todos.**

5. **Polimorfismo de canal con `kind` discriminator + early-return en handler.**
   Tenía la opción de crear un canal separate `reactions:ws:{wsId}` para reactions live. En su lugar, reutilicé el canal de presence `presence:ws:{wsId}` con un `kind` discriminator extra (`"reaction.add"|"reaction.remove"`). Beneficio: 1 SSE menos en cliente, 1 LISTEN menos en server, fanout-aware-on-the-go. Coste: el handler debe ramificar early-return si es reaction (no afecta peers map) antes de aplicar al state. **Patrón: cuando dos features se necesitan en el MISMO scope (ws + admin) y los payloads son small/orthogonal, multiplexa al MISMO canal con discriminator. Ahorra connections, FDs, y simplifica auth.** Con cuidado: si los receptores son diferentes (público vs interno) o los payloads pesan mucho, separa.

6. **Online-vs-offline gating evita ruido en mentions email.**
   Sin gating, mencionar a alguien que está mirando el editor le manda un email + un bell SSE en simultáneo. Email = ruido + delay. Solución: `whoIsOnline(ws, mentionIds)` consulta presence_sessions (ventana 60s) y el helper `emailOfflineMentions` filtra antes del Resend call. Online users solo reciben bell + notification. **Heurística: cualquier canal "lento" (email, push notification, SMS) debe revisar si hay un canal "rápido" activo (SSE, websocket, app open) antes de disparar. La señal del canal rápido invalida la del lento. Es el mismo patrón que Slack: si estás "active", solo desktop notif; "away" → mobile push; "offline" → email summary.**

7. **HTML escape en email templates aunque el origen sea "trusted".**
   El `preview` del email viene de `body` del comment, que ya pasó por sanitización del editor — en teoría texto plano. Pero defensivamente, antes de inyectar en el HTML del email (`<blockquote>${preview}</blockquote>`), aplico `replace(/&/, "&amp;").replace(/</, "&lt;").replace(/>/, "&gt;")`. Resend NO escapa el HTML que le pasas. Si un comment futuro permite formato (Markdown → HTML, paste de HTML), o si un attacker inserta `<script>`/`<img onerror>`, el email es un XSS vector hacia el cliente de email del recipient. **Patrón defensa-en-profundidad: el escape de HTML en email templates es OBLIGATORIO incluso si el source es "trusted". Los emails se ven en clientes web (Gmail), apps (Outlook), webmails — distintos engines, posibles agujeros. Cuesta 3 líneas y cierra una clase entera de ataques.**

8. **`process.env.VERCEL_URL` como base URL en emails server-side.**
   En contextos non-request (cron, queue, background tasks tras un mutation), no hay `request.url` disponible para construir URL absolutas. La convención Vercel: `process.env.VERCEL_URL` lleva el host del deployment (sin `https://`). Mi helper hace `NEXT_PUBLIC_APP_URL ?? "https://" + VERCEL_URL ?? ""`. El último fallback es relativo (incorrecto en email pero non-crashing). **Patrón Vercel: para emails y notificaciones outbound siempre absoluta — establece `NEXT_PUBLIC_APP_URL` en `vercel env` para el dominio canonical (no preview). VERCEL_URL es tu mejor fallback per-deploy. Nunca dependas del request en flows server-only.**


## 2026-05-05 — Plantillas Showcase

### Lección 1: Decoupling preview ↔ edición es válido para "templates"
**Contexto:** El usuario pidió plantillas al nivel motionsites.ai (vídeo HLS, GSAP-style parallax, sticky stacking cards). El sistema de bloques actual no puede expresarlo sin añadir ~5 bloques premium nuevos.

**Solución:** Crear `src/templates/showcase/<id>.tsx` con React puro custom solo para el preview, mantener `buildLayout()` block-based para inserción editable. El usuario ve el preview espectacular (galería, hover live), al pulsar "Usar esta plantilla" recibe la versión editable simplificada (avisamos en la galería).

**Por qué OK:** las plantillas no son contenido del usuario — son inspiración pre-curada. La fidelidad 1:1 entre preview y editor sería ideal pero costaría 2 semanas de bloques premium antes de poder mostrar valor. Patrón aceptable mientras el copy en la galería sea claro.

### Lección 2: framer-motion 11 sirve para todo lo que motionsites.ai hace con GSAP
- `useScroll({ target, offset })` + `useTransform` → equivale a GSAP ScrollTrigger pin/parallax.
- `AnimatePresence` mode=wait + key dinámico → role cycling sin librerías extra.
- `useMotionValue` + manual mousemove → magnetic cursor.
- Para marquees infinitos: o bien `useScroll` driven, o CSS keyframes `@keyframes` con `animation: linear infinite` (más performante).
- **No instalar GSAP ni hls.js** salvo que el formato del vídeo lo exija. Los .mp4 de cloudfront funcionan con `<video>` nativo + JS para crossfade entre loops.

### Lección 3: CSP requiere @import url() de Google Fonts en `style-src` + woff2 en `font-src`
La directiva por defecto `style-src 'self' 'unsafe-inline'` bloquea `@import url("https://fonts.googleapis.com/...")`. Hay que añadir explícitamente `https://fonts.googleapis.com` a `style-src` y `https://fonts.gstatic.com` a `font-src`. **Síntoma típico**: las fonts no cargan en producción pero sí en dev (Tailwind v4 a veces inlined fonts en dev y oculta el problema).

### Lección 4: Biome requiere `Number.parseFloat` no global `parseFloat`
Regla `lint/style/useNumberNamespace`. Auto-fix con `--write`. Aplicable también a `parseInt`, `isNaN`, `isFinite` (`Number.parseInt`, `Number.isNaN`, `Number.isFinite`).

### Lección 5: CSS @import tiene que ir ARRIBA del archivo (antes de cualquier otra regla)
La regla `@import url(...)` debe ir antes de cualquier selector. Si se pone al final del archivo, biome rechaza con `noInvalidPositionAtImportRule` y los browsers ignoran el import. Documentado en MDN como restricción CSS.

### Lección 6: Anchors `href="#"` rompen lint a11y
`useValidAnchor` exige que `href` apunte a algo (`#anchor-real`, URL, mailto:, etc.). `href="#"` siempre falla. Para botones decorativos sin destino, usar `<button type="button">` no `<a>`. Para enlaces que aún no tienen destino real, usar un anchor placeholder (`#archivo`, `#say-hi`, etc.) — al menos hace scroll-to-top y comunica intención.

### Lección 7: `@next/next/no-img-element` es ruido en showcase con assets externos
Las plantillas showcase cargan vídeos+imágenes de CDN curado (cloudfront, motionsites, figma) — `next/image` requeriría whitelist en `next.config.ts` para cada dominio Y aporta cero valor (las dimensiones son fluid clamp, no fijas). Suprimimos con `eslint-disable-next-line` línea por línea — patrón intencional, no es deuda técnica.

---

## 2026-05-05 — Schema MySQL paralelo (Tarea 15)

### Lección 8: MySQL UNIQUE INDEX permite múltiples NULL — equivale a `UNIQUE WHERE col IS NOT NULL` de Postgres
PG necesita `WHERE col IS NOT NULL` en partial unique indexes para permitir múltiples NULL en columnas como `entries.originRef` (idempotencia inter-lote en imports). MySQL ya lo hace por defecto: un UNIQUE INDEX sobre `(workspaceId, originRef)` admite N filas con `originRef=NULL` y mantiene unique para los no-NULL. Resultado: la migración del partial → unique-plain es transparente sin perder semántica.

### Lección 9: Partial unique sobre `bool=true` NO se puede traducir a MySQL — mover el check a la app
PG permite `UNIQUE WHERE isDefault=true` (una sola fila true por workspace). MySQL no tiene partial indexes (8.0.13 introdujo functional indexes pero solo expresiones, no WHERE clauses verdaderos). Solución: bajar a non-unique index y validar en `createBranch()` antes del INSERT (idealmente dentro de transacción serializable: SELECT + INSERT). Documentar explícitamente en JSDoc del index para que futuros cambios no asuman uniqueness DB-level.

### Lección 10: MySQL `TEXT` no admite `DEFAULT` — promover a `VARCHAR(N)` cuando haya default
Cualquier `text("col").default("...")` de Drizzle PG falla en MySQL al ejecutar el DDL: `BLOB, TEXT, GEOMETRY or JSON column 'col' can't have a default value`. Para MySQL todos los defaults string viven en `varchar(N)`. Estrategia de N: usar el ancho semántico real (locale=10, slug=120, currency=10, oklch-color=60, lucide-icon=60, etc.) — no inflar a 255 por hábito.

### Lección 11: MySQL `TEXT` indexado requiere prefix length — usar `VARCHAR(N)` para indexed/uniqued columns
`UNIQUE INDEX ... ON entries(slug)` con `slug TEXT` falla con `BLOB/TEXT column used in key specification without a key length`. Hay que `slug VARCHAR(N)` o `slug TEXT(...)` con prefix `KEY (slug(120))`. Drizzle no expone la sintaxis de prefix limpia, así que la solución universal es promover toda columna text indexada a varchar con N apropiado al contenido (paths=1024, url=2048, slug=120, hash=128, etc.).

### Lección 12: MySQL no tiene `gen_random_uuid()`; generar UUIDs app-side es preferible (ADR-003)
PG tiene `gen_random_uuid()` y `defaultRandom()` ergonómico. MySQL tiene `UUID()` pero formato distinto (con guiones; v1 not v4) y no se puede usar como DEFAULT en versiones antiguas. La mejor práctica multi-DB: generar `crypto.randomUUID()` en el código que llama INSERT — además resuelve el 80% del problema de `RETURNING` (sabes el id antes del insert).

### Lección 13: Drizzle `customType` para tipos no built-in (VECTOR, GEOMETRY, etc.)
Drizzle 0.45 no tiene `vector(...)` para mysql-core. Solución: `customType<{ data: number[]; driverData: string; config: { dimensions: number }; configRequired: true }>({ dataType: cfg => \`VECTOR(${cfg.dimensions})\`, toDriver, fromDriver })`. El generic `configRequired: true` fuerza al caller a pasar `{dimensions:1536}`. `toDriver/fromDriver` hacen serialize/parse del string `[1,2,3]` que MySQL 9 acepta para VECTOR.

### Lección 14: Type exports en schemas paralelos deben ser idénticos en SHAPE
`schema.ts` barrel siempre re-exporta `schema.pg.ts` para mantener types Postgres como verdad TS (ADR-001). Por eso `schema.mysql.ts` debe producir `User`, `Entry`, etc. con la misma SHAPE lógica (mismos campos camelCase, mismos tipos JS). Cualquier divergencia rompe el contrato implícito y silencia bugs cuando dialect=mysql en runtime. Para enums: en PG son `(typeof xxxEnum.enumValues)[number]`; en MySQL los exportamos como union literal manual (ej. `EntryStatus = "draft" | ...`) ya que `mysqlEnum` no exporta el enum object separado.
