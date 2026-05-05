import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Boxes,
  Brain,
  Code2,
  GitBranch,
  Globe2,
  Heart,
  Image as ImageIcon,
  Mail,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Editor Notion-like",
    desc: "Slash commands, bloques, drag, embeds, callouts, columnas, tablas, código con Shiki, diagramas Excalidraw.",
  },
  {
    icon: Brain,
    title: "IA inline ⌘J",
    desc: "Continuar, mejorar, traducir, fix gramática, generar excerpt, sugerir título SEO, alt-text desde imagen, voice-to-content.",
  },
  {
    icon: Boxes,
    title: "Page Builder visual",
    desc: "Drag-drop estilo Framer con breakpoints, snap a grid, hover states, click-to-edit y Symbols reusables.",
  },
  {
    icon: Search,
    title: "Búsqueda semántica",
    desc: "pgvector + FTS híbrido (BM25 + cosine). Ask CSM chat RAG sobre tu propio contenido. Smart internal linking.",
  },
  {
    icon: ImageIcon,
    title: "Asset DAM con IA",
    desc: "Background removal, AI image gen (Flux), tags automáticos, smart focal crop, blurhash, AVIF/WebP responsive.",
  },
  {
    icon: Globe2,
    title: "Multi-idioma + multi-tenant",
    desc: "Workspaces desde día 1. Locales estructurales con traducciones enlazadas. Custom domains con auto-SSL.",
  },
  {
    icon: Mail,
    title: "Newsletter + Memberships",
    desc: "Suscriptores, segmentos, campañas, drip. Stripe paywall por bloque (no toda la página). Tipo Substack.",
  },
  {
    icon: Workflow,
    title: "Workflows & Automations",
    desc: "Draft → review → published con asignaciones. Webhooks firmados. Automations Zapier-light. A/B testing nativo.",
  },
  {
    icon: GitBranch,
    title: "Branching de contenido",
    desc: "Ramas tipo Git para preparar releases editoriales. Merge con diff visual estilo Google Docs. Revertir.",
  },
  {
    icon: Code2,
    title: "Headless first",
    desc: "REST + GraphQL + OpenAPI auto-generado. SDK TypeScript tipado. CLI csm para scaffold de proyectos.",
  },
  {
    icon: Users,
    title: "Realtime collab self-hosted",
    desc: "Y.js + cursores remotos + presence en TODO el admin (no solo el editor). Hot Right Now widget. Following mode. Reactions live en comentarios. Sin Hocuspocus extra.",
  },
  {
    icon: Plug,
    title: "MCP Server nativo",
    desc: "14 tools expuestas a Claude Desktop, Cursor, VS Code y agentes externos. Stdio + Streamable HTTP. CLI csm mcp install detecta y configura el cliente automáticamente.",
  },
  {
    icon: Bot,
    title: "Agente IA in-product",
    desc: "Chat conversacional dentro del admin con tool-use loop Anthropic puro. Reusa los 14 tools del MCP server. Auditoría apunta al user real.",
  },
  {
    icon: Heart,
    title: "Content Health Scan",
    desc: "Cron weekly que escanea SEO, alt-text, jerarquía de headings, contenido fino, fechas obsoletas. Score 0-100 transparente. Único en CMS open-source.",
  },
  {
    icon: ShieldCheck,
    title: "Confianza enterprise",
    desc: "2FA TOTP + Passkeys WebAuthn. GDPR export ZIP completo. CSP estricta + Reporting API. BotID. AI cost cap. Audit log. OWASP top-10 audit clean.",
  },
];

export function Features() {
  return (
    <section id="caracteristicas" className="mx-auto max-w-6xl px-4 py-32">
      <div className="mb-16 text-center">
        <h2 className="text-balance font-display text-4xl font-bold tracking-tight md:text-5xl">
          Todo lo que esperas. Y un montón de cosas que{" "}
          <span className="gradient-text">no esperabas</span>.
        </h2>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          50 razones para olvidarte de WordPress. Aquí van 12.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <Card
            key={title}
            className="group relative overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(400px circle at var(--mx,50%) var(--my,0%), oklch(from var(--primary) l c h / 0.12), transparent 40%)",
                }}
              />
            </div>
            <CardContent className="p-6">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(120deg,oklch(from_var(--brand-1)_l_c_h_/_0.15),oklch(from_var(--brand-2)_l_c_h_/_0.15))] text-primary">
                <Icon className="size-5" />
              </div>
              <CardTitle className="mb-2">{title}</CardTitle>
              <CardDescription className="leading-relaxed">{desc}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
