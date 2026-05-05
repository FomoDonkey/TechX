# CSM — MEGA PLAN ✦ Edición Espectacular

> **CSM** = *Content Spectacular Machine.*
> Tagline: **"Publica como en Notion. Diseña como en Framer. Escala como Vercel. Mide como Linear. Brilla como ningún CMS antes."**

> Un CMS open-source, AI-native, headless-first, multi-tenant, con editor Notion-like, page-builder visual estilo Framer, búsqueda semántica, memberships, newsletter, A/B testing, importadores y live-edit on production. **WordPress killer real.** Stack 100% gratis para arrancar.

---

## 0. North Star & inspiraciones

| Producto | Qué robamos |
|---|---|
| **Notion** | Editor de bloques, slash commands, /AI inline, comentarios in-line, comandos ⌘K. |
| **Linear** | Panel admin: densidad, atajos, motion, onda eléctrica, feedback instantáneo. |
| **Vercel/Resend** | Look del marketing/landing, OG dinámicos, Geist, gradients sutiles. |
| **Framer** | Page builder visual con drag, snap a grid, breakpoints, Smart Components. |
| **Sanity** | Custom Collections / Schemas, Studio extensible. |
| **Webflow** | Live-edit on canvas, theme primitives, CMS visual. |
| **Ghost** | Memberships, newsletters, paywall, tipo Substack. |
| **Substack** | Newsletter integrado, suscriptores, segmentación. |
| **Algolia/Vercel AI** | Búsqueda semántica (pgvector) con LLM para "Ask the docs". |

---

## 1. Contexto

**Por qué.** El usuario quiere un CMS al estilo WordPress pero **moderno, espectacular e increíble**. La oportunidad real: combinar lo mejor de Notion (editor) + Framer (visual builder) + Sanity (schemas custom) + Ghost (memberships+newsletter) + Linear/Vercel (estética y DX) en una sola plataforma open-source. Hoy no existe nadie que junte todo.

**Qué entregamos.** Un monorepo `CSM/` con dos planos:
1. **Admin** (`/admin`): panel privado, multi-tenant, AI-native, Notion-meets-Linear.
2. **Sitio público** (`/`): SSR/ISR/Edge, multi-tema, multi-idioma, SEO perfecto.

**Resultado esperado.**
- `pnpm install && pnpm db:push && pnpm db:seed && pnpm dev` → todo funcionando en local en menos de 90s.
- Login con `demo@csm.dev / demo1234` → workspace seed con 1 blog, 1 portfolio, 1 doc-site, 1 newsletter.
- 1-click deploy a Vercel + Neon + UploadThing.
- Lighthouse 100/100/100/100 en sitio público.
- TypeScript strict, 0 errores, 0 warnings.

---

## 2. Stack (todo gratis, todo best-in-class — 2026)

### Core
| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 15** + **React 19** (App Router, RSC, Server Actions, PPR) | Estándar full-stack 2026. |
| Lenguaje | **TypeScript** strict + `exactOptionalPropertyTypes` | Type-safety obligatorio. |
| ORM / DB | **Drizzle ORM** + **PostgreSQL** (Neon free tier) + **pgvector** + **pg_trgm** | SQL-first, edge-ready, semántico. |
| Auth | **Better-Auth** (email+pass, OAuth, magic-link, passkeys, 2FA TOTP) | Moderno y completo. |
| Validación | **Zod 4** + **@t3-oss/env-nextjs** | Boundary safety. |

### UI / UX
| Capa | Elección | Por qué |
|---|---|---|
| Estilos | **Tailwind CSS v4** (OKLCH, container queries) | Tokens modernos. |
| Componentes | **shadcn/ui** + **Radix** + **vaul** + **sonner** | Primitivas accesibles. |
| Motion | **Framer Motion** + **Motion One** (mini) | Spectacular sin pesar. |
| Tipografía | **Geist Sans/Mono** + **Lora** (theme Magazine) + **JetBrains Mono** | Identidad visual. |
| Iconos | **Lucide** + **Tabler** (set extra) | Cobertura completa. |
| Charts | **Tremor** + **Recharts** + **visx** (avanzados) | Dashboards bonitos. |
| Drag-drop | **dnd-kit** | Kanban, page-builder, listas. |
| Tablas | **TanStack Table** (virtualizado) | Datos masivos sin lag. |
| Comandos | **cmdk** | ⌘K palette. |

### Editor + Builder
| Capa | Elección | Por qué |
|---|---|---|
| Rich-text | **Tiptap v3** (con `@tiptap/pm`, `@tiptap/extension-collaboration`) | Estándar Notion-like. |
| Slash menu | **Novel** o custom sobre Tiptap | UX Notion exacta. |
| Diagramas | **Excalidraw** embed | Wow factor. |
| Code blocks | **Shiki** (web-shiki) + lazy-load grammar | Syntax precioso. |
| Page builder | **Custom** sobre dnd-kit + Tailwind tokens | Bloques visuales drag-drop. |
| Co-edición | **Y.js** + **y-websocket** self-host (o Liveblocks free) | Presence + cursors. |

