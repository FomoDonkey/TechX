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

## Fase 8 — Newsletter + Memberships + A/B + Live-Edit
- [ ] Subscribers, segments, campaigns, drip, doble opt-in
- [ ] Stripe memberships paywall por bloque
- [ ] A/B testing nativo (variants en cookie + SSR)
- [ ] Personalización por reglas
- [ ] Live-Edit on production (toolbar floating)

## Fase 9 — Importadores + Branching + Calendar + Workflows
- [ ] Importer wizard (WP/Notion/MD/Ghost/RSS)
- [ ] Content branching + diff + merge
- [ ] Editorial Calendar (mes/semana drag)
- [ ] Workflows con asignaciones

## Fase 10 — Pulido + Performance + Seguridad + Deploy
- [ ] Analytics propias (edge log → cron agregador)
- [ ] PWA + drafts offline (Dexie)
- [ ] Y.js presence en editor
- [ ] GDPR export + cookies banner
- [ ] 2FA TOTP + Passkeys + sesiones revocables
- [ ] Backups automáticos
- [ ] CSP estricta + OWASP review
- [ ] Lighthouse 100/100/100/100
- [ ] Seed data espectacular
- [ ] README con GIFs + 1-click deploy
