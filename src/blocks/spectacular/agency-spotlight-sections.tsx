"use client";

/**
 * Secciones espectaculares de la plantilla `agency-spotlight` (Michael Smith — Editorial Dark).
 *
 * 7 secciones 1:1 con la showcase original. Reusa CSS `.csm-show-michael`,
 * `.csm-display` (Instrument Serif italic), `.csm-glass-pill`, `.csm-anim-gradient`,
 * `.csm-anim-scroll-down`, `.csm-halftone`.
 */

import {
  EDITORIAL_GRID,
  EXPLORATIONS,
  JOURNAL_THUMBS,
  VIDEOS,
} from "@/templates/showcase/_lib/assets";
import {
  CycleText,
  FadeIn,
  LoadingScreen,
  MarqueeRow,
  ParallaxColumn,
  VideoLoop,
} from "@/templates/showcase/_lib/primitives";
import {
  ArrowUpRight,
  Github,
  Linkedin,
  type LucideIcon,
  MessageCircle,
  Twitter,
} from "lucide-react";
import { useState } from "react";

// ============================================================
// Tipos
// ============================================================
type LinkItem = { label: string; href: string };
type BentoItem = { title: string; img: string; span: string; aspect: string };
type JournalItem = { title: string; minutes: string; date: string; img: string };
type StatItem = { value: string; label: string };

const SOCIAL_KEYS = ["twitter", "linkedin", "github", "messageCircle"] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];
const SOCIAL_MAP: Record<SocialKey, LucideIcon> = {
  twitter: Twitter,
  linkedin: Linkedin,
  github: Github,
  messageCircle: MessageCircle,
};

// ============================================================
// 1. HERO — Loading + nav glass + role cycle + dual CTAs
// ============================================================
export type MichaelHeroProps = {
  showLoading?: boolean;
  loadingWords?: string[];
  loadingDurationMs?: number;
  videoUrl?: string;
  navInitials?: string;
  navItems?: LinkItem[];
  navCtaText?: string;
  navCtaHref?: string;
  eyebrow?: string;
  title?: string;
  preCycleText?: string;
  cycleWords?: string[];
  cycleIntervalMs?: number;
  postCycleText?: string;
  description?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  scrollLabel?: string;
};

