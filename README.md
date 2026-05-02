# ✦ CSM — Content Spectacular Machine

> **El CMS open-source que reemplaza a WordPress.**
> Publica como en Notion. Diseña como en Framer. Escala como Vercel. Mide como Linear.

[![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ¿Qué es CSM?

Un **CMS moderno, AI-native, headless-first y multi-tenant** que combina lo mejor de:

- **Notion** — editor de bloques con slash commands y AI inline.
- **Framer** — page builder visual con drag-drop y breakpoints.
- **Sanity** — schemas custom drag-drop, headless real.
- **Ghost** — memberships con paywall + newsletter integrada.
- **Linear / Vercel** — densidad, atajos, motion, estética.
- **Algolia** — búsqueda semántica con `pgvector`.

### Diferenciadores top

- ✨ Editor Notion-like (Tiptap) con 20+ bloques.
- 🤖 IA inline ⌘J: continuar, mejorar, traducir, alt-text, voice-to-content.
- 🔍 Búsqueda híbrida BM25 + cosine + chat RAG "Ask CSM".
- 🎨 5 temas espectaculares (Magazine, Portfolio, Docs, Storefront, Newsletter).
- 💸 Memberships con Stripe, paywall por bloque (no toda la página).
- 📨 Newsletter integrada estilo Substack.
- 🧪 A/B testing nativo + personalización por reglas.
- 🧩 Custom Collections drag-drop.
- 🌳 Branching de contenido tipo Git.
- 🪄 Live-edit on production (click → editar → publicar).
- 📥 Importadores WP / Notion / Markdown / Ghost.
- 🛡 GDPR, 2FA, passkeys, audit log, backups.

> Ver el plan completo: [`MEGA PLAN`](./MEGA_PLAN.md) · 50 razones para olvidarte de WordPress.

---

## 🚀 Setup en 90 segundos

```bash
# 1. Clona y entra
git clone <repo> csm && cd csm

# 2. Instala dependencias
npm install

# 3. Configura entorno
cp .env.example .env
# (rellena DATABASE_URL — Neon free tier va perfecto)

# 4. Sincroniza schema
npm run db:push

# 5. Siembra datos demo
npm run db:seed

# 6. Arranca
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y dirígete a `/admin`.

> Sin `DATABASE_URL` la landing pública igual arranca; el admin se desactiva *gracefully*.

---

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 + React 19 (App Router, RSC, Server Actions) |
| Lenguaje | TypeScript strict |
| ORM / DB | Drizzle ORM + PostgreSQL + pgvector |
| Auth | Better-Auth (email+pass, OAuth, magic-link, passkeys, 2FA) |
| Editor | Tiptap v3 + Novel + Y.js |
| UI | Tailwind v4 (OKLCH) + shadcn/ui + Radix + Framer Motion |
| Charts | Tremor + Recharts + visx |
| IA | Groq (default) + Anthropic / OpenAI / Mistral / Ollama |
| Email | Resend + react-email |
| Storage | UploadThing ↔ Vercel Blob ↔ S3 ↔ local |
| Pagos | Stripe (memberships) |
| Lint | Biome |
| Tests | Vitest + Playwright |
| Deploy | Vercel + Neon (free tier) |

---

## 📂 Estructura

```
src/
├─ app/                 # Next.js App Router
│  ├─ (admin)/          # Panel privado
│  ├─ (auth)/           # Login/registro/invitaciones
│  ├─ (public)/         # Sitio público con temas
│  ├─ api/              # REST + GraphQL + AI + webhooks
│  ├─ admin/            # Placeholder admin landing
│  ├─ globals.css       # Tokens OKLCH + utilities
│  └─ layout.tsx
├─ components/
│  ├─ ui/               # Primitivas (shadcn-style)
│  ├─ admin/            # Sidebar, CommandPalette, DataTable...
│  ├─ editor/           # Tiptap + SlashMenu + AIInline
│  ├─ builder/          # Page builder visual
│  ├─ public/           # Render público de bloques
│  └─ marketing/        # Landing components
├─ db/                  # Drizzle schema + client + seed
├─ auth/                # Better-Auth config
├─ ai/                  # Adapters Groq/Anthropic/OpenAI
├─ blocks/              # Registry editor ↔ render ↔ builder
├─ search/              # FTS + pgvector + híbrido
├─ storage/             # Adapter de subida
├─ seo/                 # Meta + OG + JSON-LD
├─ themes/              # 5 temas públicos
└─ lib/                 # Utils
tasks/                  # todo.md + lessons.md (vivos)
drizzle/                # migrations
```

---

## 🗺 Roadmap (11 fases)

- [x] **Fase 0** — Bootstrap (stack, tokens, layouts, schema)
- [ ] **Fase 1** — Auth + Multi-tenant + Onboarding mágico
- [ ] **Fase 2** — Dashboard + Editor + Posts + Live Preview
- [ ] **Fase 3** — Media Library + DAM (con IA)
- [ ] **Fase 4** — Collections Builder + Pages + Symbols
- [ ] **Fase 5** — Sitio público + 5 temas + SEO + OG
- [ ] **Fase 6** — IA + Búsqueda semántica + Comentarios
- [ ] **Fase 7** — APIs + Webhooks + Forms + CLI/SDK
- [ ] **Fase 8** — Newsletter + Memberships + A/B + Live-Edit
- [ ] **Fase 9** — Importadores + Branching + Calendar
- [ ] **Fase 10** — Pulido + Performance + Seguridad + Deploy

Ver `tasks/todo.md` para el detalle vivo.

---

## 📦 Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir build |
| `npm run lint` | Biome check |
| `npm run format` | Biome format |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sincronizar schema con DB |
| `npm run db:generate` | Generar migraciones |
| `npm run db:studio` | Drizzle Studio (GUI) |
| `npm run db:seed` | Sembrar datos demo |

---

## 🤝 Contribuir

Lee `tasks/lessons.md` para entender decisiones tomadas. Cada PR debería pasar `npm run typecheck && npm run lint && npm run build`.

---

## 📄 Licencia

MIT © 2026 — hecho con cariño en español.
