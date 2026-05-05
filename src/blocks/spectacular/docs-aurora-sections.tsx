"use client";

/**
 * Secciones de la plantilla `docs-aurora` (Nimbus / Power AI).
 * 4 secciones: hero gradient + logo marquee, docs grid, quick-start split,
 * community CTA. Reusa `.csm-show-nimbus`, `.csm-display`, `.csm-ai-grad`.
 */

import { FadeIn, MarqueeRow, VideoLoop } from "@/templates/showcase/_lib/primitives";
import * as Icons from "lucide-react";
import { ChevronDown, Sparkles } from "lucide-react";

type LinkItem = { label: string; href: string; chevron?: boolean };
type DocCard = { icon: string; title: string; desc: string; href: string };

// ============================================================
// 1. HERO — Nav + h1 gradient + subtitle + CTA + logo marquee
// ============================================================
export type NimbusHeroProps = {
  brand?: string;
  navItems?: LinkItem[];
  loginText?: string;
  signupText?: string;
  videoUrl?: string;
  /** Soporta `<em>AI</em>` para gradient indigo→purple→amber. */
  titleHtml?: string;
  description?: string;
  ctaText?: string;
  marqueeLabel?: string;
  logos?: string[];
};

export function NimbusHero({
  brand = "nimbus",
  navItems = [
    { label: "Producto", href: "#producto", chevron: true },
    { label: "Soluciones", href: "#soluciones" },
    { label: "Precios", href: "#precios" },
    { label: "Aprende", href: "#aprende", chevron: true },
  ],
  loginText = "Iniciar sesión",
  signupText = "Crear cuenta",
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4",
  titleHtml = "Power <em>AI</em>",
  description = "La IA más potente jamás desplegada — para tus equipos, productos y procesos.",
  ctaText = "Probar gratis →",
  marqueeLabel = "Confiado por equipos\nen todo el mundo",
  logos = ["Vortex", "Nimbus", "Prysma", "Cirrus", "Kynder", "Halcyn"],
}: NimbusHeroProps) {
  return (
    <div className="csm-show-nimbus csm-showcase">
      <section className="relative flex min-h-screen flex-col overflow-visible">
        <div className="absolute inset-0 overflow-hidden">
          {videoUrl ? (
            <VideoLoop src={videoUrl} className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[527px] w-[984px] -translate-x-1/2 -translate-y-1/2 opacity-90 blur-[82px]"
            style={{ background: "rgba(8, 8, 22, 0.85)" }}
          />
        </div>

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
              <span className="text-base font-semibold text-white">{brand}</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((n, i) => (
                <button
                  key={`${n.label}-${i}`}
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-white/85 transition-colors hover:text-white"
                >
                  {n.label}
                  {n.chevron ? <ChevronDown className="size-3.5" /> : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {loginText ? (
                <a href="#login" className="hidden text-sm text-white/85 hover:text-white sm:block">
                  {loginText}
                </a>
              ) : null}
              {signupText ? (
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  {signupText}
                </button>
              ) : null}
            </div>
          </nav>
          <div className="mt-[3px] h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </FadeIn>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <FadeIn duration={0.9} y={30}>
            <h1
              className="csm-display font-normal tracking-tight text-white"
              style={{ fontSize: "clamp(4rem, 14vw, 14rem)", lineHeight: 1.02 }}
              dangerouslySetInnerHTML={{ __html: aiGradientEm(titleHtml) }}
            />
          </FadeIn>

          {description ? (
            <FadeIn duration={0.7} delay={0.2}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
                {description}
              </p>
            </FadeIn>
          ) : null}

          {ctaText ? (
            <FadeIn duration={0.7} delay={0.35}>
              <button
                type="button"
                className="mt-10 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur transition-all hover:scale-105 hover:bg-white/10"
              >
                {ctaText}
              </button>
            </FadeIn>
          ) : null}
        </div>

        {logos.length > 0 ? (
          <div className="relative z-10 px-6 pb-10">
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-col items-center gap-4 md:flex-row md:gap-12">
                {marqueeLabel ? (
                  <p className="shrink-0 whitespace-pre-line text-center text-sm text-white/50 md:text-left">
                    {marqueeLabel}
                  </p>
                ) : null}
                <MarqueeRow autoplay autoplayDuration={20} className="flex-1">
                  {Array.from({ length: logos.length * 2 }, (_, i) => ({
                    id: `lg-${i}`,
                    name: logos[i % logos.length] ?? "",
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
        ) : null}
      </section>
    </div>
  );
}

function aiGradientEm(raw: string): string {
  if (!raw) return "";
  const safe = raw.replace(/<(?!\/?em\b)[^>]*>/gi, "");
  return safe.replace(/<em>([^<]+)<\/em>/gi, '<span class="csm-ai-grad">$1</span>');
}

// ============================================================
// 2. DOCS GRID — 6 cards lucide icon + title + desc + link
// ============================================================
export type NimbusDocsGridProps = {
  anchorId?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  items?: DocCard[];
};

export function NimbusDocsGrid({
  anchorId = "aprende",
  eyebrow = "Documentación",
  title = "Todo lo que necesitas saber",
  description = "Guías, ejemplos y referencias mantenidas por el equipo. Sin paywalls — todo abierto.",
  items = [
    {
      icon: "Terminal",
      title: "Quick start",
      desc: "De cero a producción en 5 minutos. Una sola línea para instalar el SDK.",
      href: "#qs",
    },
    {
      icon: "Code2",
      title: "API Reference",
      desc: "Documentación completa con ejemplos en TypeScript, Python, Go y curl.",
      href: "#api",
    },
    {
      icon: "FileText",
      title: "Guías",
      desc: "Tutoriales paso a paso para los flujos más comunes — sin saltarse nada.",
      href: "#guides",
    },
    {
      icon: "Sparkles",
      title: "Recetas",
      desc: "Snippets curados para casos reales: streaming, batching, retries, etc.",
      href: "#recipes",
    },
    {
      icon: "Github",
      title: "Open source",
      desc: "Cliente de referencia en GitHub. PRs y discusiones bienvenidas.",
      href: "#oss",
    },
    {
      icon: "ChevronDown",
      title: "Changelog",
      desc: "Cada release documentada — qué cambió, qué falta, qué viene.",
      href: "#changelog",
    },
  ],
}: NimbusDocsGridProps) {
  return (
    <div className="csm-show-nimbus csm-showcase">
      <section id={anchorId} className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              {eyebrow ? (
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">{eyebrow}</p>
              ) : null}
              <h2 className="csm-display text-4xl font-normal text-white md:text-6xl">{title}</h2>
            </div>
            {description ? <p className="max-w-md text-base text-white/60">{description}</p> : null}
          </FadeIn>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((d, i) => {
              const Icon =
                (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[d.icon] ??
                Sparkles;
              return (
                <FadeIn
                  key={`${d.title}-${i}`}
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
    </div>
  );
}

// ============================================================
// 3. QUICK START SPLIT — texto + code sample
// ============================================================
export type NimbusQuickStartProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  steps?: string[];
  codeFilename?: string;
  code?: string;
};

export function NimbusQuickStart({
  eyebrow = "Quick start",
  title = "5 minutos. Producción.",
  description = "Instala el SDK con un comando, configura tu API key, lanza tu primera petición. Sin más.",
  steps = [
    "1. npm install @nimbus/sdk",
    "2. Genera tu API key en /admin/keys",
    "3. Copia el snippet de la derecha",
    "4. Stream tu primera respuesta",
  ],
  codeFilename = "stream.ts",
  code = `import { Nimbus } from "@nimbus/sdk";

const client = new Nimbus({ apiKey: process.env.NIMBUS_KEY });

const result = await client.completions.create({
  model: "nimbus-1.5",
  prompt: "Crea un plan de marketing para una marca DTC.",
  stream: true,
});

for await (const chunk of result) {
  process.stdout.write(chunk.text);
}`,
}: NimbusQuickStartProps) {
  return (
    <div className="csm-show-nimbus csm-showcase">
      <section className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          <FadeIn x={-30}>
            {eyebrow ? (
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">{eyebrow}</p>
            ) : null}
            <h2 className="csm-display text-4xl font-normal text-white md:text-5xl">{title}</h2>
            {description ? <p className="mt-6 text-base text-white/70">{description}</p> : null}
            <div className="mt-8 flex flex-col gap-3">
              {steps.map((step, i) => (
                <div key={`${step}-${i}`} className="flex items-center gap-3 text-sm text-white/80">
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
                <span className="ml-3 font-mono text-xs text-white/40">{codeFilename}</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed text-white/90">
                <code>{code}</code>
              </pre>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 4. COMMUNITY CTA
// ============================================================
export type NimbusCommunityProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  buttonText?: string;
};

export function NimbusCommunity({
  eyebrow = "Comunidad",
  title = "8.000 desarrolladores activos en Discord.",
  description = "Encuentra respuestas en minutos. Sé de los primeros en enterarte de lo nuevo.",
  buttonText = "Únete a Discord →",
}: NimbusCommunityProps) {
  return (
    <div className="csm-show-nimbus csm-showcase">
      <section className="bg-[oklch(0.13_0.05_280)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <FadeIn>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">{eyebrow}</p>
            </FadeIn>
          ) : null}
          <FadeIn>
            <h2 className="csm-display text-4xl font-normal text-white md:text-6xl">{title}</h2>
          </FadeIn>
          {description ? (
            <FadeIn delay={0.1}>
              <p className="mt-6 text-lg text-white/70">{description}</p>
            </FadeIn>
          ) : null}
          {buttonText ? (
            <FadeIn delay={0.2}>
              <button
                type="button"
                className="mt-10 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white backdrop-blur transition-all hover:scale-105 hover:bg-white/10"
              >
                {buttonText}
              </button>
            </FadeIn>
          ) : null}
        </div>
      </section>
    </div>
  );
}
