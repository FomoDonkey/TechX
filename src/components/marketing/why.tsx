import { Check, X } from "lucide-react";

const rows: Array<{
  feature: string;
  csm: string | true;
  wp: string | false;
}> = [
  { feature: "Editor", csm: "Notion-like (Tiptap)", wp: "Gutenberg lento" },
  { feature: "Page Builder visual", csm: "Sí (estilo Framer)", wp: "Plugins de pago" },
  { feature: "IA nativa", csm: "Inline ⌘J + RAG + voice", wp: "Plugins externos" },
  { feature: "Búsqueda semántica", csm: "pgvector + FTS", wp: false },
  { feature: "Multi-tenant", csm: "Día 1", wp: "Multisite con dolor" },
  { feature: "Headless API", csm: "REST + GraphQL + SDK + CLI", wp: "REST viejo" },
  { feature: "Type-safe", csm: "End-to-end TypeScript", wp: "PHP" },
  { feature: "Performance", csm: "Lighthouse 100", wp: "60-80 con suerte" },
  { feature: "Memberships + Stripe", csm: "Paywall por bloque", wp: "Plugin de pago" },
  { feature: "Newsletter integrada", csm: "Sí, tipo Substack", wp: "Plugin externo" },
  { feature: "A/B testing", csm: "Nativo", wp: "Plugin de pago" },
  { feature: "Branching de contenido", csm: "Tipo Git", wp: false },
  { feature: "Live-edit on production", csm: "Click → editar", wp: false },
  { feature: "Stack moderno", csm: "Next.js 15 + RSC", wp: "PHP + jQuery" },
];

export function WhyCSM() {
  return (
    <section id="por-que" className="mx-auto max-w-5xl px-4 py-32">
      <div className="mb-12 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          CSM <span className="gradient-text">vs</span> WordPress
        </h2>
        <p className="mt-3 text-muted-foreground">Mismo problema. Solución 20 años más joven.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card/40 backdrop-blur">
        <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b bg-secondary/40 px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <div>Característica</div>
          <div className="text-center">
            <span className="gradient-text font-bold">CSM</span>
          </div>
          <div className="text-center">WordPress</div>
        </div>
        {rows.map((row, idx) => (
          <div
            key={row.feature}
            className={`grid grid-cols-[1.4fr_1fr_1fr] items-center px-6 py-4 text-sm ${
              idx % 2 === 0 ? "" : "bg-secondary/20"
            }`}
          >
            <div className="font-medium">{row.feature}</div>
            <div className="flex items-center justify-center gap-2 text-center">
              <Check className="size-4 shrink-0 text-success" />
              <span>{typeof row.csm === "string" ? row.csm : ""}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-center text-muted-foreground">
              {row.wp === false ? (
                <X className="size-4 shrink-0 text-destructive" />
              ) : (
                <span className="text-xs italic">{row.wp}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
