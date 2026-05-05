"use client";

/**
 * Primitives compartidos por todas las plantillas showcase.
 *
 * Showcase = preview espectacular tipo motionsites.ai (video HLS, scroll-driven
 * marquees, sticky stack cards, parallax columns, magnetic cursor, glassmorphism
 * pills, scroll-reveal char-by-char, etc.). Renderizados en `/template-preview/[id]`
 * con su propio wrapper visual (no pasan por el block registry).
 *
 * **Diseño**: cero dependencias nuevas. Todo se hace con framer-motion 11
 * (ya instalado) — `useScroll`, `useTransform`, `useMotionValue`, `motion.*`,
 * `AnimatePresence`. CSS keyframes para marquees infinitos vía `<style jsx>`.
 *
 * Cada primitive es un client component aislado para que las plantillas se
 * compongan sin pelearse con el árbol RSC.
 */

import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================
// FadeIn — wrapper con scroll-into-view
// ============================================================
type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "h1" | "h2" | "h3" | "p" | "span" | "li";
  once?: boolean;
};

export function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  as = "div",
  once = true,
}: FadeInProps) {
  const M = motion[as];
  return (
    <M
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "50px", amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </M>
  );
}

// ============================================================
// Magnet — efecto magnético (cursor atrae al elemento)
// ============================================================
type MagnetProps = {
  children: ReactNode;
  /** Distancia a la que se "activa" el imán */
  padding?: number;
  /** Intensidad — mayor = movimiento más sutil */
  strength?: number;
  className?: string;
};

export function Magnet({ children, padding = 100, strength = 3, className }: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const max = Math.max(rect.width, rect.height) / 2 + padding;

      if (dist < max) {
        el.style.transition = "transform 0.3s ease-out";
        x.set(dx / strength);
        y.set(dy / strength);
      } else {
        el.style.transition = "transform 0.6s ease-in-out";
        x.set(0);
        y.set(0);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
    };
  }, [padding, strength, x, y]);

  return (
    <motion.div ref={ref} style={{ x, y, willChange: "transform" }} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================
// CycleText — palabras que se rotan con AnimatePresence
// ============================================================
type CycleTextProps = {
  words: string[];
  /** Milisegundos entre cambios */
  intervalMs?: number;
  className?: string;
};

export function CycleText({ words, intervalMs = 2000, className }: CycleTextProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span className="relative inline-block align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={className}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ============================================================
// AnimatedTextReveal — char-by-char opacity con scroll progress
// ============================================================
type AnimatedTextRevealProps = {
  text: string;
  className?: string;
};

export function AnimatedTextReveal({ text, className }: AnimatedTextRevealProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });

  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <p ref={ref} className={className} style={{ position: "relative" }}>
      {chars.map((ch, idx) => (
        <Char
          key={`${idx}-${ch}`}
          char={ch}
          progress={scrollYProgress}
          start={idx / chars.length}
          end={(idx + 1) / chars.length}
        />
      ))}
    </p>
  );
}

function Char({
  char,
  progress,
  start,
  end,
}: {
  char: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.18, 1]);
  if (char === " ") return <span> </span>;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ opacity: 0.18 }}>{char}</span>
      <motion.span style={{ position: "absolute", inset: 0, opacity }}>{char}</motion.span>
    </span>
  );
}

// ============================================================
// MarqueeRow — fila infinita scroll-driven horizontal
// ============================================================
type MarqueeRowProps = {
  children: ReactNode;
  /** "left" empuja al desplazar abajo, "right" lo contrario */
  direction?: "left" | "right";
  /** Speed multiplier para scroll-driven */
  speed?: number;
  className?: string;
  /** Usa CSS animation infinita (no scroll-driven) */
  autoplay?: boolean;
  /** Duración (s) del autoplay */
  autoplayDuration?: number;
};

