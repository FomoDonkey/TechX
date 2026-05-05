"use client";

/**
 * Secciones de la plantilla `launch-marquee` (Securify+Targo B2B Dark).
 * 5 secciones: hero staggered + stats + glass widget, sectors marquee,
 * pillars, pricing 2-tier clipped, CTA. Reusa `.csm-show-securify`, `.csm-tight`, `.csm-clip-corners`.
 */

import { FadeIn, MarqueeRow, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { Phone, ShieldCheck } from "lucide-react";

type LinkItem = { label: string; href: string };
type StaggeredWord = { text: string; position: string };
type Stat = {
  value: string;
  label: string;
  position: string;
  divisor: "left" | "right";
  alignRight?: boolean;
};
type Pillar = { n: string; title: string; desc: string };
type PricingTier = {
  label: string;
  price: string;
  period?: string;
  features: string[];
  buttonText: string;
  featured?: boolean;
  highlight?: string;
};

// ============================================================
// 1. HERO — Staggered headline + stats + glass widget
// ============================================================
export type SecurifyHeroProps = {
  brand?: string;
  navItems?: LinkItem[];
  ctaText?: string;
  videoUrl?: string;
  staggeredWords?: StaggeredWord[];
  description?: string;
  descriptionPosition?: string;
  stats?: Stat[];
  widgetEyebrow?: string;
  widgetText?: string;
  widgetButtonText?: string;
};

export function SecurifyHero({
  brand = "securify",
  navItems = [
    { label: "Plataforma", href: "#plataforma" },
    { label: "Soluciones", href: "#soluciones" },
    { label: "Compañía", href: "#compania" },
    { label: "Soporte", href: "#soporte" },
  ],
  ctaText = "empezar →",
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4",
  staggeredWords = [
    { text: "protege", position: "absolute left-4 top-[18%] md:left-10" },
    { text: "tus", position: "absolute right-4 top-[36%] md:right-10" },
    { text: "datos", position: "absolute left-[18%] top-[56%] md:left-[28%]" },
  ],
  description = "guardamos tu información con el máximo cuidado y te damos privacidad en cada paso.",
  descriptionPosition = "absolute left-6 top-[44%] z-10 max-w-[280px] md:left-10",
  stats = [
    {
      value: "+65k",
      label: "startups confían",
      position: "absolute right-6 top-[14%] md:right-24",
      divisor: "left",
    },
    {
      value: "+1.5b",
      label: "gb de datos protegidos",
      position: "absolute left-6 bottom-20 md:left-20 md:bottom-24",
      divisor: "right",
    },
    {
      value: "+300k",
      label: "descargas",
      position: "absolute right-6 bottom-16 md:right-20 md:bottom-20",
      divisor: "left",
      alignRight: true,
    },
  ],
  widgetEyebrow = "consulta gratis",
  widgetText = "30 min con un experto en seguridad — auditoría rápida.",
  widgetButtonText = "Reservar llamada",
}: SecurifyHeroProps) {
  return (
    <div className="csm-show-securify csm-showcase">
      <section className="relative h-screen w-full overflow-hidden bg-black">
        {videoUrl ? (
          <VideoLoop src={videoUrl} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}

        <FadeIn
          y={-12}
          duration={0.6}
          className="absolute left-0 right-0 top-0 z-20 px-6 pt-6 md:px-10"
        >
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 rounded-full bg-neutral-900/85 px-4 py-3 pr-6 backdrop-blur-md">
              <ShieldCheck className="size-5 text-white" />
              <span className="text-sm font-normal tracking-tight text-white">{brand}</span>
            </div>
            {navItems.length > 0 ? (
              <div className="hidden items-center gap-1 rounded-full bg-neutral-900/85 px-3 py-2 backdrop-blur-md md:flex">
                {navItems.map((n, i) => (
                  <a
                    key={`${n.href}-${i}`}
                    href={n.href}
                    className="rounded-full px-5 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {n.label}
                  </a>
                ))}
              </div>
            ) : null}
            {ctaText ? (
              <button
                type="button"
                className="rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200"
              >
                {ctaText}
              </button>
            ) : null}
          </nav>
        </FadeIn>

        <div className="relative h-full w-full">
          {staggeredWords.map((w, i) => (
            <FadeIn
              key={`${w.text}-${i}`}
              delay={0.2 + i * 0.15}
              y={40}
              duration={0.9}
              as="h1"
              className={`csm-tight font-medium text-white ${w.position}`}
            >
              <span style={{ fontSize: "clamp(3rem, 14vw, 16vw)", display: "block" }}>
                {w.text}
              </span>
            </FadeIn>
          ))}

          {description ? (
            <FadeIn delay={0.65} duration={0.7} className={descriptionPosition}>
              <p className="text-sm leading-snug text-white/90 md:text-[15px]">{description}</p>
            </FadeIn>
          ) : null}

          {stats.map((stat, i) => (
            <StatBlock
              key={`${stat.value}-${i}`}
              position={stat.position}
              value={stat.value}
              label={stat.label}
              divisor={stat.divisor}
              delay={0.4 + i * 0.15}
              alignRight={stat.alignRight}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-black" />

        {widgetText ? (
          <FadeIn
            delay={0.85}
            duration={0.8}
            className="absolute bottom-6 left-6 z-30 md:bottom-10 md:left-10"
          >
            <div
              className="rounded-2xl border border-white/15 p-4 shadow-2xl"
              style={{
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.4)",
              }}
            >
              {widgetEyebrow ? (
                <p className="mb-2 text-[11px] uppercase tracking-widest text-white/60">
                  {widgetEyebrow}
                </p>
              ) : null}
              <p className="mb-3 max-w-[200px] text-sm leading-snug text-white">{widgetText}</p>
              {widgetButtonText ? (
                <button
                  type="button"
                  className="csm-clip-corners inline-flex items-center gap-2 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-black transition-transform hover:scale-105"
                  style={{
                    clipPath:
                      "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                  }}
                >
                  <Phone className="size-3.5" />
                  {widgetButtonText}
                </button>
              ) : null}
            </div>
          </FadeIn>
        ) : null}
      </section>
    </div>
  );
}

function StatBlock({
  position,
  value,
  label,
  divisor,
  delay,
  alignRight,
}: {
  position: string;
  value: string;
  label: string;
  divisor: "left" | "right";
  delay: number;
  alignRight?: boolean;
}) {
  return (
    <FadeIn delay={delay} duration={0.7} className={`${position} z-10`}>
      <div className={`flex items-center gap-3 ${alignRight ? "justify-end" : "justify-start"}`}>
        {divisor === "left" ? (
          <span className="hidden h-px w-24 rotate-[20deg] bg-white/40 md:block" />
        ) : null}
        <span className="text-4xl font-medium tracking-tight text-white md:text-5xl">{value}</span>
        {divisor === "right" ? (
          <span className="hidden h-px w-24 -rotate-[20deg] bg-white/40 md:block" />
        ) : null}
      </div>
      <p
        className={`mt-1 text-xs text-white/70 md:text-sm ${
          alignRight ? "text-right" : "text-left"
        }`}
      >
        {label}
      </p>
    </FadeIn>
  );
}

// ============================================================
// 2. SECTORS MARQUEE — horizontal autoplay
// ============================================================
export type SecuritySectorsProps = {
  eyebrow?: string;
  sectors?: string[];
  duration?: number;
};

export function SecuritySectors({
  eyebrow = "Implantado en",
  sectors = [
    "FinTech",
    "Sanidad",
    "Retail",
    "Logística",
    "Educación",
    "Gov",
    "Energía",
    "Industria",
  ],
  duration = 30,
}: SecuritySectorsProps) {
  return (
    <div className="csm-show-securify csm-showcase">
      <section className="border-y border-white/5 bg-black py-10">
        {eyebrow ? (
          <p className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-white/40">
            {eyebrow}
          </p>
        ) : null}
        <MarqueeRow autoplay autoplayDuration={duration}>
          {Array.from({ length: sectors.length * 3 }, (_, i) => ({
            id: `${sectors[i % sectors.length]}-${i}`,
            label: sectors[i % sectors.length] ?? "",
          })).map((s) => (
            <div
              key={s.id}
              className="flex flex-shrink-0 items-center gap-4 px-8 text-2xl font-medium text-white/40 md:text-3xl"
            >
              {s.label}
              <span className="size-1.5 rounded-full bg-white/30" />
            </div>
          ))}
        </MarqueeRow>
      </section>
    </div>
  );
}

// ============================================================
// 3. PILLARS — 3 col grid sin gap
// ============================================================
export type SecurityPillarsProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  pillars?: Pillar[];
};

export function SecurityPillars({
  eyebrow = "Pilares",
  title = "seguridad sin compromisos.",
  description = "Una plataforma diseñada con la convicción de que los datos de tus clientes son sagrados.",
  pillars = [
    {
      n: "01",
      title: "Cifrado en reposo y en tránsito",
      desc: "AES-256, claves rotadas automáticamente, KMS gestionado y mTLS para todos los servicios internos.",
    },
    {
      n: "02",
      title: "Cero confianza por diseño",
      desc: "Cada acción se autentica, autoriza y audita. Roles dinámicos, IP allowlist y MFA obligatorio en producción.",
    },
    {
      n: "03",
      title: "Compliance en serie",
      desc: "ISO 27001, SOC 2 Type II, GDPR y HIPAA — informes en un click para tu equipo legal.",
    },
  ],
}: SecurityPillarsProps) {
  return (
    <div className="csm-show-securify csm-showcase">
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-16 max-w-3xl">
            {eyebrow ? (
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">{eyebrow}</p>
            ) : null}
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">{title}</h2>
            {description ? <p className="mt-6 text-lg text-white/60">{description}</p> : null}
          </FadeIn>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
            {pillars.map((p, i) => (
              <FadeIn key={`${p.n}-${i}`} delay={i * 0.1} className="bg-black p-8 md:p-10">
                <p className="text-xs uppercase tracking-widest text-white/40">{p.n}</p>
                <h3 className="csm-tight mt-6 text-2xl font-medium text-white md:text-3xl">
                  {p.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-white/60">{p.desc}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 4. PRICING B2B — 2-tier with clipped corners
// ============================================================
export type SecurityPricingProps = {
  anchorId?: string;
  eyebrow?: string;
  title?: string;
  tiers?: PricingTier[];
};

export function SecurityPricing({
  anchorId = "precios",
  eyebrow = "Pricing",
  title = "transparente. previsible. sin sorpresas.",
  tiers = [
    {
      label: "Starter",
      price: "0€",
      period: "para empezar",
      features: ["Hasta 5 usuarios", "Cifrado AES-256", "Audit log básico", "Comunidad Discord"],
      buttonText: "Empezar gratis",
    },
    {
      label: "Enterprise",
      price: "12€",
      period: "por usuario / mes",
      features: [
        "Todo Starter +",
        "SSO + SCIM",
        "SOC 2 + ISO 27001 reports",
        "Audit log avanzado + SIEM export",
        "SLA 99.99 + soporte 24/7",
      ],
      buttonText: "Probar 30 días",
      featured: true,
      highlight: "Más popular",
    },
  ],
}: SecurityPricingProps) {
  return (
    <div className="csm-show-securify csm-showcase">
      <section
        id={anchorId}
        className="bg-gradient-to-b from-black to-neutral-950 px-6 py-28 md:py-40"
      >
        <div className="mx-auto max-w-5xl text-center">
          <FadeIn>
            {eyebrow ? (
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">{eyebrow}</p>
            ) : null}
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">{title}</h2>
          </FadeIn>
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            {tiers.map((t, i) => (
              <FadeIn key={`${t.label}-${i}`} delay={0.1 + i * 0.1}>
                {t.featured ? (
                  <div className="relative rounded-3xl border border-white p-8 text-left text-white md:p-10">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-3xl"
                      style={{
                        background:
                          "radial-gradient(ellipse at top, rgba(255,255,255,0.12) 0%, transparent 60%)",
                      }}
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-widest text-white/80">{t.label}</p>
                        {t.highlight ? (
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-black">
                            {t.highlight}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-6 text-5xl">{t.price}</p>
                      {t.period ? <p className="mt-2 text-sm text-white/60">{t.period}</p> : null}
                      <ul className="mt-8 space-y-3 text-sm">
                        {t.features.map((f, j) => (
                          <li key={`${f}-${j}`}>· {f}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="csm-clip-corners mt-10 w-full bg-white py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
                        style={{
                          clipPath:
                            "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                        }}
                      >
                        {t.buttonText}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left backdrop-blur md:p-10">
                    <p className="text-xs uppercase tracking-widest text-white/50">{t.label}</p>
                    <p className="mt-6 text-5xl text-white">{t.price}</p>
                    {t.period ? <p className="mt-2 text-sm text-white/60">{t.period}</p> : null}
                    <ul className="mt-8 space-y-3 text-sm text-white/80">
                      {t.features.map((f, j) => (
                        <li key={`${f}-${j}`}>· {f}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="mt-10 w-full rounded-full border border-white/20 py-3 text-sm text-white transition-colors hover:bg-white/10"
                    >
                      {t.buttonText}
                    </button>
                  </div>
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 5. CTA — clipped button + copyright
// ============================================================
export type SecurityCtaProps = {
  title?: string;
  description?: string;
  buttonText?: string;
  copyright?: string;
};

export function SecurityCta({
  title = "empieza a proteger en menos de 10 minutos.",
  description = "Sin tarjeta. Sin onboarding interminable. Sin sorpresas.",
  buttonText = "empezar →",
  copyright = "© 2026 securify. SOC 2 Type II · ISO 27001 · GDPR",
}: SecurityCtaProps) {
  return (
    <div className="csm-show-securify csm-showcase">
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          <FadeIn>
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">{title}</h2>
          </FadeIn>
          {description ? (
            <FadeIn delay={0.1}>
              <p className="text-base text-white/60">{description}</p>
            </FadeIn>
          ) : null}
          {buttonText ? (
            <FadeIn delay={0.2}>
              <button
                type="button"
                className="csm-clip-corners bg-white px-10 py-4 text-sm font-semibold uppercase tracking-widest text-black transition-transform hover:scale-105"
                style={{
                  clipPath:
                    "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                }}
              >
                {buttonText}
              </button>
            </FadeIn>
          ) : null}
          {copyright ? (
            <p className="mt-12 text-xs uppercase tracking-widest text-white/30">{copyright}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
