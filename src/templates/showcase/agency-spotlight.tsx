"use client";

/**
 * Showcase: Editorial Dark con vídeo de fondo + parallax (estilo Michael Smith).
 * Loading screen + nav glass pill + hero con role cycling + bento grid de 4 + parallax
 * explorations + stats + footer marquee. Sustituye la plantilla "agency-spotlight".
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

const NAV = [
  { label: "Inicio", href: "#hero" },
  { label: "Trabajos", href: "#trabajos" },
  { label: "CV", href: "#cv" },
];

const ROLES = ["Creativo", "Fullstack", "Founder", "Becario"];

const BENTO = [
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
];

const JOURNAL = [
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
];

const STATS = [
  { value: "08+", label: "años de experiencia" },
  { value: "120+", label: "proyectos entregados" },
  { value: "98%", label: "clientes satisfechos" },
];

export function AgencySpotlightShowcase() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="csm-show-michael csm-showcase">
      {loading ? (
        <LoadingScreen
          words={["Diseña", "Crea", "Inspira"]}
          durationMs={2400}
          onDone={() => setLoading(false)}
        />
      ) : null}

      {/* ============== HERO ============== */}
      <section id="hero" className="relative h-screen w-full overflow-hidden">
        <VideoLoop
          src={VIDEOS.editorialPortrait}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ minWidth: "100%", minHeight: "100%", width: "auto", height: "auto" }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[hsl(0,0%,4%)] to-transparent" />

        {/* Nav */}
        <div className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6">
          <div className="csm-glass-pill inline-flex items-center gap-1 rounded-full px-2 py-2">
            <div className="relative ml-1 mr-1 h-9 w-9 overflow-hidden rounded-full">
              <div className="absolute inset-0 csm-anim-gradient bg-[linear-gradient(90deg,#89AACC_0%,#4E85BF_100%)]" />
              <div className="absolute inset-[2px] flex items-center justify-center rounded-full bg-[hsl(0,0%,8%)]">
                <span className="csm-display text-[13px]">MS</span>
              </div>
            </div>
            <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                {n.label}
              </a>
            ))}
            <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            <a
              href="#say-hi"
              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
            >
              Saluda
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          <FadeIn duration={0.8}>
            <p className="mb-8 text-xs uppercase tracking-[0.3em] text-white/60">
              Colección &apos;26
            </p>
          </FadeIn>
          <FadeIn duration={1} y={50}>
            <h1 className="csm-display mb-6 text-6xl leading-[0.9] text-white md:text-8xl lg:text-9xl">
              Michael Smith
            </h1>
          </FadeIn>
          <FadeIn duration={0.8} delay={0.2}>
            <p className="mb-4 text-lg text-white/80 md:text-xl">
              Un{" "}
              <span className="csm-display text-white">
                <CycleText words={ROLES} intervalMs={2200} />
              </span>{" "}
              que vive en Madrid.
            </p>
          </FadeIn>
          <FadeIn duration={0.7} delay={0.35}>
            <p className="mb-12 max-w-md text-sm text-white/60 md:text-base">
              Diseñando interacciones digitales fluidas — encontrando los matices que hacen que un
              sistema cobre vida.
            </p>
          </FadeIn>
          <FadeIn duration={0.7} delay={0.5}>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                type="button"
                className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-[hsl(0,0%,4%)] transition-transform hover:scale-105"
              >
                Ver trabajos
              </button>
              <button
                type="button"
                className="rounded-full border-2 border-white/20 bg-transparent px-7 py-3.5 text-sm font-medium text-white transition-colors hover:border-white/40"
              >
                Hablemos
              </button>
            </div>
          </FadeIn>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Scroll</p>
          <div className="mx-auto mt-2 h-10 w-px overflow-hidden bg-white/15">
            <div className="h-full w-full csm-anim-scroll-down bg-white" />
          </div>
        </div>
      </section>

      {/* ============== SELECTED WORKS ============== */}
      <section id="trabajos" className="bg-[hsl(0,0%,4%)] px-6 py-12 md:px-10 md:py-16 lg:px-16">
        <div className="mx-auto max-w-[1200px]">
          <FadeIn className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-white/20" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Trabajos seleccionados
                </span>
              </div>
              <h2 className="text-4xl text-white md:text-6xl">
                Proyectos <span className="csm-display">recientes</span>
              </h2>
              <p className="mt-4 max-w-md text-sm text-white/60 md:text-base">
                Una selección curada de proyectos en los que he trabajado, del concepto al
                lanzamiento.
              </p>
            </div>
            <a
              href="#all"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/5"
            >
              Ver todo
              <ArrowUpRight className="size-4" />
            </a>
          </FadeIn>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
            {BENTO.map((b, i) => (
              <FadeIn
                key={b.title}
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

      {/* ============== JOURNAL ============== */}
      <section className="bg-[hsl(0,0%,4%)] px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <div className="mx-auto max-w-[1100px]">
          <FadeIn className="mb-10 flex items-end justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-white/20" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">Diario</span>
              </div>
              <h2 className="text-4xl text-white md:text-6xl">
                Notas <span className="csm-display">recientes</span>
              </h2>
            </div>
            <a
              href="#blog"
              className="hidden shrink-0 items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/5 md:inline-flex"
            >
              Ver todo
              <ArrowUpRight className="size-4" />
            </a>
          </FadeIn>

          <div className="flex flex-col gap-3">
            {JOURNAL.map((j, i) => (
              <FadeIn
                key={j.title}
                delay={i * 0.06}
                className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-[hsl(0,0%,8%)]/30 p-3 transition-colors hover:border-white/20 hover:bg-[hsl(0,0%,8%)] md:gap-6 md:rounded-full md:p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={j.img} alt="" className="size-14 rounded-full object-cover md:size-16" />
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

      {/* ============== EXPLORATIONS — parallax columns ============== */}
      <section className="relative bg-[hsl(0,0%,4%)] px-6 py-24 md:py-32 lg:px-16">
        <div className="mx-auto max-w-[1400px]">
          <FadeIn className="mb-16 text-center">
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">Exploraciones</span>
            <h2 className="mt-4 text-5xl text-white md:text-7xl">
              Patio <span className="csm-display">visual</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/60">
              Pruebas, bocetos y experimentos que aún no son proyectos pero ya tienen vida propia.
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-6 md:gap-12">
            <ParallaxColumn factor={-0.25} className="flex flex-col gap-6 md:gap-12">
              {EXPLORATIONS.slice(0, 3).map((src, i) => (
                <div
                  key={src}
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
            <ParallaxColumn factor={0.2} className="mt-16 flex flex-col gap-6 md:gap-12">
              {EXPLORATIONS.slice(3).map((src, i) => (
                <div
                  key={src}
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

      {/* ============== STATS ============== */}
      <section className="bg-[hsl(0,0%,4%)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 md:grid-cols-3">
          {STATS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.1} className="text-center">
              <div className="csm-display text-7xl text-white md:text-8xl">{s.value}</div>
              <p className="mt-2 text-sm uppercase tracking-widest text-white/50">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ============== CONTACT / FOOTER ============== */}
      <section
        id="say-hi"
        className="relative overflow-hidden bg-[hsl(0,0%,4%)] pb-12 pt-16 md:pb-16 md:pt-24"
      >
        <div className="absolute inset-0">
          <VideoLoop
            src={VIDEOS.editorialPortrait}
            className="absolute inset-0 h-full w-full"
            style={{ transform: "scaleY(-1)" }}
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="relative z-10 px-6">
          <MarqueeRow autoplay autoplayDuration={50} className="mb-16 md:mb-20">
            {Array.from({ length: 14 }, (_, i) => `mq-${i}`).map((id) => (
              <span
                key={id}
                className="csm-display flex-shrink-0 px-8 text-7xl text-white md:text-9xl"
              >
                Diseñando el futuro •
              </span>
            ))}
          </MarqueeRow>

          <div className="mx-auto flex max-w-[900px] flex-col items-center gap-10 text-center">
            <FadeIn>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Contacto</p>
            </FadeIn>
            <FadeIn>
              <h2 className="csm-display text-5xl text-white md:text-7xl">
                Construyamos algo memorable
              </h2>
            </FadeIn>
            <FadeIn delay={0.1}>
              <a
                href="mailto:hola@michaelsmith.com"
                className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition-transform hover:scale-105"
              >
                hola@michaelsmith.com
              </a>
            </FadeIn>

            <div className="mt-12 flex w-full flex-col items-center justify-between gap-6 border-t border-white/10 pt-6 md:flex-row">
              <div className="flex gap-3">
                <SocialIcon Icon={Twitter} />
                <SocialIcon Icon={Linkedin} />
                <SocialIcon Icon={Github} />
                <SocialIcon Icon={MessageCircle} />
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                Disponible para proyectos
              </div>
              <p className="text-xs text-white/40">© 2026 Michael Smith</p>
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
