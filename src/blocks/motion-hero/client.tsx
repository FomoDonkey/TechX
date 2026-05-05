"use client";

import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type MotionHeroVariant =
  | "aurora"
  | "magnetic"
  | "spotlight"
  | "typewriter"
  | "marquee"
  | "particles";

export type MotionHeroProps = {
  variant: MotionHeroVariant;
  badge?: string;
  title: string;
  subtitle?: string;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
  /** Para el variant "marquee": lista de logos / textos a desfilar. */
  marqueeItems?: string[];
};

/**
 * Client component master que delega a la variant correcta. Cada variant es
 * un sub-render para mantener la spec del bloque server-renderable: el server
 * solo emite `<MotionHero variant="..." {...props}/>` y este client lo hidrata.
 */
export function MotionHero(props: MotionHeroProps) {
  switch (props.variant) {
    case "magnetic":
      return <MagneticHero {...props} />;
    case "spotlight":
      return <SpotlightHero {...props} />;
    case "typewriter":
      return <TypewriterHero {...props} />;
    case "marquee":
      return <MarqueeHero {...props} />;
    case "particles":
      return <ParticlesHero {...props} />;
    default:
      return <AuroraHero {...props} />;
  }
}

// ============================================================
// Shared content shell
// ============================================================
function HeroContent({
  badge,
  title,
  subtitle,
  primaryText,
  primaryHref,
  secondaryText,
  secondaryHref,
  titleSlot,
}: MotionHeroProps & { titleSlot?: ReactNode }) {
  return (
    <div
      data-csm-target="hero-center"
      className="relative z-10 mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center px-4 text-center"
    >
      {badge ? (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium backdrop-blur"
        >
          {badge}
        </motion.span>
      ) : null}

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
      >
        {titleSlot ?? title}
      </motion.h1>

      {subtitle ? (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl"
        >
          {subtitle}
        </motion.p>
      ) : null}

      {primaryText || secondaryText ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row"
        >
          {primaryText ? (
            <a
              href={primaryHref || "#"}
              data-csm-target="cta-primary"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#9b5cff] to-[#ff5db1] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-105"
            >
              {primaryText}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          ) : null}
          {secondaryText ? (
            <a
              href={secondaryHref || "#"}
              data-csm-target="cta-secondary"
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-card/40 px-7 py-3.5 text-base font-semibold backdrop-blur transition-colors hover:bg-card/80"
            >
              {secondaryText}
            </a>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

// ============================================================
// VARIANT 1 — Aurora gradient pulida
// ============================================================
function AuroraHero(props: MotionHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(155,92,255,0.45),transparent)] blur-3xl" />
        <motion.div
          aria-hidden
          animate={{ x: [0, 80, -40, 0], y: [0, -40, 40, 0] }}
          transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute top-1/4 left-1/4 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,93,177,0.4),transparent)] blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -60, 60, 0], y: [0, 60, -30, 0] }}
          transition={{ duration: 22, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute bottom-0 right-1/4 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(64,200,255,0.35),transparent)] blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgba(0,0,0,0.6))]" />
      </div>
      <HeroContent {...props} />
    </section>
  );
}

// ============================================================
// VARIANT 2 — Magnetic CTA: botones siguen al cursor
// ============================================================
function MagneticHero(props: MotionHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(155,92,255,0.18),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,93,177,0.18),transparent_50%)]"
      />
      <div
        data-csm-target="hero-center"
        className="relative z-10 mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center px-4 text-center"
      >
        {props.badge ? (
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
            {props.badge}
          </span>
        ) : null}
        <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            {props.subtitle}
          </p>
        ) : null}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {props.primaryText ? (
            <Magnetic strength={28}>
              <a
                href={props.primaryHref || "#"}
                data-csm-target="cta-primary"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#9b5cff] to-[#ff5db1] px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-primary/30 transition-transform"
              >
                {props.primaryText}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </Magnetic>
          ) : null}
          {props.secondaryText ? (
            <Magnetic strength={20}>
              <a
                href={props.secondaryHref || "#"}
                data-csm-target="cta-secondary"
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-card/40 px-7 py-3.5 text-base font-semibold backdrop-blur"
              >
                {props.secondaryText}
              </a>
            </Magnetic>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Magnetic({ children, strength = 24 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        x.set(((e.clientX - cx) / r.width) * strength);
        y.set(((e.clientY - cy) / r.height) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}

// ============================================================
// VARIANT 3 — Spotlight: cursor revela con mask gradient
// ============================================================
function SpotlightHero(props: MotionHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({
          x: ((e.clientX - r.left) / r.width) * 100,
          y: ((e.clientY - r.top) / r.height) * 100,
        });
      }}
      className="relative isolate overflow-hidden bg-[#080612]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle 600px at ${pos.x}% ${pos.y}%, rgba(155,92,255,0.18), transparent 60%)`,
          transition: "background 60ms linear",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: `radial-gradient(circle 400px at ${pos.x}% ${pos.y}%, white, transparent 70%)`,
          WebkitMaskImage: `radial-gradient(circle 400px at ${pos.x}% ${pos.y}%, white, transparent 70%)`,
        }}
      />
      <HeroContent {...props} />
    </section>
  );
}