### Media
| Capa | Elección |
|---|---|
| Storage | **UploadThing** (free 2GB) ↔ adapter para **Vercel Blob** / **S3** / **local** |
| Procesado | **Sharp** (resize, focal crop) + **plaiceholder** (blurhash) + **@vercel/og** |
| AI imagen | **Replicate** (Flux schnell free), **remove.bg** alternativa local con **@imgly/background-removal** |
| Tag/visión | **Hugging Face Inference API** (free) para tags automáticos + alt-text desde imagen |

### IA
| Capa | Elección |
|---|---|
| Default | **Groq** (free, Llama 3.3 70B, ultra-rápido) |
| Adapters | **Anthropic** (Sonnet 4.6/Opus 4.7), **OpenAI**, **Mistral**, **Ollama** local |
| Embeddings | **Voyage** (free 50M tok) o **OpenAI text-embedding-3-small** → **pgvector** |
| Streaming | **Vercel AI SDK** (`ai` package) |
| Imágenes | **Replicate Flux schnell** |

### Crecimiento / Monetización
| Capa | Elección |
|---|---|
| Email | **Resend** (free 3k/mes) + **react-email** templates |
| Newsletter | Tabla propia (`subscribers`, `campaigns`) + Resend bulk |
| Memberships | **Stripe** (sin coste hasta cobrar) + paywall por bloque |
| A/B testing | Propio (cookie + SSR variants) |
| Analytics | Tabla propia `analytics_events` + edge logging + agregador cron |
| Errores | **Sentry** (free 5k/mes) |

### APIs públicas
| Capa | Elección |
|---|---|
| REST | Next.js Route Handlers (Edge runtime) + Zod schemas |
| GraphQL | **Pothos** + **GraphQL Yoga** |
| OpenAPI | **@asteasolutions/zod-to-openapi** auto-generado |
| SDK TS | **openapi-typescript** + cliente fetch tipado, publicado a npm en `packages/sdk` |
| CLI | **`csm` CLI** (`packages/cli` con commander) — `csm init`, `csm push schema`, `csm export` |

### DX / Calidad
| Capa | Elección |
|---|---|
| Lint+Format | **Biome** (10x más rápido que ESLint+Prettier) |
| Tests | **Vitest** (unit) + **Playwright** (e2e) + **MSW** (mock) |
| Storybook | Sí, para `components/ui` y `themes/*` |
| Git hooks | **lefthook** + **commitlint** + conventional commits |
| Monorepo | **pnpm workspaces** + **Turbo** |
| CI | **GitHub Actions** (typecheck, lint, test, build, lighthouse, e2e) |
| Observabilidad | **Sentry** + **Vercel Analytics** + logs propios |

### Deploy
- **Vercel** (free) + **Neon** (free Postgres) + **UploadThing** (free) + **Resend** (free) → coste $0 hasta tracción.

---

## 3. Diferenciadores — 50 razones por las que destruye a WordPress

### Editor & Contenido
1. Editor de bloques **Notion-like** real con slash menu, drag handles, multi-columna, tablas anidadas, toggles, callouts.
2. **AI Inline ⌘J**: continuar, mejorar, acortar, expandir, traducir, fix gramática, generar excerpt, sugerir título SEO.
3. **Voice-to-content**: dictar y la IA estructura en bloques con headings.
4. **Smart paste**: pega Notion → mantiene formato; pega imagen → se sube; pega URL → embed.
5. **Page Builder Visual** estilo Framer (drag-drop, breakpoints, snap a grid, hover states, click-to-edit).
6. **Excalidraw embebido** para diagramas in-line.
7. **Code blocks Shiki** con líneas resaltadas, diff, copy, line numbers, 50+ lenguajes.
8. **Embed inteligente** (YouTube, Vimeo, Twitter, GitHub Gist, Figma, CodePen, Loom, Spotify…).
9. **Reusable Symbols / Components** (cambias uno → se actualizan todas las apariciones).
10. **Revisiones con diff visual** (Google-Docs-style) + revertir + bifurcar.

### Estructura
11. **Custom Collections** drag-drop como Sanity, sin tocar código (campos: text, rich, number, date, image, ref, repeater, json, select, color, geo).
12. **Validaciones Zod auto-generadas** desde el schema del CMS.
13. **Pages como singletons** + URLs custom + path con parámetros.
14. **Multi-locale estructural** (`entries.locale + parent_id`) — no hack.
15. **Branching de contenido** tipo Git (rama `staging` para preparar release de contenido y mergear a `main`).

### Crecimiento
16. **Memberships** con Stripe + paywall por bloque (gate específico, no toda la página).
17. **Newsletter integrada** (suscriptores, segmentos, campañas, drip, doble opt-in).
18. **Forms builder** drag-drop + submissions + webhook + auto-CRM (export CSV/JSON).
19. **A/B testing** nativo en frontend público (variants en cookie + SSR).
20. **Personalización** por reglas (país, device, fuente de tráfico) en bloques.

