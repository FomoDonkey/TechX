import { Check, Circle } from "lucide-react";

const phases = [
  {
    id: 0,
    title: "Bootstrap",
    desc: "Monorepo, Next.js 15, Tailwind v4, Drizzle, Better-Auth, CI",
    done: true,
  },
  {
    id: 1,
    title: "Auth + Onboarding mágico",
    desc: "Login, AI Site Generator, workspaces, invitaciones, ABAC",
    done: false,
  },
  {
    id: 2,
    title: "Dashboard + Editor + Posts",
    desc: "KPIs, DataTable, Tiptap completo, autosave, revisiones, render público",
    done: false,
  },
  {
    id: 3,
    title: "Media Library + DAM",
    desc: "Uploader, blurhash, AI bg-removal, AI image gen, MediaPicker",
    done: false,
  },
  {
    id: 4,
    title: "Collections Builder + Pages + Symbols",
    desc: "Schema builder, page builder Framer-style, Symbols",
    done: false,
  },
  {
    id: 5,
    title: "Sitio público + 5 temas + SEO",
    desc: "Magazine, Portfolio, Docs, Storefront, Newsletter + OG dinámico",
    done: false,
  },
  {
    id: 6,
    title: "IA + búsqueda semántica + Comentarios",
    desc: "AI inline ⌘J, voice, embeddings pgvector, Ask CSM, smart linking",
    done: false,
  },
  {
    id: 7,
    title: "APIs + Webhooks + Forms + CLI/SDK",
    desc: "REST + GraphQL + OpenAPI, automations, forms builder, CLI",
    done: false,
  },
  {
    id: 8,
    title: "Newsletter + Memberships + A/B + Live-Edit",
    desc: "Stripe paywall, A/B nativo, personalización, live-edit on prod",
    done: false,
  },
  {
    id: 9,
    title: "Importadores + Branching + Calendar",
    desc: "WP/Notion/MD importers, content branching, editorial calendar",
    done: false,
  },
  {
    id: 10,
    title: "Pulido + Performance + Deploy",
    desc: "PWA, GDPR, 2FA, backups, Lighthouse 100, 1-click deploy",
    done: false,
  },
];

export function Roadmap() {
  return (
    <section id="fases" className="mx-auto max-w-4xl px-4 py-32">
      <div className="mb-12 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Roadmap de <span className="gradient-text">11 fases</span>
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
