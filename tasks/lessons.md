# CSM — Lecciones aprendidas

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
