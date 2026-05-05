"use client";

/**
 * Showcase: Newsletter premium estilo Substack/Stratechery.
 * Hero serif cálido + signup card + preview número paywall + 1 testimonio
 * gigante + pricing 2-tier elegante. Sustituye "newsletter-typewriter".
 */

import { unsplash } from "@/templates/showcase/_lib/assets";
import { FadeIn } from "@/templates/showcase/_lib/primitives";
import { ArrowRight, Check, Lock, Mail, Quote } from "lucide-react";

const ARCHIVE = [
  {
    n: "#48",
    title: "El sesgo del fundador-narrador",
    excerpt: "Por qué la persona que mejor cuenta tu historia rara vez es quien la vivió.",
    minutes: "12 min",
    date: "1 abr 2026",
    free: false,
  },
  {
    n: "#47",
    title: "Por qué tu CRM no funciona",
    excerpt:
      "Tres razones por las que tu equipo de ventas pasa más tiempo introduciendo datos que vendiendo.",
    minutes: "14 min",
    date: "18 mar 2026",
    free: false,
  },
  {
    n: "#46",
    title: "Cómo distinguir un buen mentor del que solo necesita público",
    excerpt: "Un test de 4 preguntas que aún no he visto fallar.",
    minutes: "9 min",
    date: "11 mar 2026",
    free: true,
  },
  {
    n: "#45",
    title: "El mito del producto que se vende solo",
    excerpt:
      "Ningún producto se vende solo. Y los que lo parecen tienen detrás los mejores comerciales del mundo.",
    minutes: "8 min",
    date: "4 mar 2026",
    free: false,
  },
];

