import { Check, Circle } from "lucide-react";

const phases: Array<{ id: string; title: string; desc: string; done: boolean }> = [
  {
    id: "0",
    title: "Bootstrap",
    desc: "Monorepo, Next.js 15, Tailwind v4, Drizzle, Better-Auth, CI.",
    done: true,
  },
  {
    id: "1",
    title: "Auth + Onboarding mágico",
    desc: "Login, AI Site Generator, workspaces, invitaciones, ABAC.",
    done: true,
  },
  {
    id: "2",
    title: "Dashboard + Editor + Posts",
    desc: "KPIs, DataTable, editor de bloques completo, autosave, revisiones, render público.",
    done: true,
  },
  {
    id: "3",
    title: "Media Library + DAM",
    desc: "Uploader, blurhash, AI bg-removal, AI image gen, MediaPicker.",
    done: true,
  },
  {
    id: "4",
    title: "Collections Builder + Pages + Symbols",
    desc: "Schema builder, page builder visual, Symbols reusables, Live-Edit overlay.",
    done: true,
  },
  {
    id: "5",
    title: "Sitio público + 5 temas + SEO",
    desc: "Magazine, Portfolio, Docs, Storefront, Newsletter. OG dinámico, sitemap, RSS.",
    done: true,
  },
  {
    id: "6",
    title: "IA + búsqueda semántica + Comentarios",
    desc: "AI inline ⌘J, voice-to-content, embeddings pgvector, chat RAG, smart linking, moderación.",
    done: true,
  },
  {
    id: "7",
    title: "APIs + Webhooks + Forms + CLI/SDK",
    desc: "REST + GraphQL + OpenAPI, automations, forms builder, CLI propia, SDK tipado.",
    done: true,
  },
  {
    id: "8",
    title: "Newsletter + Memberships + A/B + Live-Edit",
    desc: "Stripe paywall por bloque, A/B nativo con allocation determinista, live-edit on prod.",
    done: true,
  },
  {
    id: "9",
    title: "Importadores + Branching + Calendar editorial",
    desc: "Importers universales, content branching tipo Git, calendar + workflows + SLA.",
    done: true,
  },
  {
    id: "10a",
    title: "Seguridad enterprise",
    desc: "2FA TOTP + Passkeys, GDPR export, CSP, BotID, AI cost cap, audit log, OWASP audit.",
    done: true,
  },
  {
    id: "10b",
    title: "Realtime Collaborative Editing",
    desc: "Y.js + cursors, presence global en TODO el admin, following mode, reactions live, mentions email.",
    done: true,
  },
  {
    id: "10c",
    title: "MCP server + Agente IA + Content Health",
    desc: "MCP server con tools expuestas a agentes externos, agente conversacional, Content Health scan semanal.",
    done: true,
  },
  {
    id: "10g",
    title: "Builder conversacional",
    desc: "Construye sitios desde un prompt. Chat persistente para refinar. Preview en vivo con breakpoints. Provider-agnostic.",
    done: true,
  },
  {
    id: "10d",
    title: "Performance + PWA + Edge",
    desc: "Lighthouse 100×4 con CI gate, bundle analyzer, dynamic imports admin, PWA + offline drafts, RUM propio.",
    done: false,
  },
  {
    id: "10e",
    title: "Operability + Scale",
    desc: "Backups diarios pg_dump → Blob, retention policies, paginación cursor, branch restore, audit export CSV.",
    done: false,
  },
  {
    id: "10f",
    title: "Launch polish + Demo",
    desc: "Seed espectacular, README con GIFs, Deploy button, vercel.ts, video walkthrough.",
    done: false,
  },
];

export function Roadmap() {
  return (
    <section id="fases" className="mx-auto max-w-4xl px-4 py-32">
      <div className="mb-12 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Roadmap · <span className="gradient-text">14 de 17 fases listas</span>
        </h2>
        <p className="mt-3 text-muted-foreground">
          Cada fase deja el sistema utilizable y deployable.
        </p>
      </div>

      <ol className="relative space-y-4 border-l border-dashed border-border pl-8">
        {phases.map((p) => (
          <li key={p.id} className="relative">
            <span className="absolute -left-[2.55rem] top-1 grid size-6 place-items-center rounded-full border bg-background">
              {p.done ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Circle className="size-3 text-muted-foreground" />
              )}
            </span>
            <div className="rounded-xl border bg-card/40 p-4 backdrop-blur transition-colors hover:bg-card/80">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  <span className="mr-2 text-xs text-muted-foreground">Fase {p.id}</span>
                  {p.title}
                </h3>
                {p.done && (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    Hecho
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
