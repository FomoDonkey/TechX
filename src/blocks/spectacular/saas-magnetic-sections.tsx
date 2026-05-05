"use client";

/**
 * Secciones espectaculares de la plantilla `saas-magnetic` (Asme — Liquid Glass).
 *
 * Cada componente es un client component aislado que reproduce 1:1 una sección
 * de la showcase original (`templates/showcase/saas-magnetic.tsx`) pero
 * **parametrizado por props editables**. Los blocks `tpl-asme-*` del registry
 * delegan en estos componentes — preview = inserted page, paridad por construcción.
 *
 * Los defaults están en `src/templates/page-templates.ts` (`buildLayout()`).
 *
 * Mantiene el mismo CSS `.csm-show-asme` y primitives de `_lib/primitives.tsx`.
 */

import { FadeIn, LiquidGlass, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { ArrowRight, ArrowUpRight, Globe, Instagram, Twitter } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

// ============================================================
// Tipos compartidos
// ============================================================
type LinkItem = { label: string; href: string };
type ServiceCard = { tag: string; title: string; desc: string; videoUrl: string };
type SocialIcon = "instagram" | "twitter" | "globe";

const SOCIAL_MAP: Record<SocialIcon, LucideIcon> = {
  instagram: Instagram,
  twitter: Twitter,
  globe: Globe,
};

// ============================================================
// 1. HERO — video crossfade + glass nav + email pill + manifesto
// ============================================================
export type AsmeHeroProps = {
  brand?: string;
  navItems?: LinkItem[];
  signupText?: string;
  loginText?: string;
  loginHref?: string;
  videoUrl?: string;
  /** Soporta `<em>texto</em>` para italic Instrument Serif. */
  titleHtml?: string;
  emailPlaceholder?: string;
  subtitle?: string;
  manifestoText?: string;
  socials?: SocialIcon[];
};

export function AsmeHero({
  brand = "asme",
  navItems = [
    { label: "Producto", href: "#producto" },
    { label: "Precios", href: "#precios" },
    { label: "Sobre", href: "#sobre" },
  ],
  signupText = "Crear cuenta",
  loginText = "Iniciar sesión",
  loginHref = "#login",
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4",
  titleHtml = "Conoce <em>todo</em>",
  emailPlaceholder = "Tu email",
  subtitle = "Mantente al día con las novedades. Suscríbete y nunca te pierdas las actualizaciones más interesantes.",
  manifestoText = "Manifiesto",
  socials = ["instagram", "twitter", "globe"],
}: AsmeHeroProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="csm-show-asme csm-showcase">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-black">
        <VideoLoop
          src={videoUrl}
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-black/15" />

        {/* Navbar glass-pill */}
        <FadeIn duration={0.6} y={-12} className="relative z-20 px-6 py-6">
          <LiquidGlass
            rounded="full"
            className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
          >
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-white" />
                <span className="csm-sans text-lg font-semibold tracking-tight text-white">
                  {brand}
                </span>
              </div>
              <div className="ml-8 hidden gap-8 md:flex">
                {navItems.map((n) => (
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
              {signupText ? (
                <a
                  href="#signup"
                  className="csm-sans hidden text-sm text-white/80 transition-colors hover:text-white sm:inline-block"
                >
                  {signupText}
                </a>
              ) : null}
              {loginText ? (
                <LiquidGlass rounded="full" className="px-5 py-2">
                  <a href={loginHref} className="csm-sans text-sm font-medium text-white">
                    {loginText}
                  </a>
                </LiquidGlass>
              ) : null}
            </div>
          </LiquidGlass>
        </FadeIn>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 -translate-y-[8%] flex-col items-center justify-center gap-10 px-6 text-center">
          <FadeIn duration={1} y={20}>
            <h1
              className="whitespace-nowrap font-normal tracking-tight text-white"
              style={{ fontSize: "clamp(4rem, 12vw, 11rem)", lineHeight: 0.95 }}
              // titleHtml es controlado server-side via Zod (SaveSchema valida string max len);
              // permitimos sólo `<em>` para italic. Sanitización mínima inline.
              dangerouslySetInnerHTML={{ __html: sanitizeTitleHtml(titleHtml) }}
            />
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
                placeholder={emailPlaceholder}
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
            <p className="csm-sans max-w-xl text-sm leading-relaxed text-white/85">{subtitle}</p>
          </FadeIn>

          {manifestoText ? (
            <FadeIn duration={0.7} delay={0.4}>
              <LiquidGlass rounded="full" className="px-8 py-3">
                <button
                  type="button"
                  className="csm-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
                >
                  {manifestoText}
                </button>
              </LiquidGlass>
            </FadeIn>
          ) : null}
        </div>

        <FadeIn
          duration={0.7}
          delay={0.5}
          className="relative z-10 flex justify-center gap-4 pb-12"
        >
          {socials.map((s) => {
            const Icon = SOCIAL_MAP[s];
            return (
              <LiquidGlass key={s} rounded="full" className="p-3.5">
                <Icon className="size-5 text-white/80" />
              </LiquidGlass>
            );
          })}
        </FadeIn>
      </section>
    </div>
  );
}

/** Permite sólo `<em>` y `</em>` en el title — anti-XSS conservador. */
function sanitizeTitleHtml(raw: string): string {
  return raw.replace(/<(?!\/?em>)[^>]+>/gi, "");
}

// ============================================================
// 2. ABOUT — eyebrow + huge italic headline
// ============================================================
export type AsmeAboutProps = {
  eyebrow?: string;
  /** Soporta `<em>` para spans italic con white/60. */
  titleHtml?: string;
  anchorId?: string;
};

export function AsmeAbout({
  eyebrow = "Sobre nosotros",
  titleHtml = "Innovando <em>ideas</em> para<br/> <em>mentes que crean, construyen e inspiran.</em>",
  anchorId = "sobre",
}: AsmeAboutProps) {
  return (
    <div className="csm-show-asme csm-showcase">
      <section
        id={anchorId}
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
            <p className="csm-sans text-sm uppercase tracking-widest text-white/40">{eyebrow}</p>
          </FadeIn>
          <FadeIn duration={0.8} delay={0.1} y={40}>
            <h2
              className="mt-6 text-4xl leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl"
              dangerouslySetInnerHTML={{ __html: sanitizeAboutHtml(titleHtml) }}
            />
          </FadeIn>
        </div>
      </section>
    </div>
  );
}

function sanitizeAboutHtml(raw: string): string {
  // Permite <em>, </em>, <br/>, <br>, <span class="..."> blanco solamente.
  return raw.replace(/<(?!\/?(em|br)\b)[^>]+>/gi, "");
}

// ============================================================
// 3. FEATURED VIDEO — full-bleed video con glass card overlay
// ============================================================
export type AsmeFeaturedVideoProps = {
  videoUrl?: string;
  cardEyebrow?: string;
  cardText?: string;
  buttonText?: string;
};

export function AsmeFeaturedVideo({
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4",
  cardEyebrow = "Nuestro enfoque",
  cardText = "Creemos en el poder de la curiosidad. Cada proyecto empieza con una pregunta — y cada respuesta abre una nueva puerta a la innovación.",
  buttonText = "Explorar más",
}: AsmeFeaturedVideoProps) {
  return (
    <div className="csm-show-asme csm-showcase">
      <section className="bg-black px-6 pb-20 pt-6 md:pb-32 md:pt-10">
        <FadeIn
          duration={0.9}
          y={60}
          className="relative mx-auto aspect-video max-w-6xl overflow-hidden rounded-3xl"
        >
          <VideoLoop src={videoUrl} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
            <LiquidGlass rounded="2xl" className="max-w-md p-6 md:p-8">
              <p className="csm-sans mb-3 text-xs uppercase tracking-widest text-white/50">
                {cardEyebrow}
              </p>
              <p className="csm-sans text-sm leading-relaxed text-white md:text-base">{cardText}</p>
            </LiquidGlass>
            {buttonText ? (
              <LiquidGlass rounded="full" className="self-start px-8 py-3 md:self-end">
                <button
                  type="button"
                  className="csm-sans inline-flex items-center gap-2 text-sm font-medium text-white"
                >
                  {buttonText}
                  <ArrowUpRight className="size-3.5" />
                </button>
              </LiquidGlass>
            ) : null}
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

// ============================================================
// 4. SPLIT VISION — Innovation × Vision (video + text blocks divisor)
// ============================================================
export type AsmeSplitVisionProps = {
  /** Soporta `<em>` italic white/40 (e.g. "Innovación <em>×</em> Visión"). */
  titleHtml?: string;
  videoUrl?: string;
  block1Eyebrow?: string;
  block1Body?: string;
  block2Eyebrow?: string;
  block2Body?: string;
};

export function AsmeSplitVision({
  titleHtml = "Innovación <em>×</em> Visión",
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4",
  block1Eyebrow = "Elige tu espacio",
  block1Body = "Cada salto importante nace en la intersección entre estrategia disciplinada y visión creativa. Operamos en ese cruce, convirtiendo el pensamiento en resultados que mueven personas e industrias.",
  block2Eyebrow = "Da forma al futuro",
  block2Body = "Lo mejor surge cuando la curiosidad se encuentra con la convicción. Nuestro proceso descubre oportunidades ocultas y las traduce en experiencias que perduran.",
}: AsmeSplitVisionProps) {
  return (
    <div className="csm-show-asme csm-showcase">
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn duration={0.8} y={40}>
            <h2
              className="mb-16 tracking-tight text-white md:mb-24"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
              dangerouslySetInnerHTML={{ __html: sanitizeAboutHtml(titleHtml) }}
            />
          </FadeIn>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
            <FadeIn duration={0.8} x={-40}>
              <div className="aspect-[4/3] overflow-hidden rounded-3xl">
                <VideoLoop src={videoUrl} className="h-full w-full" fadeWindowSec={0.4} />
              </div>
            </FadeIn>
            <FadeIn duration={0.8} x={40}>
              <div className="flex flex-col gap-8">
                <div>
                  <p className="csm-sans mb-4 text-xs uppercase tracking-widest text-white/40">
                    {block1Eyebrow}
                  </p>
                  <p className="csm-sans text-base leading-relaxed text-white/80 md:text-lg">
                    {block1Body}
                  </p>
                </div>
                <div className="h-px w-full bg-white/10" />
                <div>
                  <p className="csm-sans mb-4 text-xs uppercase tracking-widest text-white/40">
                    {block2Eyebrow}
                  </p>
                  <p className="csm-sans text-base leading-relaxed text-white/80 md:text-lg">
                    {block2Body}
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 5. SERVICE CARDS — 2 cards glass con video bg
// ============================================================
export type AsmeServiceCardsProps = {
  anchorId?: string;
  sectionTitle?: string;
  sectionEyebrow?: string;
  cards?: ServiceCard[];
};

export function AsmeServiceCards({
  anchorId = "producto",
  sectionTitle = "Lo que hacemos",
  sectionEyebrow = "Nuestros servicios",
  cards = [
    {
      tag: "Estrategia",
      title: "Investigación e insight",
      desc: "Escarbamos en datos, cultura y comportamiento humano para encontrar los insights que generan cambios duraderos.",
      videoUrl:
        "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
    },
    {
      tag: "Craft",
      title: "Diseño y ejecución",
      desc: "Del concepto al lanzamiento, obsesionamos con cada detalle para entregar experiencias que parecen sin esfuerzo.",
      videoUrl:
        "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4",
    },
  ],
}: AsmeServiceCardsProps) {
  return (
    <div className="csm-show-asme csm-showcase">
      <section id={anchorId} className="relative overflow-hidden bg-black px-6 py-28 md:py-40">
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
            <h2 className="text-3xl tracking-tight text-white md:text-5xl">{sectionTitle}</h2>
            {sectionEyebrow ? (
              <p className="csm-sans hidden text-sm text-white/40 md:block">{sectionEyebrow}</p>
            ) : null}
          </FadeIn>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {cards.map((card, i) => (
              <FadeIn
                key={`${card.tag}-${i}`}
                delay={i * 0.15}
                duration={0.8}
                y={50}
                className="group"
              >
                <LiquidGlass rounded="3xl">
                  <div className="aspect-video overflow-hidden">
                    <VideoLoop
                      src={card.videoUrl}
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
    </div>
  );
}

// ============================================================
// 6. CTA — centered con glass button + copyright
// ============================================================
export type AsmeCtaProps = {
  eyebrow?: string;
  /** Soporta `<em>` italic white/60. */
  titleHtml?: string;
  buttonText?: string;
  buttonHref?: string;
  copyright?: string;
};

export function AsmeCta({
  eyebrow = "Empieza hoy",
  titleHtml = "Construye <em>algo distinto</em>",
  buttonText = "Empezar gratis →",
  buttonHref = "#",
  copyright = "© 2026 asme. Hecho con curiosidad.",
}: AsmeCtaProps) {
  return (
    <div className="csm-show-asme csm-showcase">
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
            <p className="csm-sans text-xs uppercase tracking-widest text-white/40">{eyebrow}</p>
          </FadeIn>
          <FadeIn>
            <h2
              className="text-5xl leading-tight tracking-tight text-white md:text-7xl"
              dangerouslySetInnerHTML={{ __html: sanitizeAboutHtml(titleHtml) }}
            />
          </FadeIn>
          {buttonText ? (
            <FadeIn delay={0.1}>
              <LiquidGlass rounded="full" className="px-10 py-4">
                <a
                  href={buttonHref}
                  className="csm-sans inline-block text-sm font-medium text-white"
                >
                  {buttonText}
                </a>
              </LiquidGlass>
            </FadeIn>
          ) : null}
          {copyright ? <p className="csm-sans mt-12 text-xs text-white/40">{copyright}</p> : null}
        </div>
      </section>
    </div>
  );
}
