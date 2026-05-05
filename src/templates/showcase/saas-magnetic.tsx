"use client";

/**
 * Showcase: SaaS Liquid Glass (Asme-style).
 * Hero con vídeo crossfade + nav glass-pill + about + featured video full-bleed
 * + Innovation x Vision + 2 service cards. Sustituye "saas-magnetic".
 */

import { VIDEOS } from "@/templates/showcase/_lib/assets";
import { FadeIn, LiquidGlass, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { ArrowRight, ArrowUpRight, Globe, Instagram, Twitter } from "lucide-react";
import { useState } from "react";

const NAV = [
  { label: "Producto", href: "#producto" },
  { label: "Precios", href: "#precios" },
  { label: "Sobre", href: "#sobre" },
];

export function SaasMagneticShowcase() {
  const [email, setEmail] = useState("");

  return (
    <div className="csm-show-asme csm-showcase">
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-black">
        <VideoLoop
          src={VIDEOS.asmeHero}
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-black/15" />

        {/* Navbar */}
        <FadeIn duration={0.6} y={-12} className="relative z-20 px-6 py-6">
          <LiquidGlass
            rounded="full"
            className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
          >
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-white" />
                <span className="csm-sans text-lg font-semibold tracking-tight text-white">
                  asme
                </span>
              </div>
              <div className="ml-8 hidden gap-8 md:flex">
                {NAV.map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    className="csm-sans text-sm font-medium text-white/80 transition-colors hover:text-white"
                  >
                    {n.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="#signup"
                className="csm-sans hidden text-sm text-white/80 transition-colors hover:text-white sm:inline-block"
              >
                Crear cuenta
              </a>
              <LiquidGlass rounded="full" className="px-5 py-2">
                <a href="#login" className="csm-sans text-sm font-medium text-white">
                  Iniciar sesión
                </a>
              </LiquidGlass>
            </div>
          </LiquidGlass>
        </FadeIn>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 -translate-y-[8%] flex-col items-center justify-center gap-10 px-6 text-center">
          <FadeIn duration={1} y={20}>
            <h1
              className="whitespace-nowrap font-normal tracking-tight text-white"
              style={{ fontSize: "clamp(4rem, 12vw, 11rem)", lineHeight: 0.95 }}
            >
              Conoce <em className="italic">todo</em>
            </h1>
          </FadeIn>

          <FadeIn duration={0.8} delay={0.2}>
            <LiquidGlass
              rounded="full"
              className="flex w-full max-w-xl items-center gap-3 py-2 pl-6 pr-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                className="csm-sans flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                <ArrowRight className="size-4" />
              </button>
            </LiquidGlass>
          </FadeIn>

          <FadeIn duration={0.7} delay={0.3}>
            <p className="csm-sans max-w-xl text-sm leading-relaxed text-white/85">
              Mantente al día con las novedades. Suscríbete y nunca te pierdas las actualizaciones
              más interesantes.
            </p>
          </FadeIn>

          <FadeIn duration={0.7} delay={0.4}>
            <LiquidGlass rounded="full" className="px-8 py-3">
              <button
                type="button"
                className="csm-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
              >
                Manifiesto
              </button>
            </LiquidGlass>
          </FadeIn>
        </div>

        <FadeIn
          duration={0.7}
          delay={0.5}
          className="relative z-10 flex justify-center gap-4 pb-12"
        >
          <SocialPill Icon={Instagram} />
          <SocialPill Icon={Twitter} />
          <SocialPill Icon={Globe} />
        </FadeIn>
      </section>

      {/* ============ ABOUT ============ */}
      <section
        id="sobre"
        className="relative overflow-hidden bg-black px-6 pb-10 pt-32 md:pb-14 md:pt-44"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(255,255,255,0.04) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <FadeIn duration={0.6}>
            <p className="csm-sans text-sm uppercase tracking-widest text-white/40">
              Sobre nosotros
            </p>
          </FadeIn>
          <FadeIn duration={0.8} delay={0.1} y={40}>
            <h2 className="mt-6 text-4xl leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
              Innovando <span className="italic text-white/60">ideas</span> para
              <br className="hidden md:block" />{" "}
              <span className="italic text-white/60">mentes que crean, construyen e inspiran.</span>
            </h2>
          </FadeIn>
        </div>
      </section>

      {/* ============ FEATURED VIDEO ============ */}
      <section className="bg-black px-6 pb-20 pt-6 md:pb-32 md:pt-10">
        <FadeIn
          duration={0.9}
          y={60}
          className="relative mx-auto aspect-video max-w-6xl overflow-hidden rounded-3xl"
        >
          <VideoLoop src={VIDEOS.asmeFeatured} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
            <LiquidGlass rounded="2xl" className="max-w-md p-6 md:p-8">
              <p className="csm-sans mb-3 text-xs uppercase tracking-widest text-white/50">
                Nuestro enfoque
              </p>
              <p className="csm-sans text-sm leading-relaxed text-white md:text-base">
                Creemos en el poder de la curiosidad. Cada proyecto empieza con una pregunta — y
                cada respuesta abre una nueva puerta a la innovación.
              </p>
            </LiquidGlass>
            <LiquidGlass rounded="full" className="self-start px-8 py-3 md:self-end">
              <button
                type="button"
                className="csm-sans inline-flex items-center gap-2 text-sm font-medium text-white"
              >
                Explorar más
                <ArrowUpRight className="size-3.5" />
              </button>
            </LiquidGlass>
          </div>
        </FadeIn>
      </section>

      {/* ============ INNOVATION x VISION ============ */}
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn duration={0.8} y={40}>
            <h2
              className="mb-16 tracking-tight text-white md:mb-24"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
            >
              Innovación <span className="italic text-white/40">×</span> Visión
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
            <FadeIn duration={0.8} x={-40}>
              <div className="aspect-[4/3] overflow-hidden rounded-3xl">
                <VideoLoop
                  src={VIDEOS.asmePhilosophy}
                  className="h-full w-full"
                  fadeWindowSec={0.4}
                />
              </div>
            </FadeIn>
            <FadeIn duration={0.8} x={40}>
              <div className="flex flex-col gap-8">
                <div>
                  <p className="csm-sans mb-4 text-xs uppercase tracking-widest text-white/40">
                    Elige tu espacio
                  </p>
                  <p className="csm-sans text-base leading-relaxed text-white/80 md:text-lg">
                    Cada salto importante nace en la intersección entre estrategia disciplinada y
                    visión creativa. Operamos en ese cruce, convirtiendo el pensamiento en
                    resultados que mueven personas e industrias.
                  </p>
                </div>
                <div className="h-px w-full bg-white/10" />
                <div>
                  <p className="csm-sans mb-4 text-xs uppercase tracking-widest text-white/40">
                    Da forma al futuro
                  </p>
                  <p className="csm-sans text-base leading-relaxed text-white/80 md:text-lg">
                    Lo mejor surge cuando la curiosidad se encuentra con la convicción. Nuestro
                    proceso descubre oportunidades ocultas y las traduce en experiencias que
                    perduran.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ SERVICES ============ */}
      <section id="producto" className="relative overflow-hidden bg-black px-6 py-28 md:py-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.025) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <FadeIn duration={0.7} y={30} className="mb-12 flex items-end justify-between">
            <h2 className="text-3xl tracking-tight text-white md:text-5xl">Lo que hacemos</h2>
            <p className="csm-sans hidden text-sm text-white/40 md:block">Nuestros servicios</p>
          </FadeIn>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {[
              {
                tag: "Estrategia",
                title: "Investigación e insight",
                desc: "Escarbamos en datos, cultura y comportamiento humano para encontrar los insights que generan cambios duraderos.",
                video: VIDEOS.asmeService1,
              },
              {
                tag: "Craft",
                title: "Diseño y ejecución",
                desc: "Del concepto al lanzamiento, obsesionamos con cada detalle para entregar experiencias que parecen sin esfuerzo.",
                video: VIDEOS.asmeService2,
              },
            ].map((card, i) => (
              <FadeIn key={card.tag} delay={i * 0.15} duration={0.8} y={50} className="group">
                <LiquidGlass rounded="3xl">
                  <div className="aspect-video overflow-hidden">
                    <VideoLoop
                      src={card.video}
                      className="h-full w-full transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="bg-gradient-to-t from-black/40 to-transparent p-6 md:p-8">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="csm-sans text-xs uppercase tracking-widest text-white/40">
                        {card.tag}
                      </p>
                      <LiquidGlass rounded="full" className="p-2">
                        <ArrowUpRight className="size-4 text-white" />
                      </LiquidGlass>
                    </div>
                    <h3 className="mb-3 text-xl tracking-tight text-white md:text-2xl">
                      {card.title}
                    </h3>
                    <p className="csm-sans text-sm leading-relaxed text-white/60">{card.desc}</p>
                  </div>
                </LiquidGlass>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative overflow-hidden bg-black px-6 py-28 md:py-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(255,255,255,0.05) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-10 text-center">
          <FadeIn>
            <p className="csm-sans text-xs uppercase tracking-widest text-white/40">Empieza hoy</p>
          </FadeIn>
          <FadeIn>
            <h2 className="text-5xl leading-tight tracking-tight text-white md:text-7xl">
              Construye <em className="italic text-white/60">algo distinto</em>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <LiquidGlass rounded="full" className="px-10 py-4">
              <button type="button" className="csm-sans text-sm font-medium text-white">
                Empezar gratis →
              </button>
            </LiquidGlass>
          </FadeIn>
          <p className="csm-sans mt-12 text-xs text-white/40">© 2026 asme. Hecho con curiosidad.</p>
        </div>
      </section>
    </div>
  );
}

function SocialPill({ Icon }: { Icon: typeof Globe }) {
  return (
    <LiquidGlass rounded="full" className="p-3.5">
      <Icon className="size-5 text-white/80" />
    </LiquidGlass>
  );
}
