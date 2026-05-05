"use client";

/**
 * Secciones de la plantilla `blog-particles` (Magazine paper editorial).
 * 5 secciones: masthead, featured 2-col, categories grid, stories 3-col, newsletter inline.
 */

import { FadeIn } from "@/templates/showcase/_lib/primitives";
import { ArrowUpRight, BookOpen, Mail, Newspaper, Search } from "lucide-react";

type SidebarItem = { cat: string; title: string; author: string; minutes: string; cover: string };
type Category = { name: string; count: number; color: string };
type Story = { cat: string; title: string; excerpt: string; cover: string };

// ============================================================
// 1. MASTHEAD — header + nav links
// ============================================================
export type MagazineMastheadProps = {
  issueNumber?: string;
  publicationName?: string;
  subscribeText?: string;
  navLinks?: string[];
};

export function MagazineMasthead({
  issueNumber = "Núm. 142 · Marzo 2026",
  publicationName = "El Diario",
  subscribeText = "Suscribirme",
  navLinks = ["Inicio", "Producto", "Diseño", "Ingeniería", "Negocio", "Cultura", "Archivo"],
}: MagazineMastheadProps) {
  return (
    <div className="csm-show-magazine csm-showcase">
      <header className="border-b-2 border-[#1d1815] bg-[#faf6ee] px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#1d1815]/60">
            <Newspaper className="size-4" />
            <span>{issueNumber}</span>
          </div>
          <div
            className="csm-display flex-1 text-center text-3xl font-bold tracking-tight text-[#1d1815] md:text-5xl"
            style={{ fontFamily: '"Newsreader", "EB Garamond", serif' }}
          >
            {publicationName}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Buscar"
              className="grid size-9 place-items-center rounded-full border border-[#1d1815]/20 transition-colors hover:bg-[#1d1815]/5"
            >
              <Search className="size-4" />
            </button>
            {subscribeText ? (
              <button
                type="button"
                className="hidden items-center gap-2 rounded-full bg-[#1d1815] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#faf6ee] transition-opacity hover:opacity-90 md:inline-flex"
              >
                {subscribeText}
              </button>
            ) : null}
          </div>
        </div>
        {navLinks.length > 0 ? (
          <nav className="mx-auto mt-6 flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-[#1d1815]/80">
            {navLinks.map((n, i) => (
              <a key={`${n}-${i}`} href="#archivo" className="hover:text-[#1d1815] hover:underline">
                {n}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
    </div>
  );
}

// ============================================================
// 2. FEATURED — 2-col: featured story 8 + sidebar 4
// ============================================================
export type MagazineFeaturedProps = {
  featuredCategory?: string;
  featuredTitle?: string;
  featuredHook?: string;
  featuredAuthor?: string;
  featuredMinutes?: string;
  featuredDate?: string;
  featuredCover?: string;
  sidebarLabel?: string;
  sidebarItems?: SidebarItem[];
};

export function MagazineFeatured({
  featuredCategory = "Producto · Análisis",
  featuredTitle = "La economía del software pequeño y rentable",
  featuredHook = "Por qué la próxima década pertenece a los productos de 2 personas con 50.000€ ARR antes que a los unicornios. Un repaso a los modelos de negocio más interesantes de 2026, con datos, fracasos y un par de vergüenzas ajenas.",
  featuredAuthor = "Edgar Vela",
  featuredMinutes = "8 min",
  featuredDate = "12 mar 2026",
  featuredCover = "https://images.unsplash.com/photo-1499914485622-a88fac536970?w=1400&h=900&fit=crop&q=80",
  sidebarLabel = "Esta semana",
  sidebarItems = [
    {
      cat: "Negocio",
      title: "3 lecciones de un fracaso de 200k€",
      author: "Laura Méndez",
      minutes: "6 min",
      cover:
        "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=200&h=200&fit=crop&q=80",
    },
    {
      cat: "Diseño",
      title: "Diseñar para el silencio: por qué menos no es siempre menos",
      author: "Carlos Vega",
      minutes: "4 min",
      cover:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=200&h=200&fit=crop&q=80",
    },
    {
      cat: "Ingeniería",
      title: "Por qué Postgres y nada más en 2026",
      author: "Sara P.",
      minutes: "12 min",
      cover:
        "https://images.unsplash.com/photo-1489875347897-49f64b51c1f8?w=200&h=200&fit=crop&q=80",
    },
    {
      cat: "Cultura",
      title: "Los rituales de equipo que sí funcionan",
      author: "Diego R.",
      minutes: "5 min",
      cover:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop&q=80",
    },
  ],
}: MagazineFeaturedProps) {
  return (
    <div className="csm-show-magazine csm-showcase">
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
          <FadeIn className="md:col-span-8">
            {featuredCover ? (
              <div className="overflow-hidden rounded-sm border border-[#1d1815]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredCover}
                  alt=""
                  className="aspect-[16/10] w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
            ) : null}
            {featuredCategory ? (
              <p className="mt-6 text-xs uppercase tracking-widest text-[#7c2d12]">
                {featuredCategory}
              </p>
            ) : null}
            <h2
              className="csm-display mt-4 text-balance font-semibold leading-[1.1] text-[#1d1815]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.6rem)" }}
            >
              {featuredTitle}
            </h2>
            {featuredHook ? (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#1d1815]/80 md:text-xl">
                {featuredHook}
              </p>
            ) : null}
            <div className="mt-6 flex items-center gap-4 text-xs uppercase tracking-widest text-[#1d1815]/50">
              <span>{featuredAuthor}</span>
              <span>·</span>
              <span>{featuredMinutes}</span>
              <span>·</span>
              <span>{featuredDate}</span>
            </div>
          </FadeIn>

          <aside className="md:col-span-4">
            <FadeIn className="mb-4 flex items-center gap-2 border-b border-[#1d1815]/20 pb-3 text-xs uppercase tracking-widest text-[#1d1815]/60">
              <BookOpen className="size-3.5" />
              {sidebarLabel}
            </FadeIn>
            <ul className="space-y-6">
              {sidebarItems.map((sb, i) => (
                <FadeIn
                  as="li"
                  key={`${sb.title}-${i}`}
                  delay={i * 0.06}
                  className="group flex gap-4 border-b border-[#1d1815]/10 pb-6 last:border-b-0"
                >
                  {sb.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sb.cover}
                      alt=""
                      className="size-20 shrink-0 rounded-sm object-cover"
                    />
                  ) : null}
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#7c2d12]">{sb.cat}</p>
                    <h3 className="csm-display mt-1.5 text-lg font-semibold leading-snug text-[#1d1815] group-hover:underline">
                      {sb.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#1d1815]/60">
                      {sb.author} · {sb.minutes}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 3. CATEGORIES — Grid 2/3 cols
// ============================================================
export type MagazineCategoriesProps = {
  title?: string;
  /** Si vacío, calcula `sum(counts) historias`. */
  totalLabel?: string;
  totalSuffix?: string;
  items?: Category[];
};

export function MagazineCategories({
  title = "Explora por tema",
  totalLabel,
  totalSuffix = "historias",
  items = [
    { name: "Producto", count: 42, color: "#c2410c" },
    { name: "Diseño", count: 38, color: "#a16207" },
    { name: "Ingeniería", count: 64, color: "#365314" },
    { name: "Negocio", count: 27, color: "#7c2d12" },
    { name: "Cultura", count: 19, color: "#3f3f46" },
    { name: "Entrevistas", count: 12, color: "#831843" },
  ],
}: MagazineCategoriesProps) {
  const totalCount = items.reduce((a, b) => a + b.count, 0);
  const totalText = totalLabel ?? `${totalCount} ${totalSuffix}`;
  return (
    <div className="csm-show-magazine csm-showcase">
      <section className="bg-[#1d1815] px-6 py-16 text-[#faf6ee] md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="csm-display text-3xl font-semibold md:text-5xl">{title}</h2>
            <span className="text-xs uppercase tracking-widest text-[#faf6ee]/50">{totalText}</span>
          </FadeIn>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
            {items.map((c, i) => (
              <FadeIn
                key={`${c.name}-${i}`}
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
                  <p className="mt-2 text-sm text-[#faf6ee]/60">
                    {c.count} {totalSuffix}
                  </p>
                </div>
                <ArrowUpRight className="absolute right-4 top-4 size-5 text-[#faf6ee]/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#faf6ee]" />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 4. STORIES GRID — 3-col cards
// ============================================================
export type MagazineStoriesProps = {
  title?: string;
  ctaText?: string;
  ctaHref?: string;
  items?: Story[];
};

export function MagazineStories({
  title = "Más esta semana",
  ctaText = "Ver archivo completo →",
  ctaHref = "#archivo",
  items = [
    {
      cat: "Entrevista",
      title: "Marcos Pérez · 12 años en YCombinator",
      excerpt: "Sobre por qué la mayoría de fundadores resuelven el problema equivocado.",
      cover:
        "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=600&h=800&fit=crop&q=80",
    },
    {
      cat: "Análisis",
      title: "El reverse-takeover de las herramientas internas",
      excerpt: "Tres casos de uso que pasaron de notion-template a empresa de 8 dígitos.",
      cover:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=800&fit=crop&q=80",
    },
    {
      cat: "Opinión",
      title: "El día que dejé de creer en MVPs",
      excerpt: "Y por qué los fundadores deberíamos dejar de usar la palabra ya.",
      cover:
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=800&fit=crop&q=80",
    },
  ],
}: MagazineStoriesProps) {
  return (
    <div className="csm-show-magazine csm-showcase">
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-12 flex items-center justify-between">
            <h2 className="csm-display text-3xl font-semibold text-[#1d1815] md:text-5xl">
              {title}
            </h2>
            {ctaText ? (
              <a
                href={ctaHref}
                className="hidden text-sm font-medium text-[#7c2d12] hover:underline md:block"
              >
                {ctaText}
              </a>
            ) : null}
          </FadeIn>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {items.map((s, i) => (
              <FadeIn key={`${s.title}-${i}`} delay={i * 0.1} className="group">
                {s.cover ? (
                  <div className="overflow-hidden rounded-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.cover}
                      alt=""
                      className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                ) : null}
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
    </div>
  );
}

// ============================================================
// 5. NEWSLETTER — Inline subscribe form
// ============================================================
export type MagazineNewsletterProps = {
  title?: string;
  description?: string;
  emailPlaceholder?: string;
  buttonText?: string;
  disclaimer?: string;
};

export function MagazineNewsletter({
  title = "Recibe lo mejor cada lunes.",
  description = "Sin tracking, sin paywalls, sin el típico newsletter spam que nadie pidió.",
  emailPlaceholder = "tu@email.com",
  buttonText = "Suscribir",
  disclaimer = "12.840 lectores · 0% spam · cancelación 1 click",
}: MagazineNewsletterProps) {
  return (
    <div className="csm-show-magazine csm-showcase">
      <section className="bg-[#1d1815] px-6 py-20 text-[#faf6ee] md:px-10 md:py-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <FadeIn>
            <Mail className="size-8 text-[#faf6ee]/40" />
          </FadeIn>
          <FadeIn>
            <h2 className="csm-display text-balance text-4xl font-semibold md:text-6xl">{title}</h2>
          </FadeIn>
          {description ? (
            <FadeIn delay={0.1}>
              <p className="max-w-md text-base text-[#faf6ee]/70">{description}</p>
            </FadeIn>
          ) : null}
          <FadeIn delay={0.2}>
            <form className="mt-4 flex w-full max-w-md gap-2">
              <input
                type="email"
                placeholder={emailPlaceholder}
                className="flex-1 rounded-full border border-[#faf6ee]/20 bg-transparent px-5 py-3 text-sm text-[#faf6ee] outline-none focus:border-[#faf6ee]/50"
              />
              <button
                type="submit"
                className="rounded-full bg-[#faf6ee] px-6 py-3 text-sm font-medium text-[#1d1815] transition-transform hover:scale-105"
              >
                {buttonText}
              </button>
            </form>
          </FadeIn>
          {disclaimer ? (
            <p className="mt-12 text-xs uppercase tracking-widest text-[#faf6ee]/30">
              {disclaimer}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