### Búsqueda & Discovery
21. **Búsqueda semántica con pgvector** + Postgres FTS combinada (BM25 + cosine).
22. **"Ask CSM"** chatbot RAG entrenado con tu propio contenido.
23. **Smart internal linking**: la IA sugiere enlaces internos al guardar.
24. **Content gap analysis**: la IA detecta temas que faltan en tu blog.

### Multimedia
25. **Smart focal crop** (face/object detection con HF) + auto alt-text.
26. **Background removal** in-line (1 click).
27. **AI image generation** (Replicate Flux) desde el editor.
28. **Asset DAM** con tags auto, búsqueda por descripción ("foto playa atardecer").
29. **Optimización auto** (AVIF/WebP, responsive sizes, blurhash, lazy).

### Distribución
30. **OG images dinámicos** (@vercel/og) — template editable por workspace.
31. **JSON-LD completo** (Article, Organization, Breadcrumb, FAQ, HowTo, Event…).
32. **Sitemap, robots, RSS, Atom, JSON Feed** auto + hreflang.
33. **Webhooks** firmados HMAC + retries exponenciales.
34. **Automations** tipo Zapier light (trigger → condición → acción).
35. **Importers**: WordPress (XML), Notion (zip), Markdown, Ghost, Strapi, RSS.
36. **Exporters**: Markdown, JSON, ZIP, Hugo/Astro/Eleventy.

### Operación
37. **Live-edit on production**: usuario admin entra al sitio público y aparece toolbar; click en cualquier bloque → modal de edición → publica al instante.
38. **Editorial Calendar** (vista calendario + Kanban workflow).
39. **Workflows** draft → review → approved → scheduled → published, con asignaciones.
40. **Real-time presence** (avatares + cursores en editor).
41. **Comentarios in-line** sobre bloques (resolver, mencionar, hilos).

### Plataforma
42. **REST + GraphQL + SDK TS** auto-generados desde tu schema.
43. **CLI `csm`** para scaffold de proyectos consumidores.
44. **API keys con scopes** + rate limit + audit log de uso.
45. **Custom domains con auto-SSL** (Vercel domains API).
46. **Edge runtime** para sitio público (latencia < 50ms global).

### Confianza
47. **Activity log + audit trail** completo, exportable.
48. **GDPR**: export por usuario, derecho al olvido, cookies banner, anon analytics.
49. **2FA TOTP + Passkeys** + sesiones revocables + dispositivos.
50. **Backups** automáticos (cron daily dump → R2/Vercel Blob + retención 30d).

---

## 4. Modelo de datos (Drizzle, ampliado)

```
-- núcleo
workspaces           (id, slug, name, plan, branding_json, brand_kit_json,
                      ai_provider, default_locale, locales[], custom_domain)
users                (id, email, name, image, locale, timezone)
sessions, accounts   (Better-Auth)
members              (workspace_id, user_id, role[owner|admin|editor|author|viewer])
invitations          (workspace_id, email, role, token, expires_at)
api_keys             (id, ws_id, name, prefix, hash, scopes_json, rate_limit, last_used)

-- esquema dinámico
collections          (id, ws_id, name, slug, icon, schema_json, is_singleton, list_view_json)
branches             (id, ws_id, name, base_branch_id, status[draft|merged|abandoned])
entries              (id, ws_id, collection_id, branch_id, title, slug, body_json, excerpt,
                      cover_id, status, locale, scheduled_at, published_at,
                      author_id, updated_by, seo_json, og_image_url,
                      parent_translation_id, embedding vector(1536))
revisions            (id, entry_id, body_json, summary, author_id, created_at)
entry_blocks_index   (entry_id, block_id)            -- para reusable symbols

-- taxonomías
taxonomies, terms, entry_terms

-- media + DAM
media                (id, ws_id, folder_id, key, mime, size, w, h, alt, caption,
                      blurhash, focal_x, focal_y, dominant_color, ai_tags[], embedding vector)
media_folders

-- páginas builder
pages                (id, ws_id, path, layout_json, theme_id, ab_test_id, locale, status)
symbols              (id, ws_id, name, layout_json)         -- reusable components
themes               (id, ws_id, slug, tokens_json, layouts_json, active)

-- crecimiento
forms, submissions
subscribers          (id, ws_id, email, name, locale, status[active|unsub|bounced],
                      tags[], created_at, source)
segments             (id, ws_id, name, rules_json)
campaigns            (id, ws_id, name, subject, body_json, segment_id, scheduled_at,
                      status, opens, clicks)
memberships          (id, ws_id, user_email, tier, stripe_customer_id, status,
                      current_period_end)
tiers                (id, ws_id, name, price_cents, interval, perks_json, stripe_price_id)
ab_tests             (id, ws_id, key, variants_json, allocation_json, winner_id, status)

-- comentarios
comments             (id, entry_id, author_name, author_email, body, status,
                      parent_id, ip_hash, ai_score)

-- nav / SEO
menus, redirects

-- automatización
webhooks             (id, ws_id, event, url, secret, retries, active)
automations          (id, ws_id, name, trigger_json, conditions_json, actions_json, active)

-- observabilidad
activity_log, notifications, analytics_events
search_index_jobs    (id, entry_id, status, error)         -- recompute embeddings

settings             (ws_id, key, value_json)
backups              (id, ws_id, key, size, created_at)
```