export function NewsletterTypewriterShowcase() {
  return (
    <div className="csm-show-substack csm-showcase">
      {/* ========== HEADER ========== */}
      <header className="border-b border-[#2a1f17]/15 bg-[#f4ecdf] px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-[#2a1f17] text-[#f4ecdf]">
              <Mail className="size-4" />
            </div>
            <div>
              <p
                className="csm-display text-2xl font-bold leading-none tracking-tight text-[#2a1f17]"
                style={{ fontFamily: '"Newsreader", "EB Garamond", serif' }}
              >
                El Boletín
              </p>
              <p className="csm-sans text-xs text-[#2a1f17]/60">por Edgar Vela · cada lunes</p>
            </div>
          </div>
          <button
            type="button"
            className="csm-sans rounded-full bg-[#2a1f17] px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-[#f4ecdf] transition-opacity hover:opacity-90"
          >
            Suscribirme
          </button>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="csm-sans mb-6 text-xs uppercase tracking-[0.3em] text-[#7c5e3f]">
              ✦ 12.840 suscriptores · 96% de retención · 4 años
            </p>
          </FadeIn>
          <FadeIn duration={0.9} y={30}>
            <h1
              className="csm-display text-balance font-semibold leading-[1.05] text-[#2a1f17]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
            >
              El boletín que tu jefe lee en{" "}
              <em className="italic" style={{ color: "#7c2d12" }}>
                secreto
              </em>
              .
            </h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="csm-sans mx-auto mt-8 max-w-xl text-lg leading-relaxed text-[#2a1f17]/75">
              Análisis sin filtros sobre la industria que nadie más se atreve a publicar. 4 números
              al mes para premium, 1 al mes gratis.
            </p>
          </FadeIn>

          {/* Signup card */}
          <FadeIn delay={0.25} className="mx-auto mt-12 max-w-md">
            <div className="rounded-2xl border border-[#2a1f17]/15 bg-white/60 p-6 shadow-[0_2px_8px_rgba(42,31,23,0.08)] backdrop-blur md:p-8">
              <p className="csm-sans mb-4 text-left text-xs uppercase tracking-widest text-[#7c5e3f]">
                Empieza gratis
              </p>
              <form className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="csm-sans rounded-full border border-[#2a1f17]/20 bg-white px-5 py-3 text-sm outline-none focus:border-[#2a1f17]/50"
                />
                <button
                  type="submit"
                  className="csm-sans inline-flex items-center justify-center gap-2 rounded-full bg-[#2a1f17] px-5 py-3 text-sm font-semibold text-[#f4ecdf] transition-transform hover:scale-[1.01]"
                >
                  Suscribirme gratis
                  <ArrowRight className="size-4" />
                </button>
              </form>
              <p className="csm-sans mt-4 text-xs text-[#2a1f17]/50">
                · 1 número al mes gratis · cancela cuando quieras · sin spam ·
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ========== PREVIEW ISSUE — paywall fade ========== */}
      <section className="bg-[#ede2cf] px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl">
          <FadeIn className="mb-2 flex items-center gap-3 text-xs uppercase tracking-widest text-[#7c5e3f]">
            <span>vista previa</span>
            <span>·</span>
            <span>número 47</span>
          </FadeIn>
          <FadeIn>
            <h2
              className="csm-display mt-4 text-balance font-semibold leading-[1.1] text-[#2a1f17]"
              style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
            >
              Por qué tu CRM no funciona y nadie quiere decírtelo
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="csm-sans mt-4 text-xs uppercase tracking-widest text-[#2a1f17]/50">
              18 marzo · 14 min lectura · solo premium
            </p>
          </FadeIn>

          <div className="relative mt-10 overflow-hidden">
            <FadeIn>
              <div
                className="space-y-5 text-lg leading-relaxed text-[#2a1f17]/85 md:text-xl"
                style={{ fontFamily: '"Newsreader", "EB Garamond", serif' }}
              >
                <p>
                  Hay tres razones por las que tu equipo de ventas pasa más tiempo introduciendo
                  datos que vendiendo. Y ninguna es la que te dijo el comercial de Salesforce.
                </p>
                <p>
                  La primera empieza en el día uno: nadie pregunta cómo trabaja tu equipo{" "}
                  <em>antes</em> de configurar el CRM. Lo configuran como configuran cualquier otro
                  CRM, y luego tu equipo se adapta — o pretende adaptarse, que es la versión que
                  terminas pagando.
                </p>
                <p>
                  La segunda es más sutil. Los KPIs que tu CRM mide son los que su modelo de datos
                  puede medir. No los que tu negocio necesita. Esto explica por qué tu pipeline está
                  siempre lleno y tu cuenta de resultados decepciona...
                </p>
              </div>
            </FadeIn>

            {/* Paywall fade */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-48"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(237,226,207,0) 0%, rgba(237,226,207,1) 80%)",
              }}
            />
          </div>

          <FadeIn className="mt-2 flex flex-col items-center gap-4 rounded-2xl border border-[#2a1f17]/20 bg-white/70 p-6 text-center backdrop-blur md:p-8">
            <div className="grid size-10 place-items-center rounded-full bg-[#2a1f17]/8 text-[#7c2d12]">
              <Lock className="size-4" />
            </div>
            <p className="csm-sans text-sm font-semibold uppercase tracking-widest text-[#2a1f17]">
              Sigue leyendo — solo premium
            </p>
            <p className="csm-sans max-w-md text-sm text-[#2a1f17]/65">
              Acceso a este número y 200+ del archivo · 8€/mes · cancela cuando quieras.
            </p>
            <button
              type="button"
              className="csm-sans mt-2 rounded-full bg-[#7c2d12] px-7 py-3 text-sm font-semibold text-[#f4ecdf] transition-transform hover:scale-105"
            >
              Hacerme premium
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ========== TESTIMONIO GIGANTE ========== */}
      <section className="bg-[#f4ecdf] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <Quote className="mx-auto size-12 text-[#7c2d12]/40" />
          </FadeIn>
          <FadeIn delay={0.1}>
            <p
              className="csm-display mt-8 text-balance leading-[1.2] text-[#2a1f17]"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              &ldquo;Es la única newsletter que no archivo. La leo el mismo lunes — y rara vez en la
              primera lectura, porque las ideas merecen volver.&rdquo;
            </p>
          </FadeIn>
          <FadeIn delay={0.2} className="mt-8 flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={unsplash("1573497019418-b400bb3ab074", 80, 80)}
              alt=""
              className="size-10 rounded-full object-cover"
            />
            <div className="text-left">
              <p className="csm-sans text-sm font-semibold text-[#2a1f17]">M. Sánchez</p>
              <p className="csm-sans text-xs text-[#2a1f17]/60">Director de marketing · SaaS B2B</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="bg-[#ede2cf] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-4xl">
          <FadeIn className="mb-16 text-center">
            <h2 className="csm-display text-4xl font-semibold text-[#2a1f17] md:text-5xl">
              Una suscripción, todo el archivo.
            </h2>
            <p className="csm-sans mt-4 text-base text-[#2a1f17]/65">
              Sin algoritmo. Sin tracking. Sin paywall predador.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FadeIn>
              <div className="flex h-full flex-col rounded-2xl border border-[#2a1f17]/15 bg-white/60 p-8 backdrop-blur md:p-10">
                <p className="csm-sans text-xs uppercase tracking-widest text-[#2a1f17]/60">
                  Gratis
                </p>
                <p
                  className="csm-display mt-6 font-semibold text-[#2a1f17]"
                  style={{ fontSize: "3.5rem", lineHeight: 1 }}
                >
                  0€
                </p>
                <p className="csm-sans mt-2 text-sm text-[#2a1f17]/60">para siempre</p>
                <ul className="csm-sans mt-8 flex-1 space-y-3 text-sm text-[#2a1f17]/85">
                  <PricingItem>1 número al mes</PricingItem>
                  <PricingItem>Acceso al último año</PricingItem>
                  <PricingItem>Comunidad pública</PricingItem>
                </ul>
                <button
                  type="button"
                  className="csm-sans mt-10 w-full rounded-full border border-[#2a1f17]/30 py-3 text-sm font-medium text-[#2a1f17] transition-colors hover:bg-[#2a1f17]/5"
                >
                  Suscribirme gratis
                </button>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="relative flex h-full flex-col rounded-2xl border-2 border-[#7c2d12] bg-[#2a1f17] p-8 text-[#f4ecdf] md:p-10">
                <span className="absolute -top-3 left-8 rounded-full bg-[#7c2d12] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
                  Recomendado
                </span>
                <p className="csm-sans text-xs uppercase tracking-widest text-[#f4ecdf]/70">
                  Premium
                </p>
                <div className="mt-6 flex items-baseline gap-2">
                  <p
                    className="csm-display font-semibold"
                    style={{ fontSize: "3.5rem", lineHeight: 1 }}
                  >
                    8€
                  </p>
                  <span className="csm-sans text-sm text-[#f4ecdf]/60">/ mes</span>
                </div>
                <p className="csm-sans mt-2 text-sm text-[#f4ecdf]/60">o 80€/año (-17%)</p>
                <ul className="csm-sans mt-8 flex-1 space-y-3 text-sm">
                  <PricingItem light>4 números al mes</PricingItem>
                  <PricingItem light>Archivo completo desde 2022</PricingItem>
                  <PricingItem light>Hilos privados Discord</PricingItem>
                  <PricingItem light>Q&amp;A trimestral en directo</PricingItem>
                  <PricingItem light>Cancela en 1 click</PricingItem>
                </ul>
                <button
                  type="button"
                  className="csm-sans mt-10 w-full rounded-full bg-[#f4ecdf] py-3 text-sm font-semibold text-[#2a1f17] transition-transform hover:scale-[1.01]"
                >
                  Hacerme premium
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ========== ARCHIVE PEEK ========== */}
      <section className="bg-[#f4ecdf] px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          <FadeIn className="mb-10 flex items-end justify-between">
            <h2 className="csm-display text-3xl font-semibold text-[#2a1f17] md:text-4xl">
              Del archivo
            </h2>
            <a href="#archive" className="csm-sans text-sm text-[#7c2d12] hover:underline">
              Ver todos →
            </a>
          </FadeIn>
          <ul className="space-y-1">
            {ARCHIVE.map((a, i) => (
              <FadeIn
                as="li"
                key={a.n}
                delay={i * 0.05}
                className="flex items-start justify-between gap-6 border-t border-[#2a1f17]/15 py-6"
              >
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#7c5e3f]">
                    <span>{a.n}</span>
                    <span>·</span>
                    <span>{a.date}</span>
                    <span>·</span>
                    <span>{a.minutes}</span>
                  </div>
                  <h3 className="csm-display text-xl font-semibold text-[#2a1f17] md:text-2xl">
                    {a.title}
                  </h3>
                  <p className="csm-sans text-sm text-[#2a1f17]/70">{a.excerpt}</p>
                </div>
                {a.free ? (
                  <span className="csm-sans shrink-0 rounded-full border border-[#365314]/30 bg-[#365314]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#365314]">
                    Gratis
                  </span>
                ) : (
                  <span className="csm-sans inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2a1f17]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#2a1f17]/70">
                    <Lock className="size-3" />
                    Premium
                  </span>
                )}
              </FadeIn>
            ))}
          </ul>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-[#2a1f17]/15 bg-[#ede2cf] px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="csm-sans text-xs text-[#2a1f17]/60">
            © 2026 El Boletín. Sin algoritmo. Sin tracking.
          </p>
          <div className="flex gap-4 text-xs text-[#2a1f17]/60">
            <a href="#sobre" className="hover:underline">
              Sobre
            </a>
            <a href="#privacidad" className="hover:underline">
              Privacidad
            </a>
            <a href="#baja" className="hover:underline">
              Darse de baja
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PricingItem({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
          light ? "bg-[#f4ecdf]/15 text-[#f4ecdf]" : "bg-[#365314]/15 text-[#365314]"
        }`}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}
