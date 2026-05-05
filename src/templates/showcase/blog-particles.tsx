"use client";

/**
 * Showcase: Blog Magazine paper — editorial cálido tipo The New Yorker.
 * Top masthead + featured story 2-cols + sidebar de últimos posts + grid
 * de categorías + newsletter inline. Sustituye "blog-particles".
 */

import { unsplash } from "@/templates/showcase/_lib/assets";
import { FadeIn } from "@/templates/showcase/_lib/primitives";
import { ArrowUpRight, BookOpen, Mail, Newspaper, Search } from "lucide-react";

const FEATURED = {
  category: "Producto · Análisis",
  title: "La economía del software pequeño y rentable",
  hook: "Por qué la próxima década pertenece a los productos de 2 personas con 50.000€ ARR antes que a los unicornios. Un repaso a los modelos de negocio más interesantes de 2026, con datos, fracasos y un par de vergüenzas ajenas.",
  author: "Edgar Vela",
  minutes: "8 min",
  date: "12 mar 2026",
  cover: unsplash("1499914485622-a88fac536970", 1400, 900),
};

const SIDEBAR = [
  {
    cat: "Negocio",
    title: "3 lecciones de un fracaso de 200k€",
    author: "Laura Méndez",
    minutes: "6 min",
    cover: unsplash("1521737711867-e3b97375f902", 200, 200),
  },
  {
    cat: "Diseño",
    title: "Diseñar para el silencio: por qué menos no es siempre menos",
    author: "Carlos Vega",
    minutes: "4 min",
    cover: unsplash("1517245386807-bb43f82c33c4", 200, 200),
  },
  {
    cat: "Ingeniería",
    title: "Por qué Postgres y nada más en 2026",
    author: "Sara P.",
    minutes: "12 min",
    cover: unsplash("1489875347897-49f64b51c1f8", 200, 200),
  },
  {
    cat: "Cultura",
    title: "Los rituales de equipo que sí funcionan",
    author: "Diego R.",
    minutes: "5 min",
    cover: unsplash("1522071820081-009f0129c71c", 200, 200),
  },
];

const CATEGORIES = [
  { name: "Producto", count: 42, color: "#c2410c" },
  { name: "Diseño", count: 38, color: "#a16207" },
  { name: "Ingeniería", count: 64, color: "#365314" },
  { name: "Negocio", count: 27, color: "#7c2d12" },
  { name: "Cultura", count: 19, color: "#3f3f46" },
  { name: "Entrevistas", count: 12, color: "#831843" },
];

const STORIES_GRID = [
  {
    cat: "Entrevista",
    title: "Marcos Pérez · 12 años en YCombinator",
    excerpt: "Sobre por qué la mayoría de fundadores resuelven el problema equivocado.",
    cover: unsplash("1573497019418-b400bb3ab074", 600, 800),
  },
  {
    cat: "Análisis",
    title: "El reverse-takeover de las herramientas internas",
    excerpt: "Tres casos de uso que pasaron de notion-template a empresa de 8 dígitos.",
    cover: unsplash("1454165804606-c3d57bc86b40", 600, 800),
  },
  {
    cat: "Opinión",
    title: "El día que dejé de creer en MVPs",
    excerpt: "Y por qué los fundadores deberíamos dejar de usar la palabra ya.",
    cover: unsplash("1499750310107-5fef28a66643", 600, 800),
  },
];