Índices y extensiones:
- `pgvector` (cosine sim sobre `entries.embedding`, `media.embedding`).
- `pg_trgm` (fuzzy slugs, búsqueda).
- FTS `tsvector` columna generada `entries.search`.
- Compuesto `entries(ws_id, status, published_at desc)`.
- Aislamiento multi-tenant por helper `withWorkspace(ws)` en cada query (tests dedicados).

---

## 5. Estructura de carpetas (monorepo)

```
csm/
├─ apps/
│  └─ web/                              # Next.js (admin + público)
│     ├─ app/
│     │  ├─ (admin)/
│     │  │  ├─ layout.tsx               # sidebar + topbar + ⌘K + presence
│     │  │  ├─ page.tsx                 # dashboard
│     │  │  ├─ contenido/[collection]/[id]/page.tsx
│     │  │  ├─ medios/, colecciones/, paginas/
│     │  │  ├─ formularios/, suscriptores/, campanas/, miembros/
│     │  │  ├─ analiticas/, automatizaciones/, ajustes/, equipo/
│     │  │  ├─ workflows/, calendario/, ab-tests/, redirecciones/
│     │  │  └─ importar/                # WP/Notion/Markdown wizard
│     │  ├─ (auth)/login, registro, invitacion/[token], olvide
│     │  ├─ (public)/[locale]/[[...slug]]/page.tsx
│     │  ├─ api/
│     │  │  ├─ auth/[...all]/route.ts
│     │  │  ├─ v1/                      # REST headless
│     │  │  ├─ graphql/route.ts
│     │  │  ├─ webhooks/route.ts        # outbound + Stripe inbound
│     │  │  ├─ uploads/route.ts
│     │  │  ├─ ai/{stream,embed,gen-image,bg-remove,alt}/route.ts
│     │  │  ├─ search/route.ts
│     │  │  ├─ og/[id]/route.tsx
│     │  │  └─ ingest/[event]/route.ts  # analytics + ab
│     │  ├─ sitemap.ts, robots.ts, manifest.ts
│     │  └─ feed.{xml,atom,json}/route.ts
│     ├─ components/
│     │  ├─ ui/                         # shadcn primitives
│     │  ├─ admin/                      # CommandPalette, DataTable, Kanban, Sidebar...
│     │  ├─ editor/                     # Tiptap + SlashMenu + AIInline + MediaPicker
│     │  ├─ builder/                    # PageBuilder canvas + bloques visuales
│     │  ├─ public/                     # render bloques en frontend
│     │  └─ marketing/                  # landing en `/`
│     ├─ themes/{magazine,portfolio,docs,storefront,newsletter}/
│     └─ lib/                           # client side helpers
├─ packages/
│  ├─ db/                               # drizzle schema + client + seed + migrate
│  ├─ auth/                             # better-auth config compartido
│  ├─ ai/                               # adapters + prompts
│  ├─ blocks/                           # registry: editor ↔ render ↔ builder
│  ├─ permissions/                      # ABAC policies
│  ├─ search/                           # FTS + vector + híbrido
│  ├─ seo/                              # meta + og + jsonld + sitemap
│  ├─ storage/                          # adapter UploadThing/Blob/S3/local
│  ├─ webhooks/, automations/           # dispatcher + sandbox
│  ├─ importers/                        # WP/Notion/Markdown/Ghost
│  ├─ ui/                               # design tokens + shared components
│  ├─ sdk/                              # client TS auto-generado
│  ├─ cli/                              # `csm` CLI
│  └─ utils/
├─ drizzle/                             # migrations
├─ scripts/                             # seed, lighthouse, e2e helpers
├─ messages/{es,en}.json
├─ .github/workflows/{ci,lighthouse,e2e}.yml
├─ tasks/{todo,lessons}.md              # regla global obligatoria
├─ biome.json, turbo.json, pnpm-workspace.yaml
├─ tsconfig.base.json, drizzle.config.ts, next.config.ts
└─ README.md (en español, espectacular, con GIFs y badges)
```

---

## 6. Sistema de diseño (más fino)

### Tokens (Tailwind v4)
- **Modo**: dark/light/system, persistencia + transición suave (no flash).
- **Color**: paleta OKLCH:
  - `--brand-1: oklch(0.55 0.22 290)` violeta profundo (primario).
  - `--brand-2: oklch(0.72 0.25 340)` rosa eléctrico (accent).
  - `--brand-3: oklch(0.78 0.18 180)` cian menta (success).
  - Grises semánticos via OKLCH lightness ramp.
