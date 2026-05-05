"use client";

/**
 * Showcase: Coming Soon — pre-launch con countdown + email capture.
 * Hero centrado con vídeo abstracto + countdown + email + perks list +
 * teaser features. Sustituye "coming-soon-typewriter".
 */

import { VIDEOS } from "@/templates/showcase/_lib/assets";
import { FadeIn, LiquidGlass, VideoLoop } from "@/templates/showcase/_lib/primitives";
import { ArrowRight, Bell, Heart, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const PERKS = [
  { icon: Zap, title: "10× más rápido", desc: "Renderizado con cache inteligente y edge runtime." },
  {
    icon: Sparkles,
    title: "Sin curva",
    desc: "Diseñado para que entres al toque, sin onboarding.",
  },
  {
    icon: Heart,
    title: "Con cariño",
    desc: "Pequeño equipo, mantenido en abierto, escuchando feedback.",
  },
];

const TARGET = new Date("2026-08-15T10:00:00Z").getTime();

export function ComingSoonTypewriterShowcase() {
  const [now, setNow] = useState<number>(() => Date.now());
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const distance = Math.max(0, TARGET - now);
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  return (
    <div className="csm-show-mint csm-showcase">
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Background gradient + animated mesh */}
        <div className="absolute inset-0">
          <VideoLoop
            src={VIDEOS.asmePhilosophy}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(78, 224, 165, 0.18) 0%, transparent 50%), radial-gradient(circle at 75% 80%, rgba(78, 224, 165, 0.10) 0%, transparent 50%)",
            }}
          />
          <div className="absolute inset-0 bg-[#0d1f1c]/40" />
        </div>

        {/* Top bar */}
        <FadeIn duration={0.6} y={-12} className="relative z-10 px-6 py-6 md:px-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-[#4ee0a5]">
                <Sparkles className="size-4 text-[#0d1f1c]" />
              </div>
              <span className="text-base font-semibold text-white">terra</span>
            </div>
            <button
              type="button"
              className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
            >
              <Bell className="size-3.5" />
              Avísame al lanzar
            </button>
          </div>
        </FadeIn>

        {/* Hero */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-12 px-6 py-12 text-center">
          <FadeIn>
            <span className="rounded-full border border-[#4ee0a5]/40 bg-[#4ee0a5]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[#4ee0a5]">
              ✦ Q2 2026 · early access
            </span>
          </FadeIn>

          <FadeIn duration={0.9} y={30}>
            <h1
              className="mx-auto max-w-4xl text-balance font-semibold leading-[0.95] tracking-tight text-white"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
            >
              Algo grande está{" "}
              <span
                className="bg-gradient-to-r from-[#4ee0a5] to-[#7ff0c5] bg-clip-text text-transparent"
                style={{ fontStyle: "italic" }}
              >
                cocinándose
              </span>
              .
            </h1>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              Suscríbete y serás de los primeros en saberlo. Sin spam — solo el aviso del
              lanzamiento.
            </p>
          </FadeIn>

          {/* Countdown */}
          <FadeIn delay={0.25}>
            <div className="grid grid-cols-4 gap-3 md:gap-6">
              {[
                { label: "días", value: days },
                { label: "horas", value: hours },
                { label: "min", value: minutes },
                { label: "seg", value: seconds },
              ].map((c) => (
                <LiquidGlass
                  key={c.label}
                  rounded="2xl"
                  className="flex w-20 flex-col items-center px-2 py-4 md:w-28 md:px-4 md:py-6"
                >
                  <span className="text-3xl font-semibold tabular-nums text-white md:text-5xl">
                    {String(c.value).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-widest text-white/50 md:text-xs">
                    {c.label}
                  </span>
                </LiquidGlass>
              ))}
            </div>
          </FadeIn>

          {/* Email capture */}
          <FadeIn delay={0.4}>
            {submitted ? (
              <LiquidGlass rounded="full" className="px-6 py-3">
                <span className="text-sm text-[#4ee0a5]">
                  ✓ Recibido — te avisaremos en cuanto abramos.
                </span>
              </LiquidGlass>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email) setSubmitted(true);
                }}
                className="flex w-full max-w-md items-center gap-2"
              >
                <LiquidGlass rounded="full" className="flex flex-1 items-center px-5 py-1">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder="tu@email.com"
                    className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/40"
                  />
                </LiquidGlass>
                <button
                  type="submit"
                  className="grid size-12 place-items-center rounded-full bg-[#4ee0a5] text-[#0d1f1c] transition-transform hover:scale-105"
                >
                  <ArrowRight className="size-5" />
                </button>
              </form>
            )}
          </FadeIn>

          <FadeIn delay={0.5}>
            <p className="text-xs text-white/40">
              · 1.420 personas ya en la lista · sin spam · cancela en 1 click ·
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============== PERKS ============== */}
      <section className="bg-gradient-to-b from-[#0a1814] to-[#070f0c] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="mb-16 text-center">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#4ee0a5]">
              Lo que estamos construyendo
            </p>
            <h2 className="text-4xl font-semibold text-white md:text-5xl">
              Hecho para personas que valoran el detalle.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PERKS.map((p, i) => {
              const Icon = p.icon;
              return (
                <FadeIn
                  key={p.title}
                  delay={i * 0.1}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur"
                >
                  <div className="mb-5 grid size-12 place-items-center rounded-xl bg-[#4ee0a5]/15 text-[#4ee0a5]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{p.desc}</p>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== ROADMAP ============== */}
      <section className="bg-[#070f0c] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl">
          <FadeIn className="mb-12 text-center">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#4ee0a5]">Roadmap</p>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              De aquí al lanzamiento
            </h2>
          </FadeIn>

          <div className="space-y-1">
            {[
              { date: "Q1 2026", label: "Closed alpha · 50 usuarios", done: true },
              { date: "Q2 2026", label: "Public beta · sin lista de espera", done: true },
              { date: "Q3 2026", label: "Lanzamiento general", done: false },
              { date: "Q4 2026", label: "Plan empresa + SSO", done: false },
            ].map((r) => (
              <FadeIn
                key={r.date}
                className="flex items-center gap-6 border-t border-white/10 py-5"
              >
                <span className="w-24 shrink-0 text-xs uppercase tracking-widest text-white/40">
                  {r.date}
                </span>
                <div className="flex-1">
                  <p className="text-base text-white">{r.label}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${
                    r.done ? "bg-[#4ee0a5]/15 text-[#4ee0a5]" : "bg-white/5 text-white/40"
                  }`}
                >
                  {r.done ? "Listo" : "Próximamente"}
                </span>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