export function BlogParticlesShowcase() {
  return (
    <div className="csm-show-magazine csm-showcase">
      {/* ========== MASTHEAD ========== */}
      <header className="border-b-2 border-[#1d1815] bg-[#faf6ee] px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#1d1815]/60">
            <Newspaper className="size-4" />
            <span>Núm. 142 · Marzo 2026</span>
          </div>
          <div
            className="csm-display flex-1 text-center text-3xl font-bold tracking-tight text-[#1d1815] md:text-5xl"
            style={{ fontFamily: '"Newsreader", "EB Garamond", serif' }}
          >
            El Diario
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Buscar"
              className="grid size-9 place-items-center rounded-full border border-[#1d1815]/20 transition-colors hover:bg-[#1d1815]/5"
            >
              <Search className="size-4" />
            </button>
            <button
              type="button"
              className="hidden items-center gap-2 rounded-full bg-[#1d1815] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#faf6ee] transition-opacity hover:opacity-90 md:inline-flex"
            >
              Suscribirme
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-6 flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-[#1d1815]/80">
          {["Inicio", "Producto", "Diseño", "Ingeniería", "Negocio", "Cultura", "Archivo"].map(
            (n) => (
              <a key={n} href="#archivo" className="hover:text-[#1d1815] hover:underline">
                {n}
              </a>
            ),
          )}
        </nav>
      </header>

      {/* ========== FEATURED ========== */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
          <FadeIn className="md:col-span-8">
            <div className="overflow-hidden rounded-sm border border-[#1d1815]/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FEATURED.cover}
                alt=""
                className="aspect-[16/10] w-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
            <p className="mt-6 text-xs uppercase tracking-widest text-[#7c2d12]">
              {FEATURED.category}
            </p>
            <h2
              className="csm-display mt-4 text-balance font-semibold leading-[1.1] text-[#1d1815]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.6rem)" }}
            >
              {FEATURED.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#1d1815]/80 md:text-xl">
              {FEATURED.hook}
            </p>
            <div className="mt-6 flex items-center gap-4 text-xs uppercase tracking-widest text-[#1d1815]/50">
              <span>{FEATURED.author}</span>
              <span>·</span>
              <span>{FEATURED.minutes}</span>
              <span>·</span>
              <span>{FEATURED.date}</span>
            </div>
          </FadeIn>

          {/* Sidebar */}
          <aside className="md:col-span-4">
            <FadeIn className="mb-4 flex items-center gap-2 border-b border-[#1d1815]/20 pb-3 text-xs uppercase tracking-widest text-[#1d1815]/60">
              <BookOpen className="size-3.5" />
              Esta semana
            </FadeIn>
            <ul className="space-y-6">
              {SIDEBAR.map((s, i) => (
                <FadeIn
                  as="li"
                  key={s.title}
                  delay={i * 0.06}
                  className="group flex gap-4 border-b border-[#1d1815]/10 pb-6 last:border-b-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.cover} alt="" className="size-20 shrink-0 rounded-sm object-cover" />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#7c2d12]">{s.cat}</p>
                    <h3 className="csm-display mt-1.5 text-lg font-semibold leading-snug text-[#1d1815] group-hover:underline">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#1d1815]/60">
                      {s.author} · {s.minutes}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* ========== CATEGORIES ========== */}
      <section className="bg-[#1d1815] px-6 py-16 text-[#faf6ee] md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="csm-display text-3xl font-semibold md:text-5xl">Explora por tema</h2>
            <span className="text-xs uppercase tracking-widest text-[#faf6ee]/50">
              {CATEGORIES.reduce((a, b) => a + b.count, 0)} historias
            </span>
          </FadeIn>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
            {CATEGORIES.map((c, i) => (
              <FadeIn
                key={c.name}
                delay={i * 0.05}
                className="group relative cursor-pointer overflow-hidden border border-[#faf6ee]/10 p-6 transition-colors hover:border-[#faf6ee]/30 md:p-8"
              >
                <div
                  className="absolute -bottom-10 -right-10 size-40 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-60"
                  style={{ background: c.color }}
                />
                <div className="relative">
                  <p
                    className="csm-display text-3xl font-semibold md:text-5xl"
                    style={{ color: c.color }}
                  >
                    {c.name}
                  </p>
                  <p className="mt-2 text-sm text-[#faf6ee]/60">{c.count} historias</p>
                </div>
                <ArrowUpRight className="absolute right-4 top-4 size-5 text-[#faf6ee]/40 transition-all group-hover:text-[#faf6ee] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ========== STORIES GRID ========== */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-12 flex items-center justify-between">
            <h2 className="csm-display text-3xl font-semibold text-[#1d1815] md:text-5xl">
              Más esta semana
            </h2>
            <a
              href="#archivo"
              className="hidden text-sm font-medium text-[#7c2d12] hover:underline md:block"
            >
              Ver archivo completo →
            </a>
          </FadeIn>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {STORIES_GRID.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.1} className="group">
                <div className="overflow-hidden rounded-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.cover}
                    alt=""
                    className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <p className="mt-4 text-xs uppercase tracking-widest text-[#7c2d12]">{s.cat}</p>
                <h3 className="csm-display mt-2 text-xl font-semibold leading-snug text-[#1d1815] group-hover:underline md:text-2xl">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1d1815]/70">{s.excerpt}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ========== NEWSLETTER ========== */}
      <section className="bg-[#1d1815] px-6 py-20 text-[#faf6ee] md:px-10 md:py-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <FadeIn>
            <Mail className="size-8 text-[#faf6ee]/40" />
          </FadeIn>
          <FadeIn>
            <h2 className="csm-display text-balance text-4xl font-semibold md:text-6xl">
              Recibe lo mejor cada lunes.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="max-w-md text-base text-[#faf6ee]/70">
              Sin tracking, sin paywalls, sin el típico newsletter spam que nadie pidió.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <form className="mt-4 flex w-full max-w-md gap-2">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 rounded-full border border-[#faf6ee]/20 bg-transparent px-5 py-3 text-sm text-[#faf6ee] outline-none focus:border-[#faf6ee]/50"
              />
              <button
                type="submit"
                className="rounded-full bg-[#faf6ee] px-6 py-3 text-sm font-medium text-[#1d1815] transition-transform hover:scale-105"
              >
                Suscribir
              </button>
            </form>
          </FadeIn>
          <p className="mt-12 text-xs uppercase tracking-widest text-[#faf6ee]/30">
            12.840 lectores · 0% spam · cancelación 1 click
          </p>
        </div>
      </section>
    </div>
  );
}