- **Radius**: `0.75rem` base, `1rem` cards grandes, `2rem` heroes.
- **Sombra**: capas con blur y opacidad bajos (estilo Linear).
- **Spacing**: escala 4px.
- **Tipografía**: Geist (UI), Lora (theme Magazine), JetBrains Mono (code).

### Motion principles
- Spring suave en modales (`stiffness 400, damping 30`).
- Page transitions: fade + 6px slide.
- List reordenamiento con `LayoutGroup` (drag de bloques).
- Loaders: skeleton shimmer con gradient sutil.
- Hover en cards: glow direccional con `mouse-x/y` CSS vars.
- *Never* animaciones largas (>300ms).

### Componentes propietarios
| Componente | Función |
|---|---|
| `BlockEditor` | Tiptap envuelto + slash + AI + media + presence. |
| `PageBuilderCanvas` | dnd-kit + breakpoints + snap + zoom. |
| `CommandPalette` | ⌘K global + búsqueda semántica + acciones. |
| `MediaPicker` | Modal con search/uploads/recents/AI gen. |
| `KanbanWorkflow` | Estados de entradas en drag. |
| `EditorialCalendar` | Vista mes con drag a fechas. |
| `RevisionDiff` | Diff visual entre revisiones. |
| `LivePreview` | Multi-device + zoom + dark/light toggle. |
| `AskCSM` | Chat RAG con tu contenido. |
| `LiveEditOverlay` | Toolbar floting en sitio público para admins logueados. |
| `BrandKit` | Editor de colores/fuentes/logo/voz. |
| `EmptyState` | Ilustración SVG + CTA por vista. |

