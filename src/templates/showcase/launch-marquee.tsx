"use client";

/**
 * Showcase: B2B Launch — Security / Logistics dark con vídeo de fondo.
 * Hero con headline staggered en posiciones absolutas + 3 stat blocks +
 * nav neutral pill + bottom widget glassmorphism + clipped-corner CTAs.
 * Mezcla los estilos Securify y Targo. Sustituye "launch-marquee".
 */

import { VIDEOS } from "@/templates/showcase/_lib/assets";
import { FadeIn, MarqueeRow, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { Phone, ShieldCheck } from "lucide-react";

const NAV = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "Soluciones", href: "#soluciones" },
  { label: "Compañía", href: "#compania" },
  { label: "Soporte", href: "#soporte" },
];

const SECTORS = [
  "FinTech",
  "Sanidad",
  "Retail",
  "Logística",
  "Educación",
  "Gov",
  "Energía",
  "Industria",
];

const PILLARS = [
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
];

export function LaunchMarqueeShowcase() {
  return (
    <div className="csm-show-securify csm-showcase">
      {/* ============== HERO ============== */}
      <section className="relative h-screen w-full overflow-hidden bg-black">
        <VideoLoop
          src={VIDEOS.securifyHero}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Nav */}
        <FadeIn
          y={-12}
          duration={0.6}
          className="absolute left-0 right-0 top-0 z-20 px-6 pt-6 md:px-10"
        >
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 rounded-full bg-neutral-900/85 px-4 py-3 pr-6 backdrop-blur-md">
              <ShieldCheck className="size-5 text-white" />
              <span className="text-sm font-normal tracking-tight text-white">securify</span>
            </div>
            <div className="hidden items-center gap-1 rounded-full bg-neutral-900/85 px-3 py-2 backdrop-blur-md md:flex">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-5 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {n.label}
                </a>
              ))}
            </div>
            <button
              type="button"
              className="rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200"
            >
              empezar →
            </button>
          </nav>
        </FadeIn>

        {/* Foreground content */}
        <div className="relative h-full w-full">
          {/* Three giant staggered headline words */}
          <FadeIn
            delay={0.2}
            y={40}
            duration={0.9}
            as="h1"
            className="csm-tight absolute left-4 top-[18%] font-medium text-white md:left-10"
          >
            <span style={{ fontSize: "clamp(3rem, 14vw, 16vw)", display: "block" }}>protege</span>
          </FadeIn>
          <FadeIn
            delay={0.35}
            y={40}
            duration={0.9}
            as="h1"
            className="csm-tight absolute right-4 top-[36%] font-medium text-white md:right-10"
          >
            <span style={{ fontSize: "clamp(3rem, 14vw, 16vw)", display: "block" }}>tus</span>
          </FadeIn>
          <FadeIn
            delay={0.5}
            y={40}
            duration={0.9}
            as="h1"
            className="csm-tight absolute left-[18%] top-[56%] font-medium text-white md:left-[28%]"
          >
            <span style={{ fontSize: "clamp(3rem, 14vw, 16vw)", display: "block" }}>datos</span>
          </FadeIn>

          {/* Description */}
          <FadeIn
            delay={0.65}
            duration={0.7}
            className="absolute left-6 top-[44%] z-10 max-w-[280px] md:left-10"
          >
            <p className="text-sm leading-snug text-white/90 md:text-[15px]">
              guardamos tu información con el máximo cuidado y te damos privacidad en cada paso.
            </p>
          </FadeIn>

          {/* Stat top-right */}
          <Stat
            position="absolute right-6 top-[14%] md:right-24"
            value="+65k"
            label="startups confían"
            divisor="left"
            delay={0.4}
          />
          {/* Stat bottom-left */}
          <Stat
            position="absolute left-6 bottom-20 md:left-20 md:bottom-24"
            value="+1.5b"
            label="gb de datos protegidos"
            divisor="right"
            delay={0.6}
          />
          {/* Stat bottom-right */}
          <Stat
            position="absolute right-6 bottom-16 md:right-20 md:bottom-20"
            value="+300k"
            label="descargas"
            divisor="left"
            delay={0.7}
            alignRight
          />
        </div>

        {/* Bottom gradient overlay */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-black" />

        {/* Bottom-left consultation widget */}
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
            <p className="mb-2 text-[11px] uppercase tracking-widest text-white/60">
              consulta gratis
            </p>
            <p className="mb-3 max-w-[200px] text-sm leading-snug text-white">
              30 min con un experto en seguridad — auditoría rápida.
            </p>
            <button
              type="button"
              className="csm-clip-corners inline-flex items-center gap-2 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-black transition-transform hover:scale-105"
              style={{
                clipPath:
                  "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              }}
            >
              <Phone className="size-3.5" />
              Reservar llamada
            </button>
          </div>
        </FadeIn>
      </section>

      {/* ============== SECTORS MARQUEE ============== */}
      <section className="border-y border-white/5 bg-black py-10">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-white/40">
          Implantado en
        </p>
        <MarqueeRow autoplay autoplayDuration={30}>
          {Array.from({ length: SECTORS.length * 3 }, (_, i) => ({
            id: `${SECTORS[i % SECTORS.length]}-${i}`,
            label: SECTORS[i % SECTORS.length] ?? "",
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

      {/* ============== PILLARS ============== */}
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-16 max-w-3xl">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">Pilares</p>
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">
              seguridad sin compromisos.
            </h2>
            <p className="mt-6 text-lg text-white/60">
              Una plataforma diseñada con la convicción de que los datos de tus clientes son
              sagrados.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
            {PILLARS.map((p, i) => (
              <FadeIn key={p.n} delay={i * 0.1} className="bg-black p-8 md:p-10">
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

      {/* ============== PRICING B2B ============== */}
      <section
        id="precios"
        className="bg-gradient-to-b from-black to-neutral-950 px-6 py-28 md:py-40"
      >
        <div className="mx-auto max-w-5xl text-center">
          <FadeIn>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/50">Pricing</p>
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">
              transparente. previsible. sin sorpresas.
            </h2>
          </FadeIn>
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            <FadeIn delay={0.1}>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left backdrop-blur md:p-10">
                <p className="text-xs uppercase tracking-widest text-white/50">Starter</p>
                <p className="mt-6 text-5xl text-white">0€</p>
                <p className="mt-2 text-sm text-white/60">para empezar</p>
                <ul className="mt-8 space-y-3 text-sm text-white/80">
                  <li>· Hasta 5 usuarios</li>
                  <li>· Cifrado AES-256</li>
                  <li>· Audit log básico</li>
                  <li>· Comunidad Discord</li>
                </ul>
                <button
                  type="button"
                  className="mt-10 w-full rounded-full border border-white/20 py-3 text-sm text-white transition-colors hover:bg-white/10"
                >
                  Empezar gratis
                </button>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
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
                    <p className="text-xs uppercase tracking-widest text-white/80">Enterprise</p>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-black">
                      Más popular
                    </span>
                  </div>
                  <p className="mt-6 text-5xl">12€</p>
                  <p className="mt-2 text-sm text-white/60">por usuario / mes</p>
                  <ul className="mt-8 space-y-3 text-sm">
                    <li>· Todo Starter +</li>
                    <li>· SSO + SCIM</li>
                    <li>· SOC 2 + ISO 27001 reports</li>
                    <li>· Audit log avanzado + SIEM export</li>
                    <li>· SLA 99.99 + soporte 24/7</li>
                  </ul>
                  <button
                    type="button"
                    className="csm-clip-corners mt-10 w-full bg-white py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
                    style={{
                      clipPath:
                        "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                    }}
                  >
                    Probar 30 días
                  </button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section className="bg-black px-6 py-28 md:py-40">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          <FadeIn>
            <h2 className="csm-tight text-4xl font-medium text-white md:text-6xl">
              empieza a proteger en menos de 10 minutos.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-base text-white/60">
              Sin tarjeta. Sin onboarding interminable. Sin sorpresas.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <button
              type="button"
              className="csm-clip-corners bg-white px-10 py-4 text-sm font-semibold uppercase tracking-widest text-black transition-transform hover:scale-105"
              style={{
                clipPath:
                  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
              }}
            >
              empezar →
            </button>
          </FadeIn>
          <p className="mt-12 text-xs uppercase tracking-widest text-white/30">
            © 2026 securify. SOC 2 Type II · ISO 27001 · GDPR
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
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