// ============================================================
// VARIANT 4 — Typewriter: el título se escribe letra a letra
// ============================================================
function TypewriterHero(props: MotionHeroProps) {
  const fullText = props.title;
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(t);
    }, 45);
    return () => clearInterval(t);
  }, [fullText]);
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(155,92,255,0.15),transparent_60%)]"
      />
      <HeroContent
        {...props}
        titleSlot={
          <span>
            {shown}
            <span className="ml-1 inline-block h-[0.9em] w-[3px] -translate-y-1 animate-pulse bg-primary align-middle" />
          </span>
        }
      />
    </section>
  );
}

// ============================================================
// VARIANT 5 — Marquee: logos / texts en marquee infinito
// ============================================================
function MarqueeHero(props: MotionHeroProps) {
  const items =
    props.marqueeItems && props.marqueeItems.length > 0
      ? props.marqueeItems
      : ["Notion", "Vercel", "Linear", "Framer", "Stripe", "Resend", "Supabase", "Anthropic"];
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(155,92,255,0.12),transparent_50%)]"
      />
      <HeroContent {...props} />
      <div className="relative z-10 mx-auto -mt-8 max-w-6xl pb-20">
        <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">
          Compatible con tu stack
        </div>
        <Marquee items={items} />
      </div>
    </section>
  );
}

function Marquee({ items }: { items: string[] }) {
  // Duplicamos los items (con prefix de copia) para loop sin saltos.
  const repeated = [
    ...items.map((it, i) => ({ key: `a-${i}-${it}`, label: it })),
    ...items.map((it, i) => ({ key: `b-${i}-${it}`, label: it })),
  ];
  return (
    <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <motion.div
        className="flex gap-12 whitespace-nowrap text-xl font-semibold text-muted-foreground"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
      >
        {repeated.map((it) => (
          <span key={it.key} className="opacity-70 hover:opacity-100 transition-opacity">
            {it.label}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ============================================================
// VARIANT 6 — Particles network: canvas con dots conectados
// ============================================================
function ParticlesHero(props: MotionHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    const dpr = window.devicePixelRatio || 1;
    let w = cv.offsetWidth;
    let h = cv.offsetHeight;
    const setupCanvas = () => {
      w = cv.offsetWidth;
      h = cv.offsetHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setupCanvas();
    type P = { x: number; y: number; vx: number; vy: number };
    const dots: P[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));
    const onResize = () => {
      setupCanvas();
    };
    window.addEventListener("resize", onResize);
    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > cv.offsetWidth) d.vx *= -1;
        if (d.y < 0 || d.y > cv.offsetHeight) d.vy *= -1;
      }
      // Lines
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.strokeStyle = `rgba(155,92,255,${(1 - dist / 130) * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // Dots
      for (const d of dots) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return (
    <section className="relative isolate overflow-hidden bg-[#070612]">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7))]"
      />
      <HeroContent {...props} />
    </section>
  );
}

// ============================================================
// Variant catálogo (para el inspector y el picker visual)
// ============================================================
export const MOTION_HERO_VARIANTS: Array<{
  value: MotionHeroVariant;
  label: string;
  description: string;
  /** Emoji/icon para la galería del inspector. */
  emoji: string;
}> = [
  { value: "aurora", label: "Aurora", description: "Gradiente animado, blur orbs", emoji: "🌌" },
  {
    value: "magnetic",
    label: "Magnetic",
    description: "Botones que siguen al cursor",
    emoji: "🧲",
  },
  {
    value: "spotlight",
    label: "Spotlight",
    description: "Cursor revela contenido con mask",
    emoji: "🔦",
  },
  {
    value: "typewriter",
    label: "Typewriter",
    description: "Título type-on letra a letra",
    emoji: "⌨️",
  },
  { value: "marquee", label: "Marquee", description: "Logos infinitos rodando", emoji: "🎞️" },
  { value: "particles", label: "Particles", description: "Red de partículas canvas", emoji: "✨" },
];

// Exporta un cn helper si alguien lo necesita en sub-blocks futuros.
export const _cn = cn;