### Atajos (siempre visibles en `?`)
- `⌘K` palette • `⌘J` AI • `⌘S` save • `⌘P` preview • `⌘.` toggle theme.
- `g d` ir a dashboard • `c c` crear contenido • `c m` crear media • `g s` settings.
- En editor: `/` slash, `⌘\` toggle preview, `⌘⇧K` ⇄ comments side panel.

### Accesibilidad
- WCAG 2.2 AA mínimo, AAA en colores principales.
- Focus rings visibles, skip-links, prefers-reduced-motion respetado.
- Aria labels en todos los iconos.
- Lighthouse a11y 100.

---

## 7. Roadmap por fases (orden de ejecución)

> Cada fase deja el sistema **utilizable y deployable**. Se trackea en `tasks/todo.md`.

### Fase 0 — Bootstrap (cimientos)
- Monorepo pnpm + Turbo, Biome, lefthook, commitlint, conventional commits.
- `apps/web` con Next.js 15 + Tailwind v4 + shadcn init + Geist + Lucide + Framer Motion.
- `packages/db` con Drizzle + Postgres (Neon) + scripts `db:push`, `db:seed`.
- `packages/auth` con Better-Auth (email+pass, Google, GitHub, magic link, passkeys, 2FA).
- `packages/ui` con tokens, ThemeProvider, dark/light toggle sin flash.
- env validation con `@t3-oss/env-nextjs`.
- Layouts base (admin/public/auth).
- CI: typecheck + biome + build + Lighthouse.

### Fase 1 — Auth + Multi-tenant + Onboarding mágico
- Páginas login/registro espectaculares (glass + gradient + motion).
- **Onboarding wizard con AI Site Generator**: usuario describe su idea ("blog de cocina vegana") → IA genera nombre, branding (paleta+fuente), 3 posts demo, 5 categorías, hero copy, navegación. **Wow factor #1**.
- Workspace switcher en topbar.
- Invitaciones por email (Resend) + página `/invitacion/[token]`.
- Roles ABAC + middleware de permisos + `withWorkspace` helper.
- Activity log empieza a poblarse.

### Fase 2 — Dashboard + Editor + Posts + Live Preview
- Dashboard con KPIs (entradas, vistas, drafts, comentarios, suscriptores) + Tremor.
- Colección builtin **Posts** + DataTable + filtros + bulk actions.
- Editor Tiptap completo (todos los bloques, slash, drag, comments in-line).
- Autosave debounced + indicador "Guardado · hace 2s".
- Drafts + estados + revisiones automáticas con diff.
- Live Preview multi-device en split.
- Render público en `/blog/[slug]` con tema default.

### Fase 3 — Media Library + DAM
- Drag-drop uploader (UploadThing) con progress, multipart.
- Folders, search, alt, caption, focal point manual + sugerido por IA.
- Blurhash, AVIF/WebP, sizes responsive.
- Background removal (1 click).
- AI image generation (Replicate Flux schnell).
- Auto-tags con HF + búsqueda por descripción.
- Insert from editor (modal MediaPicker).

### Fase 4 — Collections Builder + Pages + Symbols
- UI para crear colección custom (nombre, slug, icono, fields).
- Field types: text, rich, number, date, image, ref, repeater, json, select, color, geo.
- Auto-form generation desde schema.
- Singleton mode.
- **Pages**: builder visual estilo Framer (canvas + bloques drag-drop + breakpoints).
- **Symbols** reusables (tipo Components de Figma).

### Fase 5 — Sitio público + 5 temas + SEO + OG
- Theme registry: cada tema exporta `{layout, blocks, tokens}`.
- Themes incluidos: **Magazine, Portfolio, Docs, Storefront, Newsletter**.
- Theme switcher con preview en vivo.
- SEO completo: meta dinámica, JSON-LD múltiples, sitemap, robots, RSS, Atom, JSON Feed, hreflang.
- OG images via `@vercel/og` con template editable.
- Edge runtime + ISR + tagged revalidation.

### Fase 6 — IA (full) + Búsqueda semántica + Comentarios + Voice
- `packages/ai` con adapters Groq/Anthropic/OpenAI/Mistral/Ollama.
- Editor: ⌘J AI Inline. Acciones: continuar, mejorar, acortar, expandir, traducir, excerpt, título SEO, alt text, generar OG.
- **Voice-to-content** (Web Speech API) + estructuración por LLM.
- **Embeddings** automáticos en cada save → `pgvector`.
- **Búsqueda híbrida** (BM25 + cosine) admin + frontend.
- **Ask CSM** chat RAG sobre el propio contenido.
- **Smart internal linking** al guardar.
- Comentarios in-line + frontend público + moderación + AI score anti-spam.

### Fase 7 — APIs públicas + Webhooks + Automations + Forms + CLI/SDK
- REST `/api/v1/...` con auth API keys + scopes + rate limit.
- GraphQL endpoint con Pothos + filtros + paginación + persisted queries.
- OpenAPI auto-generado + página `/admin/api-docs` (Stoplight Elements).
- Webhooks dispatcher firmado HMAC + retries exponenciales + UI logs.
- Automations builder (trigger → condiciones → acciones).
- Forms builder drag-drop + submissions + export CSV.
- Menus builder + Redirects manager.
- Scheduled publish (Vercel Cron).
- `packages/sdk` auto-generado (typed client).
- `packages/cli` (`csm init`, `csm push schema`, `csm export`).

### Fase 8 — Crecimiento: Newsletter + Memberships + A/B + Personalización + Live-Edit
- Newsletter: subscribers, segments, campaigns, drip, doble opt-in, plantillas react-email.
- Memberships con Stripe (webhook inbound), tiers, paywall por bloque, portal de cliente.
- **A/B testing** nativo (variants en cookie + SSR + dashboard de resultados).
- **Personalización** por reglas (país/device/UTM) en bloques específicos.
- **Live-Edit on production**: usuario admin entra a `/`, ve toolbar, click → edita → publica.

### Fase 9 — Importadores + Branching + Editorial Calendar + Workflows
- Importer wizard: WordPress (XML), Notion (zip), Markdown, Ghost, RSS.
- **Content branching** (rama de contenido + diff + merge + revertir).
- Editorial Calendar (mes/semana, drag a fechas).
- Workflows: draft → review → approved → scheduled → published, asignaciones, comentarios.

### Fase 10 — Pulido, performance, seguridad, deploy
- Analytics propias (edge log → cron agregador → dashboards).
- PWA + drafts offline (IndexedDB con Dexie) + sync al reconectar.
- Real-time presence en editor (Y.js).
- Audit log + GDPR export por usuario + cookies banner.
- 2FA TOTP + Passkeys + sesiones revocables + dispositivos.
- **Backups** automáticos diarios.
- **CSP estricta**, rate limit, OWASP top 10 audit, secrets en env, signed URLs media.
- Lighthouse 100/100/100/100 + bundle analyzer.
- Seed data espectacular (3 posts demo con cover real, 1 newsletter, 1 page hero, 1 portfolio item, 1 doc).
- README en español con GIFs, badges, screenshots.
- 1-click deploy button + `vercel.json` + variables Neon/Resend/Stripe documentadas.

---

## 8. Mockup ASCII del admin

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰ CSM   ⌘K Buscar...                     🔔  ●Ana ●Lu ●Ed   Workspace ▾  ⌘.│
├────────┬─────────────────────────────────────────────────────────────────────┤
│ 🏠 Inicio │  Dashboard                                          📅 Hoy  ▾    │
│ ✍️ Contenido │ ┌─────────┬─────────┬─────────┬─────────┐                       │
│ 🖼 Medios │ │ Entradas│ Vistas  │ Subs    │ Pendiente│                       │
│ 🧩 Colecciones│ │   124   │  18.4k  │   932   │    3    │                       │
│ 📐 Páginas │ └─────────┴─────────┴─────────┴─────────┘                       │
│ 📅 Calendario │ ╭────────────────────╮  ╭───────────────────────╮              │
│ 📨 Suscriptores│ │  Tráfico (30d)     │  │ Top entradas         │              │
│ 💸 Miembros │ │  ▁▂▃▅▇▆▇▆▇█▇▆       │  │ 1. Hola Mundo        │              │
│ 🔁 Workflows │ │                    │  │ 2. Lanzamiento V2    │              │
│ 🧪 A/B Tests │ ╰────────────────────╯  ╰───────────────────────╯              │
│ 🤖 Automatiz. │                                                                │
│ 📊 Analíticas │ ╭ Actividad reciente ─────────────────────────────────────╮   │
│ ⚙️ Ajustes  │ │ ✍️ Ana publicó "Lanzamiento V2"  · hace 12 min          │   │
│ 👥 Equipo   │ │ 🖼  Lu subió 3 imágenes          · hace 1 h             │   │
│ 🔌 API     │ │ 💬 5 comentarios pendientes      · hace 2 h             │   │
└────────┴─╰─────────────────────────────────────────────────────────────────╯─┘
```