export function MarqueeRow({
  children,
  direction = "left",
  speed = 0.3,
  className,
  autoplay = false,
  autoplayDuration = 40,
}: MarqueeRowProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (autoplay) return;
    const onScroll = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const off = (window.innerHeight - rect.top) * speed;
      setOffset(off);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoplay, speed]);

  const transform = autoplay
    ? undefined
    : `translateX(${direction === "left" ? -offset : offset - 200}px)`;

  return (
    <div ref={wrapperRef} className={className} style={{ overflow: "hidden", width: "100%" }}>
      <div
        ref={innerRef}
        className={autoplay ? `marquee-track marquee-${direction}` : undefined}
        style={{
          display: "flex",
          gap: "0.75rem",
          willChange: "transform",
          transform,
          ...(autoplay
            ? ({
                ["--marquee-duration" as string]: `${autoplayDuration}s`,
              } as CSSProperties)
            : null),
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes marquee-scroll-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-scroll-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .marquee-track {
          animation-duration: var(--marquee-duration, 40s);
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .marquee-left { animation-name: marquee-scroll-left; }
        .marquee-right { animation-name: marquee-scroll-right; }
      `}</style>
    </div>
  );
}

// ============================================================
// StickyStackCard — cards que se apilan al hacer scroll (effect Awwwards)
// ============================================================
type StickyStackCardProps = {
  children: ReactNode;
  index: number;
  total: number;
  /** Top offset relativo (px) */
  topOffset?: number;
  className?: string;
};

export function StickyStackCard({
  children,
  index,
  total,
  topOffset = 28,
  className,
}: StickyStackCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start start"] });
  const targetScale = 1 - (total - 1 - index) * 0.04;
  const scale = useTransform(scrollYProgress, [0, 1], [1, targetScale]);

  return (
    <div ref={ref} style={{ height: "85vh", position: "relative" }} className={className}>
      <motion.div
        style={{
          scale,
          top: `${index * topOffset}px`,
          position: "sticky",
          transformOrigin: "top center",
        }}
        className="csm-sticky-card"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================
// ParallaxColumn — columna que se desplaza Y según scroll
// ============================================================
type ParallaxColumnProps = {
  children: ReactNode;
  /** Multiplicador del desplazamiento Y (negativo = más lento) */
  factor?: number;
  className?: string;
};

export function ParallaxColumn({ children, factor = -0.2, className }: ParallaxColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, factor * 600]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================
// VideoLoop — vídeo de fondo con crossfade entre loops
// ============================================================
type VideoLoopProps = {
  src: string;
  className?: string;
  /** Tiempo (s) que queda al final para iniciar el fade out */
  fadeWindowSec?: number;
  /** Duración (ms) del fade in/out */
  fadeMs?: number;
  poster?: string;
  /** Tiempo de inicio (s) — útil para hero */
  startAt?: number;
  /** "cover" | "contain" */
  fit?: "cover" | "contain";
  style?: CSSProperties;
};

export function VideoLoop({
  src,
  className,
  fadeWindowSec = 0.55,
  fadeMs = 500,
  poster,
  fit = "cover",
  style,
}: VideoLoopProps) {
  const ref = useRef<HTMLVideoElement>(null);

  const fadeTo = useCallback(
    (target: number) => {
      const el = ref.current;
      if (!el) return;
      const start = performance.now();
      const initial = Number.parseFloat(el.style.opacity || "0") || 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / fadeMs);
        el.style.opacity = String(initial + (target - initial) * t);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [fadeMs],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onCanPlay = () => {
      el.play().catch(() => {
        // autoplay bloqueado en algunos browsers — silenciar
      });
      fadeTo(1);
    };
    const onTimeUpdate = () => {
      const remaining = el.duration - el.currentTime;
      if (remaining <= fadeWindowSec) fadeTo(0);
    };
    const onEnded = () => {
      el.style.opacity = "0";
      setTimeout(() => {
        if (!ref.current) return;
        ref.current.currentTime = 0;
        ref.current.play().catch(() => {});
        fadeTo(1);
      }, 100);
    };

    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [fadeTo, fadeWindowSec]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      autoPlay
      playsInline
      preload="auto"
      poster={poster}
      style={{
        opacity: 0,
        objectFit: fit,
        ...style,
      }}
    >
      <source src={src} />
    </video>
  );
}

// ============================================================
// LiquidGlass — wrapper con efecto cristal con gradient ring
// ============================================================
type LiquidGlassProps = {
  children: ReactNode;
  className?: string;
  /** Borde gradient activo */
  ring?: boolean;
  rounded?: "full" | "2xl" | "3xl" | "lg" | "md";
  style?: CSSProperties;
};

export function LiquidGlass({
  children,
  className,
  ring = true,
  rounded = "2xl",
  style,
}: LiquidGlassProps) {
  const radius = {
    full: "9999px",
    "3xl": "1.5rem",
    "2xl": "1rem",
    lg: "0.75rem",
    md: "0.5rem",
  }[rounded];

  return (
    <div
      className={className}
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.01)",
        backgroundBlendMode: "luminosity",
        backdropFilter: "blur(12px) saturate(160%)",
        WebkitBackdropFilter: "blur(12px) saturate(160%)",
        border: "none",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.10)",
        overflow: "hidden",
        borderRadius: radius,
        ...style,
      }}
    >
      {ring ? (
        <span
          aria-hidden
          style={{
            content: "''",
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            padding: "1.4px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

// ============================================================
// Spotlight — efecto cursor que ilumina (radial)
// ============================================================
type SpotlightProps = {
  children: ReactNode;
  className?: string;
  /** Color del spotlight (rgba) */
  color?: string;
};

export function Spotlight({
  children,
  className,
  color = "rgba(255,255,255,0.07)",
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, visible: false }))}
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: pos.visible ? 1 : 0,
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 60%)`,
          transition: "opacity 0.3s ease-out",
        }}
      />
      {children}
    </div>
  );
}

// ============================================================
// LoadingScreen — pantalla de carga con counter + word cycler
// ============================================================
type LoadingScreenProps = {
  words?: string[];
  durationMs?: number;
  onDone?: () => void;
};

export function LoadingScreen({
  words = ["Diseña", "Crea", "Inspira"],
  durationMs = 2400,
  onDone,
}: LoadingScreenProps) {
  const [count, setCount] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setCount(Math.floor(t * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setDone(true), 300);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  useEffect(() => {
    const id = setInterval(() => setWordIdx((v) => (v + 1) % words.length), 800);
    return () => clearInterval(id);
  }, [words.length]);

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  if (done) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "2rem",
        color: "#fafafa",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: "11px",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          opacity: 0.6,
        }}
      >
        Cargando vista previa
      </motion.div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-serif, Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(2.5rem, 6vw, 5rem)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIdx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
          >
            {words[wordIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontFamily: "ui-serif, serif", fontSize: "clamp(3rem, 6vw, 6rem)" }}>
          {String(count).padStart(3, "0")}
        </div>
        <div
          style={{
            flex: 1,
            margin: "0 1.5rem",
            height: "2px",
            background: "rgba(255,255,255,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "left",
              transform: `scaleX(${count / 100})`,
              background: "linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)",
              boxShadow: "0 0 8px rgba(137,170,204,0.5)",
              transition: "transform 0.1s linear",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", letterSpacing: "0.3em", opacity: 0.6 }}>{count}%</div>
      </div>
    </motion.div>
  );
}

// ============================================================
// useInViewOnce — helper para componer animaciones únicas en scroll
// ============================================================
export function useInViewOnce<T extends HTMLElement>(margin = "-100px") {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: margin as never });
  return [ref, inView] as const;
}
