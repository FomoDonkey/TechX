/**
 * Sección Stack — solo dependencias técnicas reales del proyecto, no comparativas
 * con CMS competidores. El stack es información honesta para developers.
 */
const stack = [
  { name: "Next.js 15", role: "Framework full-stack" },
  { name: "React 19", role: "Server Components" },
  { name: "TypeScript", role: "Strict mode" },
  { name: "Drizzle ORM", role: "SQL-first, multi-dialect" },
  { name: "PostgreSQL", role: "Postgres / MySQL" },
  { name: "pgvector", role: "Búsqueda semántica" },
  { name: "Better-Auth", role: "Auth + passkeys + 2FA" },
  { name: "Tiptap v3", role: "Editor de bloques" },
  { name: "Y.js", role: "Co-edición + cursors" },
  { name: "Tailwind v4", role: "OKLCH + container queries" },
  { name: "shadcn/ui", role: "Primitivas accesibles" },
  { name: "Framer Motion", role: "Animaciones" },
  { name: "Tremor", role: "Charts del dashboard" },
  { name: "Resend", role: "Email transaccional" },
  { name: "Stripe", role: "Memberships" },
  { name: "Biome", role: "Lint + format 10×" },
];

export function Stack() {
  return (
    <section id="stack" className="mx-auto max-w-6xl px-4 py-32">
      <div className="mb-12 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Construido sobre <span className="gradient-text">lo mejor de 2026</span>
        </h2>
        <p className="mt-3 text-muted-foreground">
          Stack moderno, type-safe end-to-end. 100% gratis para arrancar.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {stack.map((s) => (
          <div
            key={s.name}
            className="group relative flex items-center gap-2 rounded-full border bg-card/60 px-4 py-2 text-sm shadow-sm backdrop-blur transition-all hover:border-primary/40 hover:shadow-md"
          >
            <span className="size-1.5 rounded-full bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))]" />
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">· {s.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