Editor con AI Inline:
```
┌── Lanzamiento V2 · borrador ─────────────────────────── 👁 Vista previa ▾ Publicar ▾┐
│                                                                                     │
│   # Lanzamiento V2 ✦                                                                │
│                                                                                     │
│   Hoy publicamos la versión 2.0 con _todo_ lo que pidieron.                         │
│   ╭ 💡  ┃ Tip: este callout tiene fondo glass.                ╮                     │
│   ╰─────┴────────────────────────────────────────────────────╯                     │
│   │ ⌘J ▸  Mejorar redacción · Acortar · Traducir · Excerpt · Título SEO …          │
│                                                                                     │
│   /imagen  /columnas  /toggle  /tabla  /code  /excalidraw  /embed  /symbol …       │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
   Guardado · hace 2s        ●Ana editando        💬 3 comentarios          v12 ⌘P
```

---

## 9. Decisiones cerradas (sin debate)

- **App Router + RSC + Server Actions** (no Pages Router).
- **Drizzle, no Prisma** (más rápido, edge-ready, SQL nativo).
- **Better-Auth, no NextAuth** (más moderno, passkeys, mejor DX).
- **Biome, no ESLint+Prettier** (10x más rápido).
- **Tailwind v4 + OKLCH** (no tokens viejos).
- **Tiptap, no Lexical/Slate** (más comunidad, plugins listos, colab integrada).
- **Postgres FTS + pgvector**, no Algolia/Meili (cero costo extra).
- **Multi-tenant desde día 1** (no retrofittear después).
- **Headless-first**: el admin pasa por la misma capa que la API pública (services).
- **i18n estructural** (`entries.locale + parent_translation_id`).
- **Adapter de storage** (UploadThing default, swap a Blob/S3/local sin tocar código de negocio).
- **Adapter de IA** (Groq default, swap a Anthropic/OpenAI/Ollama).
- **Stripe opcional**: si no hay key, memberships se desactiva sin romper.
- **Edge runtime** para sitio público; admin queda en Node (libs media).

---

## 10. Verificación end-to-end (Definition of Awesome)

1. `pnpm install && cp .env.example .env && pnpm db:push && pnpm db:seed`
2. `pnpm dev` → admin en `http://localhost:3000/admin`, sitio en `http://localhost:3000/`.
3. Login `demo@csm.dev / demo1234`.
4. **Golden path** (recorre todo el wow):
   - Onboarding mágico genera workspace, branding y 3 posts demo con IA (mock si no hay key).
   - Crear post con slash menu → insertar imagen IA → mejorar texto con ⌘J → publicar.
   - Verificar `/blog/[slug]` con OG image generada.
   - Cambiar tema a Magazine → previsualizar → aplicar.
   - Crear colección "Eventos" con campos custom → entrada → consultar `/api/v1/eventos`.
   - Crear formulario "Contacto" → enviar desde frontend → ver submission y webhook.
   - Suscribirse al newsletter en frontend → admin lanza campaña → email entregado en Resend.
   - Comentar en post (frontend) → moderar (admin).
   - Búsqueda semántica admin: "post sobre lanzamientos" encuentra "Lanzamiento V2".
   - Ask CSM: "¿qué publiqué la semana pasada?" → respuesta con citas.
   - Live-edit on production: click en hero del home → editar texto → publicar al instante.
   - Crear A/B test del título del home → ver variants y winner.
   - Importar un export Notion .zip → entradas migradas con bloques.
5. **Tests**:
   - `pnpm test` (Vitest unit + multi-tenant isolation tests).
   - `pnpm test:e2e` (Playwright golden path).
   - `pnpm typecheck` cero errores.
   - `pnpm build` exitoso.
   - `pnpm lighthouse` → 100/100/100/100 en `/`.
6. **Performance budget**:
   - LCP < 1.5s, CLS = 0, INP < 200ms.
   - JS inicial < 90 KB (sitio público), < 250 KB (admin).
   - Edge cold start < 200 ms.
7. **Seguridad**:
   - CSP con nonces, rate limit, HMAC en webhooks, secrets en env, anon analytics.
   - OWASP top 10 manual review.
8. **Deploy**:
   - `vercel deploy` → URL viva en < 60 s con env de Neon.
   - Custom domain con auto-SSL en < 5 min.