export function MichaelHero({
  showLoading = true,
  loadingWords = ["Diseña", "Crea", "Inspira"],
  loadingDurationMs = 2400,
  videoUrl = VIDEOS.editorialPortrait,
  navInitials = "MS",
  navItems = [
    { label: "Inicio", href: "#hero" },
    { label: "Trabajos", href: "#trabajos" },
    { label: "CV", href: "#cv" },
  ],
  navCtaText = "Saluda",
  navCtaHref = "#say-hi",
  eyebrow = "Colección '26",
  title = "Michael Smith",
  preCycleText = "Un",
  cycleWords = ["Creativo", "Fullstack", "Founder", "Becario"],
  cycleIntervalMs = 2200,
  postCycleText = "que vive en Madrid.",
  description = "Diseñando interacciones digitales fluidas — encontrando los matices que hacen que un sistema cobre vida.",
  primaryButtonText = "Ver trabajos",
  secondaryButtonText = "Hablemos",
  scrollLabel = "Scroll",
}: MichaelHeroProps) {
  const [loading, setLoading] = useState(showLoading);
  return (
    <div className="csm-show-michael csm-showcase">
      {loading ? (
        <LoadingScreen
          words={loadingWords}
          durationMs={loadingDurationMs}
          onDone={() => setLoading(false)}
        />
      ) : null}

      <section id="hero" className="relative h-screen w-full overflow-hidden">
        {videoUrl ? (
          <VideoLoop
            src={videoUrl}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ minWidth: "100%", minHeight: "100%", width: "auto", height: "auto" }}
          />
        ) : null}
        <div className="absolute inset-0 bg-black/30" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[hsl(0,0%,4%)] to-transparent" />

        {/* Nav */}
        <div className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6">
          <div className="csm-glass-pill inline-flex items-center gap-1 rounded-full px-2 py-2">
            <div className="relative ml-1 mr-1 h-9 w-9 overflow-hidden rounded-full">
              <div className="csm-anim-gradient absolute inset-0 bg-[linear-gradient(90deg,#89AACC_0%,#4E85BF_100%)]" />
              <div className="absolute inset-[2px] flex items-center justify-center rounded-full bg-[hsl(0,0%,8%)]">
                <span className="csm-display text-[13px]">{navInitials}</span>
              </div>
            </div>
            <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            {navItems.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                {n.label}
              </a>
            ))}
            {navCtaText ? (
              <>
                <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
                <a
                  href={navCtaHref}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
                >
                  {navCtaText}
                  <ArrowUpRight className="size-3" />
                </a>
              </>
            ) : null}
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          {eyebrow ? (
            <FadeIn duration={0.8}>
              <p className="mb-8 text-xs uppercase tracking-[0.3em] text-white/60">{eyebrow}</p>
            </FadeIn>
          ) : null}
          {title ? (
            <FadeIn duration={1} y={50}>
              <h1 className="csm-display mb-6 text-6xl leading-[0.9] text-white md:text-8xl lg:text-9xl">
                {title}
              </h1>
            </FadeIn>
          ) : null}
          {cycleWords.length > 0 ? (
            <FadeIn duration={0.8} delay={0.2}>
              <p className="mb-4 text-lg text-white/80 md:text-xl">
                {preCycleText}{" "}
                <span className="csm-display text-white">
                  <CycleText words={cycleWords} intervalMs={cycleIntervalMs} />
                </span>{" "}
                {postCycleText}
              </p>
            </FadeIn>
          ) : null}
          {description ? (
            <FadeIn duration={0.7} delay={0.35}>
              <p className="mb-12 max-w-md text-sm text-white/60 md:text-base">{description}</p>
            </FadeIn>
          ) : null}
          {primaryButtonText || secondaryButtonText ? (
            <FadeIn duration={0.7} delay={0.5}>
              <div className="flex flex-wrap justify-center gap-4">
                {primaryButtonText ? (
                  <button
                    type="button"
                    className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-[hsl(0,0%,4%)] transition-transform hover:scale-105"
                  >
                    {primaryButtonText}
                  </button>
                ) : null}
                {secondaryButtonText ? (
                  <button
                    type="button"
                    className="rounded-full border-2 border-white/20 bg-transparent px-7 py-3.5 text-sm font-medium text-white transition-colors hover:border-white/40"
                  >
                    {secondaryButtonText}
                  </button>
                ) : null}
              </div>
            </FadeIn>
          ) : null}
        </div>

        {/* Scroll indicator */}
        {scrollLabel ? (
          <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">{scrollLabel}</p>
            <div className="mx-auto mt-2 h-10 w-px overflow-hidden bg-white/15">
              <div className="csm-anim-scroll-down h-full w-full bg-white" />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ============================================================
// 2. BENTO 4-ASYM — Selected works
// ============================================================
export type MichaelBentoProps = {
  anchorId?: string;
  eyebrow?: string;
  /** "Proyectos *recientes*" — *...* es italic display. */
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  items?: BentoItem[];
};

export function MichaelBento({
  anchorId = "trabajos",
  eyebrow = "Trabajos seleccionados",
  title = "Proyectos *recientes*",
  description = "Una selección curada de proyectos en los que he trabajado, del concepto al lanzamiento.",
  ctaText = "Ver todo",
  ctaHref = "#all",
  items = [
    {
      title: "Branding Automoción",
      img: EDITORIAL_GRID.automotive,
      span: "md:col-span-7",
      aspect: "aspect-[16/10]",
    },
    {
      title: "Arquitectura urbana",
      img: EDITORIAL_GRID.architecture,
      span: "md:col-span-5",
      aspect: "aspect-[4/5]",
    },
    {
      title: "Perspectiva humana",
      img: EDITORIAL_GRID.human,
      span: "md:col-span-5",
      aspect: "aspect-[4/5]",
    },
    {
      title: "Identidad de marca",
      img: EDITORIAL_GRID.brand,
      span: "md:col-span-7",
      aspect: "aspect-[16/10]",
    },
  ],
}: MichaelBentoProps) {
  return (
    <div className="csm-show-michael csm-showcase">
      <section id={anchorId} className="bg-[hsl(0,0%,4%)] px-6 py-12 md:px-10 md:py-16 lg:px-16">
        <div className="mx-auto max-w-[1200px]">
          <FadeIn className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-white/20" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">{eyebrow}</span>
              </div>
              <h2
                className="text-4xl text-white md:text-6xl"
                dangerouslySetInnerHTML={{ __html: italicSpans(title) }}
              />
              {description ? (
                <p className="mt-4 max-w-md text-sm text-white/60 md:text-base">{description}</p>
              ) : null}
            </div>
            {ctaText ? (
              <a
                href={ctaHref}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/5"
              >
                {ctaText}
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
          </FadeIn>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
            {items.map((b, i) => (
              <FadeIn
                key={`${b.title}-${i}`}
                delay={i * 0.08}
                duration={0.7}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-[hsl(0,0%,8%)] ${b.span} ${b.aspect}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.img}
                  alt={b.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="csm-halftone pointer-events-none absolute inset-0 text-black/80 opacity-20"
                  aria-hidden
                />
                <div className="absolute inset-0 bg-black/0 backdrop-blur-0 transition-all duration-500 group-hover:bg-black/40 group-hover:backdrop-blur-[2px]">
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="rounded-full bg-white px-4 py-2 text-xs text-black">
                      Ver — <span className="csm-display italic">{b.title}</span>
                    </div>
                    <ArrowUpRight className="size-5 text-white" />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Convierte `*texto*` a `<span class="csm-display">texto</span>` (italic display). Anti-XSS: solo permite el patrón. */
function italicSpans(raw: string): string {
  if (!raw) return "";
  // Sanitiza primero: quita tags HTML.
  const safe = raw.replace(/<[^>]*>/g, "");
  return safe.replace(/\*([^*]+)\*/g, '<span class="csm-display">$1</span>');
}

// ============================================================
// 3. JOURNAL — Horizontal pill list
// ============================================================
export type MichaelJournalProps = {
  eyebrow?: string;
  title?: string;
  ctaText?: string;
  ctaHref?: string;
  items?: JournalItem[];
};

export function MichaelJournal({
  eyebrow = "Diario",
  title = "Notas *recientes*",
  ctaText = "Ver todo",
  ctaHref = "#blog",
  items = [
    {
      title: "Por qué los detalles ganan a la escala",
      minutes: "8 min",
      date: "12 Mar",
      img: JOURNAL_THUMBS[0]!,
    },
    {
      title: "Construir interfaces con presencia, no peso",
      minutes: "5 min",
      date: "01 Mar",
      img: JOURNAL_THUMBS[1]!,
    },
    {
      title: "El silencio en el diseño es información",
      minutes: "11 min",
      date: "18 Feb",
      img: JOURNAL_THUMBS[2]!,
    },
    {
      title: "Notas sobre intuición y datos",
      minutes: "6 min",
      date: "02 Feb",
      img: JOURNAL_THUMBS[3]!,
    },
  ],
}: MichaelJournalProps) {
  return (
    <div className="csm-show-michael csm-showcase">
      <section className="bg-[hsl(0,0%,4%)] px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <div className="mx-auto max-w-[1100px]">
          <FadeIn className="mb-10 flex items-end justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-white/20" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">{eyebrow}</span>
              </div>
              <h2
                className="text-4xl text-white md:text-6xl"
                dangerouslySetInnerHTML={{ __html: italicSpans(title) }}
              />
            </div>
            {ctaText ? (
              <a
                href={ctaHref}
                className="hidden shrink-0 items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/5 md:inline-flex"
              >
                {ctaText}
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
          </FadeIn>

          <div className="flex flex-col gap-3">
            {items.map((j, i) => (
              <FadeIn
                key={`${j.title}-${i}`}
                delay={i * 0.06}
                className="group flex items-center gap-4 rounded-[28px] border border-white/10 bg-[hsl(0,0%,8%)]/30 p-3 transition-colors hover:border-white/20 hover:bg-[hsl(0,0%,8%)] md:gap-6 md:rounded-full md:p-4"
              >
                {j.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={j.img}
                    alt=""
                    className="size-14 rounded-full object-cover md:size-16"
                  />
                ) : null}
                <h3 className="csm-display flex-1 text-lg text-white md:text-xl">{j.title}</h3>
                <span className="text-xs uppercase tracking-widest text-white/50">{j.minutes}</span>
                <span className="hidden text-xs uppercase tracking-widest text-white/40 md:block">
                  {j.date}
                </span>
                <ArrowUpRight className="size-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 4. PARALLAX EXPLORATIONS — 2 col scroll-driven
// ============================================================
export type MichaelExplorationsProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  /** URLs de imágenes — primeras N van columna 1, resto columna 2. Default 3+3. */
  images?: string[];
  splitAt?: number;
  factorLeft?: number;
  factorRight?: number;
};

export function MichaelExplorations({
  eyebrow = "Exploraciones",
  title = "Patio *visual*",
  description = "Pruebas, bocetos y experimentos que aún no son proyectos pero ya tienen vida propia.",
  images = EXPLORATIONS as unknown as string[],
  splitAt = 3,
  factorLeft = -0.25,
  factorRight = 0.2,
}: MichaelExplorationsProps) {
  const left = images.slice(0, splitAt);
  const right = images.slice(splitAt);
  return (
    <div className="csm-show-michael csm-showcase">
      <section className="relative bg-[hsl(0,0%,4%)] px-6 py-24 md:py-32 lg:px-16">
        <div className="mx-auto max-w-[1400px]">
          <FadeIn className="mb-16 text-center">
            {eyebrow ? (
              <span className="text-xs uppercase tracking-[0.3em] text-white/60">{eyebrow}</span>
            ) : null}
            <h2
              className="mt-4 text-5xl text-white md:text-7xl"
              dangerouslySetInnerHTML={{ __html: italicSpans(title) }}
            />
            {description ? (
              <p className="mx-auto mt-4 max-w-md text-sm text-white/60">{description}</p>
            ) : null}
          </FadeIn>
          <div className="grid grid-cols-2 gap-6 md:gap-12">
            <ParallaxColumn factor={factorLeft} className="flex flex-col gap-6 md:gap-12">
              {left.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`overflow-hidden rounded-3xl border border-white/10 ${
                    i % 2 === 0 ? "rotate-[-1.5deg]" : "rotate-[1deg]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
              ))}
            </ParallaxColumn>
            <ParallaxColumn factor={factorRight} className="mt-16 flex flex-col gap-6 md:gap-12">
              {right.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`overflow-hidden rounded-3xl border border-white/10 ${
                    i % 2 === 0 ? "rotate-[1deg]" : "rotate-[-1.5deg]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
              ))}
            </ParallaxColumn>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 5. STATS 3-col
// ============================================================
export type MichaelStatsProps = {
  items?: StatItem[];
};

export function MichaelStats({
  items = [
    { value: "08+", label: "años de experiencia" },
    { value: "120+", label: "proyectos entregados" },
    { value: "98%", label: "clientes satisfechos" },
  ],
}: MichaelStatsProps) {
  return (
    <div className="csm-show-michael csm-showcase">
      <section className="bg-[hsl(0,0%,4%)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 md:grid-cols-3">
          {items.map((s, i) => (
            <FadeIn key={`${s.label}-${i}`} delay={i * 0.1} className="text-center">
              <div className="csm-display text-7xl text-white md:text-8xl">{s.value}</div>
              <p className="mt-2 text-sm uppercase tracking-widest text-white/50">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 6. CONTACT FOOTER — marquee + email + footer bar
// ============================================================
export type MichaelContactFooterProps = {
  anchorId?: string;
  videoUrl?: string;
  marqueeText?: string;
  marqueeIterations?: number;
  marqueeDuration?: number;
  eyebrow?: string;
  title?: string;
  emailLabel?: string;
  emailHref?: string;
  socials?: SocialKey[];
  statusText?: string;
  copyright?: string;
};

export function MichaelContactFooter({
  anchorId = "say-hi",
  videoUrl = VIDEOS.editorialPortrait,
  marqueeText = "Diseñando el futuro •",
  marqueeIterations = 14,
  marqueeDuration = 50,
  eyebrow = "Contacto",
  title = "Construyamos algo memorable",
  emailLabel = "hola@michaelsmith.com",
  emailHref = "mailto:hola@michaelsmith.com",
  socials = ["twitter", "linkedin", "github", "messageCircle"],
  statusText = "Disponible para proyectos",
  copyright = "© 2026 Michael Smith",
}: MichaelContactFooterProps) {
  return (
    <div className="csm-show-michael csm-showcase">
      <section
        id={anchorId}
        className="relative overflow-hidden bg-[hsl(0,0%,4%)] pb-12 pt-16 md:pb-16 md:pt-24"
      >
        {videoUrl ? (
          <div className="absolute inset-0">
            <VideoLoop
              src={videoUrl}
              className="absolute inset-0 h-full w-full"
              style={{ transform: "scaleY(-1)" }}
            />
            <div className="absolute inset-0 bg-black/70" />
          </div>
        ) : null}

        <div className="relative z-10 px-6">
          <MarqueeRow autoplay autoplayDuration={marqueeDuration} className="mb-16 md:mb-20">
            {Array.from({ length: marqueeIterations }, (_, i) => `mq-${i}`).map((id) => (
              <span
                key={id}
                className="csm-display flex-shrink-0 px-8 text-7xl text-white md:text-9xl"
              >
                {marqueeText}
              </span>
            ))}
          </MarqueeRow>

          <div className="mx-auto flex max-w-[900px] flex-col items-center gap-10 text-center">
            {eyebrow ? (
              <FadeIn>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">{eyebrow}</p>
              </FadeIn>
            ) : null}
            {title ? (
              <FadeIn>
                <h2 className="csm-display text-5xl text-white md:text-7xl">{title}</h2>
              </FadeIn>
            ) : null}
            {emailLabel ? (
              <FadeIn delay={0.1}>
                <a
                  href={emailHref}
                  className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition-transform hover:scale-105"
                >
                  {emailLabel}
                </a>
              </FadeIn>
            ) : null}

            <div className="mt-12 flex w-full flex-col items-center justify-between gap-6 border-t border-white/10 pt-6 md:flex-row">
              <div className="flex gap-3">
                {socials.map((key) => {
                  const Icon = SOCIAL_MAP[key];
                  if (!Icon) return null;
                  return <SocialIcon key={key} Icon={Icon} />;
                })}
              </div>
              {statusText ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  {statusText}
                </div>
              ) : null}
              {copyright ? <p className="text-xs text-white/40">{copyright}</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SocialIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <a
      href="#say-hi"
      className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 transition-colors hover:border-white/20 hover:text-white"
    >
      <Icon className="size-4" />
    </a>
  );
}
