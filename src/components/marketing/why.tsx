import {
  Bot,
  GitBranch,
  Heart,
  Plug,
  ShieldCheck,
  type Sparkles,
  Users,
  Wand2,
  Zap,
} from "lucide-react";

/**
 * Sección "Por qué techx" — propuesta de valor en bloques visuales.
 * Sin comparativas explícitas con competidores: lo que ofrecemos, cómo se siente
 * y por qué importa.
 */

const PILLARS: Array<{
  icon: typeof Sparkles;
  title: string;
  body: string;
  emphasis: string;
}> = [
  {
    icon: Wand2,
    title: "Builder con IA conversacional",
    body: "Describe tu sitio en una frase y lo construye desde cero. Pide cambios sin tocar código. Reescribe posts, ajusta paletas, añade contenido — siempre en lenguaje natural.",
    emphasis: "Único en CMS open-source.",
  },
  {
    icon: Users,
    title: "Edición colaborativa real",
    body: "Cursores remotos, presence en todo el admin, comentarios con reacciones live. Following mode para acompañar a un compañero en su flujo. Sin servicio externo: corre en tu Postgres.",
    emphasis: "Self-hosted sin friction.",
  },
  {
    icon: Plug,
    title: "MCP server nativo",
    body: "Cualquier agente de IA gestiona tu contenido como tools. Conéctalo a Claude Desktop, Cursor, VS Code. CLI que detecta el cliente y configura solo.",
    emphasis: "Tu CMS, en tu IDE.",
  },
  {
    icon: GitBranch,
    title: "Branching de contenido",
    body: "Ramas tipo Git para preparar releases editoriales completos. Merge con diff visual. Revertir con un click. Preview por rama con URL firmada.",
    emphasis: "Zero-fear publishing.",
  },
  {
    icon: Bot,
    title: "Agente editorial in-product",
    body: "Chat con tool-use que opera tu workspace: crea drafts, busca contenido, escanea SEO, programa publicaciones. Audit log siempre apunta al humano detrás.",
    emphasis: "El copiloto que ya esperabas.",
  },
  {
    icon: Heart,
    title: "Content Health Scan",
    body: "Cron weekly que escanea SEO, alt-text, jerarquía de headings, contenido fino, fechas obsoletas. Score 0-100 transparente con issues accionables.",
    emphasis: "Lighthouse para contenido.",
  },
  {
    icon: ShieldCheck,
    title: "Confianza enterprise",
    body: "2FA TOTP + Passkeys WebAuthn. GDPR export ZIP completo y derecho al olvido. CSP estricta con Reporting API. AI cost cap por workspace. Audit log exportable.",
    emphasis: "Auditoría OWASP Top-10 limpia.",
  },
  {
    icon: Zap,
    title: "Stack moderno, sin plugins",
    body: "Type-safe end-to-end. REST + GraphQL + SDK + CLI auto-generados desde tu schema. Edge runtime en sitio público. Multi-dialect Postgres/MySQL.",
    emphasis: "Cero PHP, cero parches.",
  },
];

export function WhyCSM() {
  return (
    <section id="diferencia" className="mx-auto max-w-6xl px-4 py-32">
      <div className="mb-16 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Lo que hace a <span className="gradient-text">techx</span> distinto
        </h2>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          Ocho razones por las que tu equipo editorial se va a sentir como en casa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PILLARS.map(({ icon: Icon, title, body, emphasis }) => (
          <article
            key={title}
            className="group relative overflow-hidden rounded-2xl border bg-card/40 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            <div className="absolute -right-12 -top-12 size-40 rounded-full bg-[radial-gradient(circle,oklch(from_var(--brand-1)_l_c_h_/_0.18),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(120deg,oklch(from_var(--brand-1)_l_c_h_/_0.18),oklch(from_var(--brand-2)_l_c_h_/_0.18))] text-primary">
              <Icon className="size-5" />
            </div>
            <h3 className="mb-1 font-semibold tracking-tight">{title}</h3>
            <p className="mb-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <p className="text-xs font-medium tracking-tight text-[var(--brand-1)]">{emphasis}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
