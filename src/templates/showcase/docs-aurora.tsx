"use client";

/**
 * Showcase: Docs / AI Product (Power AI / Nimbus-style).
 * Hero con vídeo de fondo + headline gradient (indigo→purple→amber) + logo
 * marquee inferior + sección de docs en grid + quick-start. Sustituye "docs-aurora".
 */

import { VIDEOS } from "@/templates/showcase/_lib/assets";
import { FadeIn, MarqueeRow, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { ChevronDown, Code2, FileText, Github, Sparkles, Terminal } from "lucide-react";

const NAV = [
  { label: "Producto", href: "#producto", chevron: true },
  { label: "Soluciones", href: "#soluciones" },
  { label: "Precios", href: "#precios" },
  { label: "Aprende", href: "#aprende", chevron: true },
];

const LOGOS = ["Vortex", "Nimbus", "Prysma", "Cirrus", "Kynder", "Halcyn"];

const DOCS = [
  {
    icon: Terminal,
    title: "Quick start",
    desc: "De cero a producción en 5 minutos. Una sola línea para instalar el SDK.",
    href: "#qs",
  },
  {
    icon: Code2,
    title: "API Reference",
    desc: "Documentación completa con ejemplos en TypeScript, Python, Go y curl.",
    href: "#api",
  },
  {
    icon: FileText,
    title: "Guías",
    desc: "Tutoriales paso a paso para los flujos más comunes — sin saltarse nada.",
    href: "#guides",
  },
  {
    icon: Sparkles,
    title: "Recetas",
    desc: "Snippets curados para casos reales: streaming, batching, retries, etc.",
    href: "#recipes",
  },
  {
    icon: Github,
    title: "Open source",
    desc: "Cliente de referencia en GitHub. PRs y discusiones bienvenidas.",
    href: "#oss",
  },
  {
    icon: ChevronDown,
    title: "Changelog",
    desc: "Cada release documentada — qué cambió, qué falta, qué viene.",
    href: "#changelog",
  },
];

const CODE_SAMPLE = `import { Nimbus } from "@nimbus/sdk";

const client = new Nimbus({ apiKey: process.env.NIMBUS_KEY });

const result = await client.completions.create({
  model: "nimbus-1.5",
  prompt: "Crea un plan de marketing para una marca DTC.",
  stream: true,
});

for await (const chunk of result) {
  process.stdout.write(chunk.text);
}`;

export function DocsAuroraShowcase() {
  return (
    <div className="csm-show-nimbus csm-showcase">
      {/* ============== HERO ============== */}
      <section className="relative flex min-h-screen flex-col overflow-visible">
        <div className="absolute inset-0 overflow-hidden">
          <VideoLoop
            src={VIDEOS.nimbusHero}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Blurred shape detrás del contenido */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[527px] w-[984px] -translate-x-1/2 -translate-y-1/2 opacity-90 blur-[82px]"
            style={{ background: "rgba(8, 8, 22, 0.85)" }}
          />
        </div>

        {/* Nav */}
        <FadeIn duration={0.6} y={-12} className="relative z-10 px-8 py-5">
          <nav className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="grid size-8 place-items-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #fcd34d 100%)",
                }}
              >
                <Sparkles className="size-4 text-white" />
              </div>
              <span className="text-base font-semibold text-white">nimbus</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              {NAV.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-white/85 transition-colors hover:text-white"
                >
                  {n.label}
                  {n.chevron ? <ChevronDown className="size-3.5" /> : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <a href="#login" className="hidden text-sm text-white/85 hover:text-white sm:block">
                Iniciar sesión
              </a>
              <button
                type="button"
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                Crear cuenta
              </button>
            </div>
          </nav>
          <div className="mt-[3px] h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </FadeIn>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <FadeIn duration={0.9} y={30}>
            <h1
              className="csm-display font-normal tracking-tight text-white"
              style={{ fontSize: "clamp(4rem, 14vw, 14rem)", lineHeight: 1.02 }}
            >
              Power <span className="csm-ai-grad">AI</span>
            </h1>
          </FadeIn>

          <FadeIn duration={0.7} delay={0.2}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
              La IA más potente jamás desplegada — para tus equipos, productos y procesos.
            </p>
          </FadeIn>

          <FadeIn duration={0.7} delay={0.35}>
            <button
              type="button"
              className="mt-10 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur transition-all hover:scale-105 hover:bg-white/10"
            >
              Probar gratis →
            </button>
          </FadeIn>
        </div>

        {/* Logo marquee bottom */}
        <div className="relative z-10 px-6 pb-10">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col items-center gap-4 md:flex-row md:gap-12">
              <p className="shrink-0 text-center text-sm text-white/50 md:text-left">
                Confiado por equipos
                <br className="hidden md:block" /> en todo el mundo
              </p>
              <MarqueeRow autoplay autoplayDuration={20} className="flex-1">
                {Array.from({ length: LOGOS.length * 2 }, (_, i) => ({
                  id: `lg-${i}`,
                  name: LOGOS[i % LOGOS.length] ?? "",
                })).map(({ id, name }) => (
                  <div key={id} className="mr-16 flex shrink-0 items-center gap-2">
                    <div
                      className="grid size-6 place-items-center rounded-md text-xs font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(168,85,247,0.5) 100%)",
                      }}
                    >
                      {name[0]}
                    </div>
                    <span className="text-base font-semibold text-white">{name}</span>
                  </div>
                ))}
              </MarqueeRow>
            </div>
          </div>
        </div>
      </section>

      {/* ============== DOCS GRID ============== */}
      <section id="aprende" className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">Documentación</p>
              <h2 className="csm-display text-4xl font-normal text-white md:text-6xl">
                Todo lo que necesitas saber
              </h2>
            </div>
            <p className="max-w-md text-base text-white/60">
              Guías, ejemplos y referencias mantenidas por el equipo. Sin paywalls — todo abierto.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOCS.map((d, i) => {
              const Icon = d.icon;
              return (
                <FadeIn
                  key={d.title}
                  delay={i * 0.06}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-white/30 hover:bg-white/10"
                >
                  <div
                    className="absolute -right-10 -top-10 size-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #fcd34d 100%)",
                    }}
                  />
                  <div className="relative">
                    <div
                      className="mb-5 grid size-10 place-items-center rounded-xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.3) 100%)",
                      }}
                    >
                      <Icon className="size-5 text-white" />
                    </div>
                    <h3 className="text-lg font-medium text-white">{d.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{d.desc}</p>
                    <a
                      href={d.href}
                      className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
                    >
                      Leer →
                    </a>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== QUICK START — code sample ============== */}
      <section className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          <FadeIn x={-30}>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">Quick start</p>
            <h2 className="csm-display text-4xl font-normal text-white md:text-5xl">
              5 minutos. Producción.
            </h2>
            <p className="mt-6 text-base text-white/70">
              Instala el SDK con un comando, configura tu API key, lanza tu primera petición. Sin
              más.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {[
                "1. npm install @nimbus/sdk",
                "2. Genera tu API key en /admin/keys",
                "3. Copia el snippet de la derecha",
                "4. Stream tu primera respuesta",
              ].map((step) => (
                <div key={step} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="size-1.5 rounded-full bg-amber-300" />
                  {step}
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn x={30} delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="size-3 rounded-full bg-red-400/70" />
                <span className="size-3 rounded-full bg-yellow-400/70" />
                <span className="size-3 rounded-full bg-green-400/70" />
                <span className="ml-3 font-mono text-xs text-white/40">stream.ts</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed text-white/90">
                <code>{CODE_SAMPLE}</code>
              </pre>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============== COMMUNITY ============== */}
      <section className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">Comunidad</p>
          </FadeIn>
          <FadeIn>
            <h2 className="csm-display text-4xl font-normal text-white md:text-6xl">
              8.000 desarrolladores activos en Discord.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-6 text-lg text-white/70">
              Encuentra respuestas en minutos. Sé de los primeros en enterarte de lo nuevo.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <button
              type="button"
              className="mt-10 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white backdrop-blur transition-all hover:scale-105 hover:bg-white/10"
            >
              Únete a Discord →
            </button>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