---

## 11. Archivos críticos a crear (referencia)

- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `lefthook.yml`, `commitlint.config.ts`.
- `apps/web/{next.config.ts, app/layout.tsx, middleware.ts}`.
- `packages/db/{schema.ts, client.ts, seed.ts, index.ts}`.
- `packages/auth/index.ts` (Better-Auth config).
- `packages/permissions/abac.ts`.
- `packages/ai/{provider.ts, prompts.ts, actions.ts}`.
- `packages/blocks/registry.ts` (mapeo bloque editor ↔ render público ↔ builder).
- `packages/storage/index.ts` (adapter).
- `packages/search/{fts.ts, vector.ts, hybrid.ts}`.
- `packages/seo/{meta.ts, og.tsx, jsonld.ts}`.
- `packages/importers/{wordpress.ts, notion.ts, markdown.ts}`.
- `packages/sdk/index.ts` (auto-generado).
- `packages/cli/{bin.ts, commands/*.ts}`.
- `apps/web/components/editor/{Editor.tsx, SlashMenu.tsx, AIInline.tsx, Comments.tsx}`.
- `apps/web/components/builder/{Canvas.tsx, BlockPalette.tsx, Inspector.tsx}`.
- `apps/web/components/admin/{CommandPalette.tsx, Sidebar.tsx, DataTable.tsx, KanbanWorkflow.tsx, EditorialCalendar.tsx, AskCSM.tsx, LiveEditOverlay.tsx}`.
- `apps/web/themes/{magazine,portfolio,docs,storefront,newsletter}/index.tsx`.
- `apps/web/app/(public)/[locale]/[[...slug]]/page.tsx`.
- `apps/web/app/api/{auth/[...all],v1/[...path],graphql,ai,search,og/[id],ingest/[event]}/route.{ts,tsx}`.
- `apps/web/app/sitemap.ts`, `robots.ts`, `manifest.ts`, `feed.{xml,atom,json}/route.ts`.
- `tasks/todo.md`, `tasks/lessons.md` (regla global).

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scope explota | Fases estrictas. Cada fase deja sistema utilizable. Si una sesión se queda corta, te aviso y guardo estado. |
| Costo IA en demo | Default Groq free; si no hay key, mock determinista. |
| Vendor lock | Adapter en storage e IA. |
| Multi-tenant mal hecho | Helper `withWorkspace` obligatorio + tests aislamiento. |
| Editor lento con docs grandes | Tiptap virtualization + autosave debounced + diff-only revisions. |
| SEO en SPA | RSC + ISR para sitio público. |
| Compatibilidad Windows | pnpm + scripts cross-platform; nada de bash-only. |
| Stripe sin cuenta | Memberships off-by-default si falta key. |
| Embeddings caros | Solo on-publish + cron diario para huérfanas. |
| Liveblocks free limit | Y.js self-host como fallback. |

---

## 13. KPIs del producto (cuándo decimos que es ESPECTACULAR)

- 🟢 Onboarding < 60 s del registro al primer post publicado.
- 🟢 Lighthouse 100/100/100/100 en sitio público.
- 🟢 Bundle público < 90 KB.
- 🟢 Tiempo de respuesta IA inline < 1 s p50.
- 🟢 0 errores TS, 0 warnings, 0 issues a11y.
- 🟢 Cobertura tests críticos > 80%.
- 🟢 README con GIF que hace decir "wow".
- 🟢 Deploy en < 60 s con un click.

---

## 14. Plan de ejecución tras aprobar

Al salir de plan mode procederé en este orden, sin pedir confirmación intermedia (a menos que aparezca decisión arquitectónica nueva):

1. **Crear `tasks/todo.md` y `tasks/lessons.md`** con todas las fases y subtareas (regla global obligatoria).
2. **Bootstrap (Fase 0)**: monorepo + Next.js + Drizzle + Better-Auth + Tailwind v4 + shadcn + Biome + CI.
3. **Avanzar fase a fase**, marcando progreso en `tasks/todo.md` y registrando aprendizajes en `tasks/lessons.md`.
4. **Recap breve** al final de cada fase con qué quedó funcional y siguiente paso.

Si en alguna sesión el alcance se desborda, te aviso, dejo el sistema funcional y propongo continuar.

---

## 15. Resumen ejecutivo (para mostrar al equipo / inversor)

> **CSM** es un CMS open-source que reemplaza a WordPress, Strapi y Sanity con una sola plataforma moderna. Editor estilo Notion, page builder estilo Framer, IA nativa con búsqueda semántica, memberships con Stripe, newsletter integrada, A/B testing, importadores y live-edit on production. Type-safe end-to-end. Stack 100% gratis para arrancar. Deploy en un click. UI espectacular en español. Construido sobre Next.js 15 + React 19 + Drizzle + Better-Auth + Tiptap + Tailwind v4 + Tremor + pgvector. Hecho para sentirse rápido, verse increíble y escalar de un blog hasta una plataforma de medios.
