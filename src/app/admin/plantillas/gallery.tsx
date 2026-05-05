"use client";

import { createPageFromTemplateAction } from "@/app/admin/paginas/_actions";
import { PreviewIframe } from "@/blocks/motion-hero/preview-iframe";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PageTemplate,
  PageTemplateCategory,
  TEMPLATE_CATEGORIES as TemplateCategoriesType,
} from "@/templates/page-templates";
import { motion } from "framer-motion";
import { ArrowRight, Filter, Layout, Search, Sparkles, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  category: PageTemplate["category"];
  accent: PageTemplate["accent"];
  tags: string[];
  suggestedTitle: string;
  blockCount: number;
};

type Cat = (typeof TemplateCategoriesType)[number];

type Props = {
  templates: TemplateSummary[];
  categories: ReadonlyArray<Cat>;
  errorMsg: string | null;
};

/** Paleta de gradient + emoji grande por accent (preview thumb). */
const ACCENT_THEME: Record<
  PageTemplate["accent"],
  { gradient: string; emoji: string; glow: string }
> = {
  aurora: {
    gradient: "from-violet-500 via-fuchsia-500 to-cyan-400",
    emoji: "🌌",
    glow: "shadow-[0_0_60px_-15px_rgba(155,92,255,0.55)]",
  },
  magnetic: {
    gradient: "from-rose-500 via-orange-400 to-amber-300",
    emoji: "🧲",
    glow: "shadow-[0_0_60px_-15px_rgba(244,114,182,0.55)]",
  },
  spotlight: {
    gradient: "from-slate-700 via-slate-900 to-black",
    emoji: "🔦",
    glow: "shadow-[0_0_60px_-15px_rgba(156,163,175,0.45)]",
  },
  typewriter: {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    emoji: "⌨️",
    glow: "shadow-[0_0_60px_-15px_rgba(45,212,191,0.55)]",
  },
  marquee: {
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    emoji: "🎞️",
    glow: "shadow-[0_0_60px_-15px_rgba(139,92,246,0.55)]",
  },
  particles: {
    gradient: "from-blue-600 via-indigo-700 to-violet-900",
    emoji: "✨",
    glow: "shadow-[0_0_60px_-15px_rgba(96,165,250,0.55)]",
  },
};

const CATEGORY_LABEL: Record<PageTemplateCategory, string> = {
  saas: "SaaS",
  portfolio: "Portfolio",
  blog: "Blog",
  newsletter: "Newsletter",
  launch: "Lanzamiento",
};

export function TemplatesGallery({ templates, categories, errorMsg }: Props) {
  const [activeCategory, setActiveCategory] = useState<Cat["value"]>("all");
  const [query, setQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const searchId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (!q) return true;
      const hay = `${t.name} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, activeCategory, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <header className="mb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[11px] font-medium text-primary backdrop-blur"
        >
          <Sparkles className="size-3" />
          {templates.length} plantillas espectaculares · todas editables
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-balance font-display text-4xl font-bold tracking-tight md:text-6xl"
        >
          Empieza con un{" "}
          <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 bg-clip-text text-transparent">
            diseño espectacular
          </span>
          <br />y personalízalo a tu marca.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg"
        >
          Cada plantilla combina hero animados, secciones pre-construidas y CTAs probados. Click,
          insertar, editar — sin empezar de cero.
        </motion.p>
      </header>

      {errorMsg ? (
        <div className="mb-8 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decodeURIComponent(errorMsg)}
        </div>
      ) : null}

      {/* Filtros + search */}
      <div className="sticky top-14 z-20 -mx-4 mb-10 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1.5 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Filter className="size-3" /> Categoría
            </span>
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setActiveCategory(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  activeCategory === c.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label
            htmlFor={searchId}
            className="relative flex items-center gap-2 rounded-full border border-border bg-card/40 px-3.5 py-1.5 text-sm transition-colors focus-within:border-primary/50 md:w-72"
          >
            <Search className="size-3.5 text-muted-foreground" />
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o tag…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Limpiar"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
        </div>
      </div>

      {/* Grid de templates */}
      {filtered.length === 0 ? (
        <div className="mx-auto max-w-md py-20 text-center text-muted-foreground">
          <Layout className="mx-auto mb-3 size-8 opacity-40" />
          <p className="text-sm">Ninguna plantilla coincide con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => {
            const theme = ACCENT_THEME[t.accent];
            const isHovered = hoveredId === t.id;
            return (
              <motion.article
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur transition-all duration-300",
                  "hover:-translate-y-1 hover:border-primary/40",
                  isHovered && theme.glow,
                )}
              >
                {/* Preview LIVE: iframe scaled-down con la plantilla real renderizada */}
                <div
                  className={cn(
                    "relative aspect-[16/10] overflow-hidden",
                    "[&>*]:pointer-events-none",
                  )}
                >
                  <PreviewIframe templateId={t.id} force={isHovered} />

                  {/* Glow orb superpuesto al hover para reforzar la acción */}
                  <motion.div
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 0.5 : 0 }}
                    className={cn(
                      "absolute -bottom-20 -right-20 size-60 rounded-full blur-3xl",
                      `bg-gradient-to-br ${theme.gradient} opacity-60`,
                    )}
                  />

                  {/* Tag de categoría flotante */}
                  <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
                    {CATEGORY_LABEL[t.category]}
                  </div>

                  {/* Emoji accent pequeño esquina derecha */}
                  <div className="absolute right-3 top-3 z-10 text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {theme.emoji}
                  </div>

                  {/* Block count chip abajo */}
                  <div className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                    <Layout className="size-2.5" /> {t.blockCount}{" "}
                    {t.blockCount === 1 ? "bloque" : "bloques"}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold tracking-tight">{t.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {t.description}
                  </p>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <form action={createPageFromTemplateAction} className="mt-5">
                    <input type="hidden" name="templateId" value={t.id} />
                    <Button
                      type="submit"
                      variant="gradient"
                      className="group/btn w-full justify-center gap-1.5 rounded-xl"
                    >
                      Usar esta plantilla
                      <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                  </form>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-sm text-muted-foreground backdrop-blur">
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-400">
          <Sparkles className="size-3.5" />
          Cómo funcionan las plantillas
        </p>
        <p className="leading-relaxed">
          El <strong className="text-foreground">preview</strong> que ves al hacer hover es la
          versión <em>espectacular</em> de la plantilla — con vídeo, parallax, marquees y todos los
          efectos. Al pulsar <strong className="text-foreground">Usar esta plantilla</strong> se
          inserta una versión <strong className="text-foreground">editable simplificada</strong>{" "}
          que puedes adaptar a tu marca desde el page builder. Para una réplica fiel del preview,
          contacta con <code className="rounded bg-muted/60 px-1.5 py-0.5">/agente</code>.
        </p>
      </div>
    </div>
  );
}
