"use client";

/**
 * Secciones de la plantilla `coming-soon-typewriter` (Mint pre-launch).
 * 3 secciones: hero countdown + perks 3-col + roadmap.
 */

import { FadeIn, LiquidGlass, VideoLoop } from "@/templates/showcase/_lib/primitives";
import * as Icons from "lucide-react";
import { ArrowRight, Bell, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type CountdownLabels = { days: string; hours: string; minutes: string; seconds: string };
type Perk = { icon: string; title: string; desc: string };
type RoadmapItem = { date: string; label: string; done: boolean };

// ============================================================
// 1. HERO — Logo + badge + h1 + countdown + email + disclaimer
// ============================================================
export type MintHeroProps = {
  logoLabel?: string;
  notifyButtonText?: string;
  videoUrl?: string;
  badge?: string;
  /** Soporta `<em>cocinándose</em>` para gradient italic. */
  titleHtml?: string;
  description?: string;
  /** ISO date string. Si vacío, no muestra countdown. */
  targetDate?: string;
  countdownLabels?: CountdownLabels;
  emailPlaceholder?: string;
  successMessage?: string;
  disclaimer?: string;
};

export function MintHero({
  logoLabel = "terra",
  notifyButtonText = "Avísame al lanzar",
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4",
  badge = "✦ Q2 2026 · early access",
  titleHtml = "Algo grande está <em>cocinándose</em>.",
  description = "Suscríbete y serás de los primeros en saberlo. Sin spam — solo el aviso del lanzamiento.",
  targetDate = "2026-08-15T10:00:00Z",
  countdownLabels = { days: "días", hours: "horas", minutes: "min", seconds: "seg" },
  emailPlaceholder = "tu@email.com",
  successMessage = "✓ Recibido — te avisaremos en cuanto abramos.",
  disclaimer = "· 1.420 personas ya en la lista · sin spam · cancela en 1 click ·",
}: MintHeroProps) {
  const target = targetDate ? new Date(targetDate).getTime() : 0;
  const [now, setNow] = useState<number>(() => Date.now());
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const distance = Math.max(0, target - now);
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  return (
    <div className="csm-show-mint csm-showcase">
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="absolute inset-0">
          {videoUrl ? (
            <VideoLoop
              src={videoUrl}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          ) : null}
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

        <FadeIn duration={0.6} y={-12} className="relative z-10 px-6 py-6 md:px-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-[#4ee0a5]">
                <Sparkles className="size-4 text-[#0d1f1c]" />
              </div>
              <span className="text-base font-semibold text-white">{logoLabel}</span>
            </div>
            {notifyButtonText ? (
              <button
                type="button"
                className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
              >
                <Bell className="size-3.5" />
                {notifyButtonText}
              </button>
            ) : null}
          </div>
        </FadeIn>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-12 px-6 py-12 text-center">
          {badge ? (
            <FadeIn>
              <span className="rounded-full border border-[#4ee0a5]/40 bg-[#4ee0a5]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[#4ee0a5]">
                {badge}
              </span>
            </FadeIn>
          ) : null}

          <FadeIn duration={0.9} y={30}>
            <h1
              className="mx-auto max-w-4xl text-balance font-semibold leading-[0.95] tracking-tight text-white"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
              dangerouslySetInnerHTML={{
                __html: gradientItalicEm(titleHtml),
              }}
            />
          </FadeIn>

          {description ? (
            <FadeIn delay={0.15}>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
                {description}
              </p>
            </FadeIn>
          ) : null}

          {targetDate ? (
            <FadeIn delay={0.25}>
              <div className="grid grid-cols-4 gap-3 md:gap-6">
                {[
                  { label: countdownLabels.days, value: days },
                  { label: countdownLabels.hours, value: hours },
                  { label: countdownLabels.minutes, value: minutes },
                  { label: countdownLabels.seconds, value: seconds },
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
          ) : null}

          <FadeIn delay={0.4}>
            {submitted ? (
              <LiquidGlass rounded="full" className="px-6 py-3">
                <span className="text-sm text-[#4ee0a5]">{successMessage}</span>
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
                    placeholder={emailPlaceholder}
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

          {disclaimer ? (
            <FadeIn delay={0.5}>
              <p className="text-xs text-white/40">{disclaimer}</p>
            </FadeIn>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Convierte `<em>texto</em>` en gradient italic mint. Anti-XSS: solo el patrón. */
function gradientItalicEm(raw: string): string {
  if (!raw) return "";
  const safe = raw.replace(/<(?!\/?em\b)[^>]*>/gi, "");
  return safe.replace(
    /<em>([^<]+)<\/em>/gi,
    '<span class="bg-gradient-to-r from-[#4ee0a5] to-[#7ff0c5] bg-clip-text text-transparent" style="font-style:italic">$1</span>',
  );
}

// ============================================================
// 2. PERKS — 3 cards con icon + title + desc
// ============================================================
export type MintPerksProps = {
  eyebrow?: string;
  title?: string;
  perks?: Perk[];
};

export function MintPerks({
  eyebrow = "Lo que estamos construyendo",
  title = "Hecho para personas que valoran el detalle.",
  perks = [
    {
      icon: "Zap",
      title: "10× más rápido",
      desc: "Renderizado con cache inteligente y edge runtime.",
    },
    {
      icon: "Sparkles",
      title: "Sin curva",
      desc: "Diseñado para que entres al toque, sin onboarding.",
    },
    {
      icon: "Heart",
      title: "Con cariño",
      desc: "Pequeño equipo, mantenido en abierto, escuchando feedback.",
    },
  ],
}: MintPerksProps) {
  return (
    <div className="csm-show-mint csm-showcase">
      <section className="bg-gradient-to-b from-[#0a1814] to-[#070f0c] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="mb-16 text-center">
            {eyebrow ? (
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#4ee0a5]">{eyebrow}</p>
            ) : null}
            <h2 className="text-4xl font-semibold text-white md:text-5xl">{title}</h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {perks.map((p, i) => {
              const Icon =
                (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[p.icon] ??
                Sparkles;
              return (
                <FadeIn
                  key={`${p.title}-${i}`}
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
    </div>
  );
}

// ============================================================
// 3. ROADMAP — Timeline horizontal
// ============================================================
export type MintRoadmapProps = {
  eyebrow?: string;
  title?: string;
  items?: RoadmapItem[];
  doneLabel?: string;
  pendingLabel?: string;
};

export function MintRoadmap({
  eyebrow = "Roadmap",
  title = "De aquí al lanzamiento",
  items = [
    { date: "Q1 2026", label: "Closed alpha · 50 usuarios", done: true },
    { date: "Q2 2026", label: "Public beta · sin lista de espera", done: true },
    { date: "Q3 2026", label: "Lanzamiento general", done: false },
    { date: "Q4 2026", label: "Plan empresa + SSO", done: false },
  ],
  doneLabel = "Listo",
  pendingLabel = "Próximamente",
}: MintRoadmapProps) {
  return (
    <div className="csm-show-mint csm-showcase">
      <section className="bg-[#070f0c] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl">
          <FadeIn className="mb-12 text-center">
            {eyebrow ? (
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#4ee0a5]">{eyebrow}</p>
            ) : null}
            <h2 className="text-3xl font-semibold text-white md:text-4xl">{title}</h2>
          </FadeIn>

          <div className="space-y-1">
            {items.map((r, i) => (
              <FadeIn
                key={`${r.date}-${i}`}
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
                  {r.done ? doneLabel : pendingLabel}
                </span>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
