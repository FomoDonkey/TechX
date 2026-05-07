"use client";

/**
 * Plantilla `f1-grand-prix` — Campeonato F1 inmersivo.
 *
 * 6 secciones:
 *  1. F1Hero — black + red, headline gigante + countdown live + scanlines + velocity lines
 *  2. F1Drivers — grid 3D tilt cards con número dorsal de fondo + colores equipo
 *  3. F1Constructors — doble marquee scroll-driven con equipos
 *  4. F1Calendar — sticky stack cards de calendario carreras
 *  5. F1Stats — counters animados (equipos / pilotos / GPs / km totales)
 *  6. F1CTA — fade dramático + headline + suscripción
 *
 * Datos reales del dataset toUpperCase78/formula1-datasets (2025 season).
 * Sin assets pesados — todo CSS/SVG/emojis. Cero deps nuevas.
 */

import {
  type F1Champion,
  type F1DotdEntry,
  type F1Driver2026,
  type F1LastRace,
  type F1StandingsDriver,
  type F1StandingsTeam,
  F1_CALENDAR_2025,
  F1_CHAMPIONS_HISTORY,
  F1_DOTD_2025,
  F1_DRIVERS_2025,
  F1_DRIVERS_2026,
  F1_DRIVER_STANDINGS_2025,
  F1_DRIVER_STANDINGS_2026,
  F1_LAST_RACE_2025,
  F1_LAST_RACE_2026,
  F1_TEAMS_2025,
  F1_TEAM_STANDINGS_2025,
  F1_TEAM_STANDINGS_2026,
} from "@/blocks/spectacular/f1-data";
import { FadeIn, MarqueeRow } from "@/templates/showcase/_lib/primitives";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// Datos compartidos por defecto (2025 season real)
// ============================================================
type Driver = {
  name: string;
  abbrev: string;
  number: number;
  team: string;
  country: string;
  countryFlag: string;
  points: number;
  podiums: number;
  championships: number;
  /** Color principal del equipo (HEX). */
  color: string;
};

type Team = {
  name: string;
  fullName: string;
  base: string;
  championships: number;
  points: number;
  /** Color principal del equipo (HEX). */
  color: string;
};

type Race = {
  round: number;
  date: string;
  gpName: string;
  country: string;
  countryFlag: string;
  city: string;
  circuit: string;
  laps: number;
  lengthKm: number;
  lapRecord: string;
  recordHolder: string;
};

// Top 10 pilotos del dataset oficial 2025 (carreras totales puntos).
// Para mostrar los 21 inscritos: edita el bloque y pega F1_DRIVERS_2025 completo.
const DEFAULT_DRIVERS: Driver[] = F1_DRIVERS_2025.slice(0, 10);

// Los 10 equipos oficiales 2025 (dataset).
const DEFAULT_TEAMS: Team[] = F1_TEAMS_2025;

// 6 GPs destacados del calendario 2025 (calendario completo en F1_CALENDAR_2025).
const DEFAULT_RACES: Race[] = F1_CALENDAR_2025.filter((r) =>
  ["Monaco", "Spain", "Italy", "Great Britain", "Belgium", "United Arab Emirates"].includes(
    r.country,
  ),
)
  .slice(0, 6)
  .map((r) => ({
    round: r.round,
    date: r.date,
    gpName: r.gpName,
    country: r.country,
    countryFlag: r.countryFlag,
    city: r.city,
    circuit: r.circuit,
    laps: r.laps,
    lengthKm: r.lengthKm,
    lapRecord: r.lapRecord,
    recordHolder: r.recordHolder,
  }));

// ============================================================
// 1. F1 HERO — black + red neon + scanlines + countdown live + velocity lines
// ============================================================
export type F1HeroProps = {
  pretitle?: string;
  title?: string;
  subtitle?: string;
  /** Fecha ISO del próximo GP. Default: 1 mes desde hoy. */
  nextRaceISO?: string;
  nextRaceLabel?: string;
  /** Países que rotan en el marquee superior. Acepta strings o {label}. */
  countries?: Array<string | { label?: string }>;
};

function useCountdown(targetISO: string) {
  const target = useMemo(() => new Date(targetISO).getTime(), [targetISO]);
  // SSR: now=null → mostramos "--" / 0. Cliente tras mount: tick cada segundo.
  // Esto evita el hydration mismatch (server time != client time).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) {
    return { days: 0, hours: 0, mins: 0, secs: 0, ready: false };
  }
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return { days, hours, mins, secs, ready: true };
}

export function F1Hero({
  pretitle = "TEMPORADA 2025 · OFICIAL",
  title = "FORMULA 1",
  subtitle = "10 equipos. 20 pilotos. 24 Grandes Premios. Una sola pasión a 350 km/h.",
  nextRaceISO,
  nextRaceLabel = "PRÓXIMO GP · MONACO",
  countries = [
    "🇦🇺 AUSTRALIA",
    "🇨🇳 CHINA",
    "🇯🇵 JAPÓN",
    "🇧🇭 BAHRÉIN",
    "🇸🇦 ARABIA",
    "🇺🇸 MIAMI",
    "🇮🇹 IMOLA",
    "🇲🇨 MÓNACO",
    "🇪🇸 ESPAÑA",
    "🇨🇦 CANADÁ",
    "🇬🇧 SILVERSTONE",
  ],
}: F1HeroProps) {
  const target =
    nextRaceISO && nextRaceISO.length > 0
      ? nextRaceISO
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const cd = useCountdown(target);
  // Normaliza countries (string[] | {label}[]) a string[] para render.
  const countryLabels = countries
    .map((c) => (typeof c === "string" ? c : (c?.label ?? "")))
    .filter((c) => c.length > 0);
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black text-white">
      {/* Scanlines + grain */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(220,0,0,0.08) 0px, rgba(220,0,0,0.08) 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "screen",
        }}
        aria-hidden
      />
      {/* Glow rojo radial pulsando */}
      <motion.div
        className="pointer-events-none absolute -left-1/4 top-1/3 h-[60vh] w-[60vh] rounded-full"
        style={{
          background: "radial-gradient(closest-side, rgba(220,0,0,0.55), rgba(220,0,0,0) 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -right-1/4 bottom-1/4 h-[55vh] w-[55vh] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Velocity lines: barras horizontales que cruzan */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {[12, 32, 58, 78].map((top, i) => (
          <motion.div
            key={top}
            className="absolute h-px w-32 bg-gradient-to-r from-transparent via-red-500 to-transparent"
            style={{ top: `${top}%` }}
            initial={{ x: "-50vw", opacity: 0 }}
            animate={{ x: "150vw", opacity: [0, 1, 0] }}
            transition={{
              duration: 2.5 + i * 0.3,
              delay: i * 0.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            aria-hidden
          />
        ))}
      </div>

      {/* Marquee superior de países (autoplay para garantizar movimiento) */}
      <div className="relative z-20 border-b border-red-900/40 bg-black/70 py-2 backdrop-blur">
        <MarqueeRow
          autoplay
          autoplayDuration={40}
          className="text-xs font-bold tracking-[0.25em] text-red-500"
        >
          {countryLabels.flatMap((c, i) => [
            <span key={`c-${i}-${c}`} className="px-6">
              {c}
            </span>,
            <span key={`s-${i}-${c}`} className="px-2 text-red-900">
              ●
            </span>,
          ])}
          {/* Duplicado para loop infinito */}
          {countryLabels.flatMap((c, i) => [
            <span key={`c2-${i}-${c}`} className="px-6">
              {c}
            </span>,
            <span key={`s2-${i}-${c}`} className="px-2 text-red-900">
              ●
            </span>,
          ])}
        </MarqueeRow>
      </div>

      <div className="relative z-20 mx-auto flex min-h-[calc(100vh-44px)] max-w-7xl flex-col items-center justify-center px-4 py-20 text-center">
        <FadeIn delay={0.1} y={20}>
          <span className="inline-block rounded-full border border-red-500/40 bg-red-950/40 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-red-400 backdrop-blur">
            {pretitle}
          </span>
        </FadeIn>

        <FadeIn delay={0.25} y={40} duration={1}>
          <h1
            className="mt-8 font-black uppercase leading-[0.85] tracking-tight"
            style={{
              fontSize: "clamp(4rem, 18vw, 17rem)",
              fontFamily: "'Kanit', 'Rubik', system-ui, sans-serif",
              background: "linear-gradient(180deg, #fff 0%, #fff 55%, #DC0000 55%, #8B0000 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(220,0,0,0.4))",
            }}
          >
            {title}
          </h1>
        </FadeIn>

        {/* Línea LED neón roja debajo del headline */}
        <motion.div
          className="my-6 h-1 w-full max-w-3xl rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #DC0000 30%, #FF1F1F 50%, #DC0000 70%, transparent 100%)",
            boxShadow: "0 0 24px #FF1F1F",
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.9, ease: "easeOut" }}
          aria-hidden
        />

        <FadeIn delay={0.6} y={20}>
          <p className="mx-auto max-w-2xl text-lg text-zinc-300 md:text-xl">{subtitle}</p>
        </FadeIn>

        {/* Countdown */}
        <FadeIn delay={0.8} y={20} className="mt-12">
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-400">
            {nextRaceLabel}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 sm:gap-6">
            {[
              { v: cd.days, l: "DÍAS" },
              { v: cd.hours, l: "HRS" },
              { v: cd.mins, l: "MIN" },
              { v: cd.secs, l: "SEG" },
            ].map((u) => (
              <div
                key={u.l}
                className="min-w-[68px] rounded-lg border border-red-500/30 bg-black/70 px-3 py-3 backdrop-blur sm:min-w-[88px] sm:px-5 sm:py-4"
              >
                <div
                  className="font-mono text-3xl font-bold tabular-nums text-white sm:text-5xl"
                  style={{ textShadow: "0 0 20px rgba(220,0,0,0.6)" }}
                  // Hydration-safe: el countdown solo arranca tras mount.
                  suppressHydrationWarning
                >
                  {cd.ready ? String(u.v).padStart(2, "0") : "--"}
                </div>
                <div className="mt-1 text-[9px] font-bold tracking-widest text-red-400">{u.l}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ============================================================
// 2. F1 DRIVERS GRID — 3D tilt cards con número dorsal de fondo
// ============================================================
export type F1DriversProps = {
  eyebrow?: string;
  title?: string;
  drivers?: Driver[];
};

function DriverCard({ d }: { d: Driver }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sX = useSpring(rx, { stiffness: 120, damping: 12 });
  const sY = useSpring(ry, { stiffness: 120, damping: 12 });
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left - r.width / 2;
    const cy = e.clientY - r.top - r.height / 2;
    rx.set(-cy / 12);
    ry.set(cx / 12);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: sX, rotateY: sY, transformStyle: "preserve-3d", perspective: 800 }}
      className="group relative aspect-[3/4] cursor-default overflow-hidden rounded-2xl border border-white/10"
      whileInView={{ opacity: [0, 1], y: [40, 0] }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Background gradient del color del equipo */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(165deg, ${d.color} 0%, ${d.color}99 35%, #000 100%)`,
        }}
      />
      {/* Diagonal stripes glass */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0 8px, transparent 8px 18px)",
        }}
      />
      {/* Número dorsal gigante de fondo */}
      <div
        className="pointer-events-none absolute -bottom-6 -right-3 select-none font-black leading-none text-white/15"
        style={{
          fontFamily: "'Kanit', system-ui, sans-serif",
          fontSize: "clamp(8rem, 18vw, 14rem)",
          textShadow: "0 0 30px rgba(0,0,0,0.4)",
        }}
      >
        {d.number}
      </div>
      {/* Contenido */}
      <div className="relative z-10 flex h-full flex-col p-5">
        <div className="flex items-start justify-between">
          <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white backdrop-blur">
            #{d.number}
          </span>
          <span className="text-2xl">{d.countryFlag}</span>
        </div>
        <div className="mt-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
            {d.team}
          </div>
          <div
            className="mt-1 font-black uppercase leading-[0.95] text-white"
            style={{
              fontSize: "clamp(1.4rem, 2.4vw, 2.1rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {d.abbrev}
          </div>
          <div className="mt-1 text-base font-medium text-white">{d.name}</div>
          <div className="mt-3 flex items-center gap-3 border-t border-white/20 pt-3 text-[10px] font-bold tracking-wider text-white">
            <div>
              <div className="text-base font-black tabular-nums">{d.points}</div>
              <div className="text-white/70">PUNTOS</div>
            </div>
            <div>
              <div className="text-base font-black tabular-nums">{d.podiums}</div>
              <div className="text-white/70">PODIOS</div>
            </div>
            <div>
              <div className="text-base font-black tabular-nums">{d.championships}</div>
              <div className="text-white/70">TÍTULOS</div>
            </div>
          </div>
        </div>
      </div>
      {/* Hover spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.18), transparent 60%)",
        }}
      />
    </motion.div>
  );
}

export function F1Drivers({
  eyebrow = "PARRILLA · TEMPORADA 2025",
  title = "Pilotos titulares",
  drivers = DEFAULT_DRIVERS,
}: F1DriversProps) {
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </FadeIn>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {drivers.map((d) => (
            <DriverCard key={d.abbrev} d={d} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 3. F1 CONSTRUCTORS — doble marquee scroll-driven
// ============================================================
export type F1ConstructorsProps = {
  eyebrow?: string;
  title?: string;
  teams?: Team[];
};

export function F1Constructors({
  eyebrow = "ESCUDERÍAS · 2025",
  title = "Los 10 equipos",
  teams = DEFAULT_TEAMS,
}: F1ConstructorsProps) {
  const top = teams;
  const bottom = [...teams].reverse();
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black py-24 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </FadeIn>
      </div>

      <div className="mt-12 space-y-4">
        <MarqueeRow autoplay autoplayDuration={32}>
          {[...top, ...top].map((t, i) => (
            <div
              key={`top-${i}-${t.name}`}
              className="mx-3 flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/70 px-6 py-4 backdrop-blur"
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: t.color, boxShadow: `0 0 12px ${t.color}` }}
              />
              <div>
                <div
                  className="font-black uppercase tracking-tight"
                  style={{ fontFamily: "'Kanit', system-ui, sans-serif", fontSize: "1.5rem" }}
                >
                  {t.name}
                </div>
                <div className="text-[10px] font-bold tracking-widest text-zinc-400">{t.base}</div>
              </div>
            </div>
          ))}
        </MarqueeRow>
        <MarqueeRow autoplay autoplayDuration={36} direction="right">
          {[...bottom, ...bottom].map((t, i) => (
            <div
              key={`btm-${i}-${t.name}`}
              className="mx-3 flex items-center gap-4 rounded-xl px-6 py-4"
              style={{ background: `${t.color}22`, border: `1px solid ${t.color}55` }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                {t.championships} TÍTULOS
              </div>
              <div className="h-6 w-px" style={{ background: t.color }} />
              <div
                className="font-mono text-2xl font-black tabular-nums"
                style={{ color: t.color }}
              >
                {t.points.toLocaleString("es-ES")}
              </div>
              <div className="text-[10px] font-bold tracking-widest text-zinc-400">PTS</div>
            </div>
          ))}
        </MarqueeRow>
      </div>
    </section>
  );
}

// ============================================================
// 4. F1 CALENDAR — sticky stack cards de carreras destacadas
// ============================================================
export type F1CalendarProps = {
  eyebrow?: string;
  title?: string;
  races?: Race[];
};

export function F1Calendar({
  eyebrow = "CALENDARIO · 2025",
  title = "Grandes Premios destacados",
  races = DEFAULT_RACES,
}: F1CalendarProps) {
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </FadeIn>
        <div className="mt-16 space-y-6">
          {races.map((r, i) => (
            <motion.div
              key={r.round}
              className="sticky overflow-hidden rounded-3xl border border-white/10 bg-black/80 backdrop-blur"
              style={{ top: `${10 + i * 4}vh` }}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {/* Diagonal accent */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, transparent 0%, transparent 50%, rgba(220,0,0,0.4) 50%, rgba(220,0,0,0.6) 100%)",
                }}
                aria-hidden
              />
              <div className="relative grid grid-cols-1 gap-6 p-8 md:grid-cols-12 md:gap-8 md:p-12">
                <div className="md:col-span-2">
                  <div className="text-[10px] font-bold tracking-[0.3em] text-red-400">RONDA</div>
                  <div
                    className="font-black tabular-nums leading-none"
                    style={{
                      fontFamily: "'Kanit', system-ui, sans-serif",
                      fontSize: "clamp(3rem, 6vw, 5rem)",
                    }}
                  >
                    {String(r.round).padStart(2, "0")}
                  </div>
                  <div className="mt-2 text-sm font-bold tracking-wider text-zinc-300">
                    {r.date}
                  </div>
                </div>
                <div className="md:col-span-7">
                  <div className="flex items-center gap-3 text-3xl">
                    {r.countryFlag}
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-400">
                      {r.country}
                    </span>
                  </div>
                  <h3
                    className="mt-2 font-black uppercase leading-tight"
                    style={{
                      fontFamily: "'Kanit', system-ui, sans-serif",
                      fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)",
                    }}
                  >
                    {r.gpName}
                  </h3>
                  <p className="mt-2 text-base text-zinc-300">
                    {r.circuit} · {r.city}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold tracking-wider">
                    <div className="rounded-lg border border-white/10 p-3">
                      <div className="font-mono text-xl tabular-nums">{r.laps}</div>
                      <div className="mt-1 text-zinc-400">VUELTAS</div>
                    </div>
                    <div className="rounded-lg border border-white/10 p-3">
                      <div className="font-mono text-xl tabular-nums">{r.lengthKm}</div>
                      <div className="mt-1 text-zinc-400">KM/VUELTA</div>
                    </div>
                    <div className="col-span-2 rounded-lg border border-red-500/40 bg-red-950/30 p-3">
                      <div className="text-[10px] tracking-widest text-red-300">RÉCORD</div>
                      <div className="font-mono text-xl tabular-nums text-white">{r.lapRecord}</div>
                      <div className="mt-1 text-zinc-300">{r.recordHolder}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 5. F1 STATS — 4 counters animados al entrar en viewport
// ============================================================
export type F1StatsProps = {
  eyebrow?: string;
  stats?: Array<{ value: number; suffix?: string; label: string }>;
};

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 1800;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - (1 - p) ** 3;
      setV(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref} className="font-mono tabular-nums">
      {v.toLocaleString("es-ES")}
      {suffix}
    </span>
  );
}

export function F1Stats({
  eyebrow = "TEMPORADA 2025 EN CIFRAS",
  stats = [
    { value: 10, label: "EQUIPOS" },
    { value: 20, label: "PILOTOS" },
    { value: 24, label: "GRANDES PREMIOS" },
    { value: 6125, suffix: " KM", label: "DISTANCIA TOTAL" },
  ],
}: F1StatsProps) {
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black py-24 text-white">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 50%, rgba(220,0,0,0.4), transparent 50%), radial-gradient(circle at 70% 50%, rgba(220,0,0,0.25), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4">
        <FadeIn>
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
        </FadeIn>
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-10">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.1} y={20}>
              <div className="text-center">
                <div
                  className="font-black leading-none"
                  style={{
                    fontFamily: "'Kanit', system-ui, sans-serif",
                    fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
                    background:
                      "linear-gradient(180deg, #fff 0%, #fff 50%, #DC0000 50%, #8B0000 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-2 text-[10px] font-bold tracking-[0.3em] text-zinc-400">
                  {s.label}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 6. F1 STANDINGS — Tabla clasificación pilotos con barras animadas
// ============================================================
export type F1StandingsProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  drivers?: Driver[];
};

// Clasificación 2025 derivada de los resultados reales por carrera (dataset).
const DEFAULT_STANDINGS_DRIVERS: Driver[] = F1_DRIVER_STANDINGS_2025.slice(0, 10).map((d) => {
  // Buscamos info extendida del piloto en el roster (bandera, abbrev, etc.).
  const full = F1_DRIVERS_2025.find((p) => p.name === d.name);
  return {
    name: d.name,
    abbrev:
      full?.abbrev ??
      d.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 3)
        .toUpperCase(),
    number: d.number,
    team: d.team,
    country: full?.country ?? "",
    countryFlag: full?.countryFlag ?? "🏁",
    points: d.points,
    podiums: d.podiums,
    championships: full?.championships ?? 0,
    color: d.color,
  };
});

function StandingsRow({
  d,
  pos,
  maxPoints,
  delay,
}: {
  d: Driver;
  pos: number;
  maxPoints: number;
  delay: number;
}) {
  const pct = Math.max(4, (d.points / maxPoints) * 100);
  return (
    <motion.div
      className="grid grid-cols-12 items-center gap-3 border-b border-white/5 px-3 py-3 text-sm md:gap-4 md:px-4"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      <div className="col-span-1 text-center font-mono text-lg font-black tabular-nums text-white md:text-2xl">
        {pos === 1 ? <span className="text-yellow-400">🏆</span> : null} {pos}
      </div>
      <div className="col-span-1 text-xl">{d.countryFlag}</div>
      <div className="col-span-3 md:col-span-3">
        <div className="font-bold uppercase tracking-tight text-white">{d.name}</div>
        <div className="text-[10px] font-bold tracking-widest text-zinc-400">{d.team}</div>
      </div>
      <div className="col-span-5 md:col-span-5">
        <div className="relative h-7 overflow-hidden rounded-full bg-zinc-900">
          <motion.div
            className="absolute inset-y-0 left-0 flex items-center justify-end pr-3 text-[11px] font-black text-white"
            style={{
              background: `linear-gradient(90deg, ${d.color}aa 0%, ${d.color} 100%)`,
              boxShadow: `inset 0 0 12px ${d.color}99`,
            }}
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: delay + 0.2, ease: "easeOut" }}
          >
            <span className="relative z-10" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
              #{d.number}
            </span>
          </motion.div>
        </div>
      </div>
      <div className="col-span-2 text-right font-mono text-xl font-black tabular-nums text-white md:text-2xl">
        {d.points}
      </div>
    </motion.div>
  );
}

export function F1Standings({
  eyebrow = "CLASIFICACIÓN PILOTOS · 2025",
  title = "Drivers' Championship",
  subtitle = "Puntuación acumulada en la temporada actual.",
  drivers = DEFAULT_STANDINGS_DRIVERS,
}: F1StandingsProps) {
  const sorted = [...drivers].sort((a, b) => b.points - a.points);
  const maxPoints = sorted[0]?.points ?? 1;
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
          <p className="mt-4 text-zinc-400">{subtitle}</p>
        </FadeIn>
        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
          <div className="grid grid-cols-12 items-center gap-3 border-b border-red-500/40 bg-red-950/30 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-red-300 md:gap-4 md:px-4">
            <div className="col-span-1 text-center">POS</div>
            <div className="col-span-1">PAÍS</div>
            <div className="col-span-3 md:col-span-3">PILOTO</div>
            <div className="col-span-5 md:col-span-5">PROGRESO</div>
            <div className="col-span-2 text-right">PUNTOS</div>
          </div>
          {sorted.map((d, i) => (
            <StandingsRow key={d.abbrev} d={d} pos={i + 1} maxPoints={maxPoints} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 7. F1 CONSTRUCTORS TABLE — Tabla clasificación equipos con visualización
// ============================================================
export type F1ConstructorsTableProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  teams?: Array<Pick<Team, "name" | "color"> & { points: number; wins?: number }>;
};

// Clasificación constructores 2025 derivada de race results (dataset).
const DEFAULT_CONSTRUCTORS_STANDINGS = F1_TEAM_STANDINGS_2025;

export function F1ConstructorsTable({
  eyebrow = "CLASIFICACIÓN CONSTRUCTORES · 2025",
  title = "Constructors' Championship",
  subtitle = "Puntuación combinada de los dos pilotos de cada equipo.",
  teams = DEFAULT_CONSTRUCTORS_STANDINGS,
}: F1ConstructorsTableProps) {
  const sorted = [...teams].sort((a, b) => b.points - a.points);
  const max = sorted[0]?.points ?? 1;
  return (
    <section className="csm-show-f1 relative bg-black py-24 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
          <p className="mt-4 text-zinc-400">{subtitle}</p>
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2">
          {sorted.map((t, i) => {
            const pct = (t.points / max) * 100;
            return (
              <motion.div
                key={t.name}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                {/* Barra absoluta de fondo */}
                <motion.div
                  className="absolute inset-y-0 left-0 opacity-30"
                  style={{
                    background: `linear-gradient(90deg, ${t.color} 0%, transparent 100%)`,
                  }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, delay: i * 0.05 + 0.2, ease: "easeOut" }}
                />
                <div className="relative flex items-center gap-4">
                  <div
                    className="font-mono text-3xl font-black tabular-nums"
                    style={{ color: t.color }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    className="h-12 w-1.5 rounded"
                    style={{ background: t.color, boxShadow: `0 0 16px ${t.color}` }}
                  />
                  <div className="flex-1">
                    <div
                      className="font-black uppercase leading-none"
                      style={{
                        fontFamily: "'Kanit', system-ui, sans-serif",
                        fontSize: "1.4rem",
                      }}
                    >
                      {t.name}
                    </div>
                    <div className="mt-1 text-[11px] font-bold tracking-wider text-zinc-400">
                      {t.wins ?? 0} VICTORIAS
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-3xl font-black tabular-nums text-white">
                      {t.points}
                    </div>
                    <div className="text-[10px] font-bold tracking-widest text-zinc-400">PTS</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 8. F1 TRACKS — Galería de circuitos con stats
// ============================================================
export type F1TracksProps = {
  eyebrow?: string;
  title?: string;
  tracks?: Array<{
    name: string;
    country: string;
    countryFlag: string;
    city: string;
    lengthKm: number;
    turns: number;
    drsZones: number;
    firstGP: number;
  }>;
};

// 8 circuitos legendarios del calendario 2025 (todos en F1_CALENDAR_2025).
const DEFAULT_TRACKS = F1_CALENDAR_2025.filter((r) =>
  [
    "Monaco",
    "Belgium",
    "Great Britain",
    "Italy",
    "Japan",
    "Brazil",
    "Spain",
    "United Arab Emirates",
  ].includes(r.country),
)
  .slice(0, 8)
  .map((r) => ({
    name: r.circuit
      .replace(/^Circuit (de |of )?/i, "")
      .replace(/Autodromo (Nazionale|Internazionale Enzo e Dino Ferrari) /i, ""),
    country: r.country,
    countryFlag: r.countryFlag,
    city: r.city,
    lengthKm: r.lengthKm,
    turns: r.turns,
    drsZones: r.drsZones,
    firstGP: r.firstGP,
  }));

export function F1Tracks({
  eyebrow = "CIRCUITOS LEGENDARIOS",
  title = "Trazados que han hecho historia",
  tracks = DEFAULT_TRACKS,
}: F1TracksProps) {
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((tr, i) => (
            <motion.div
              key={tr.name}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black p-6"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              {/* Decorative racing stripe */}
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, #DC0000 50%, transparent 100%)",
                }}
                aria-hidden
              />
              <div className="text-3xl">{tr.countryFlag}</div>
              <div className="mt-3 text-[10px] font-bold tracking-[0.25em] text-red-400">
                DESDE {tr.firstGP}
              </div>
              <h3
                className="mt-2 font-black uppercase leading-tight"
                style={{
                  fontFamily: "'Kanit', system-ui, sans-serif",
                  fontSize: "1.5rem",
                }}
              >
                {tr.name}
              </h3>
              <div className="mt-1 text-sm text-zinc-400">
                {tr.city} · {tr.country}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                <div>
                  <div className="font-mono text-lg font-black tabular-nums text-white">
                    {tr.lengthKm}
                  </div>
                  <div className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500">KM</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-black tabular-nums text-white">
                    {tr.turns}
                  </div>
                  <div className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500">
                    CURVAS
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg font-black tabular-nums text-white">
                    {tr.drsZones}
                  </div>
                  <div className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500">DRS</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 9. F1 LAST RACE PODIUM — Podio espectacular última carrera
// ============================================================
export type F1LastRaceProps = {
  eyebrow?: string;
  title?: string;
  data?: F1LastRace | null;
};

export function F1LastRacePodium({
  eyebrow = "ÚLTIMA CARRERA · 2025",
  title,
  data = F1_LAST_RACE_2025,
}: F1LastRaceProps) {
  if (!data) {
    return null;
  }
  // Orden visual del podio: 2 - 1 - 3
  const order = [data.podium[1], data.podium[0], data.podium[2]].filter(Boolean);
  const heights = ["h-32 sm:h-44", "h-44 sm:h-64", "h-24 sm:h-36"];
  const positions = ["P2", "P1", "P3"];
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black py-24 text-white">
      {/* Spotlight central */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 30%, rgba(220,0,0,0.35), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4">
        <FadeIn>
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 text-center font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2rem, 6vw, 4.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title ?? `GP DE ${data.track.toUpperCase()}`}
          </h2>
        </FadeIn>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 items-end gap-3 sm:gap-6">
          {order.map((p, i) => (
            <motion.div
              key={p?.driver ?? i}
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
            >
              <div className="mb-3 text-center">
                <div className="text-[10px] font-bold tracking-widest text-zinc-400">
                  {positions[i]}
                </div>
                <div
                  className="mt-1 font-black uppercase leading-tight"
                  style={{
                    fontFamily: "'Kanit', system-ui, sans-serif",
                    fontSize: "clamp(0.95rem, 1.6vw, 1.4rem)",
                    color: p?.color ?? "#fff",
                  }}
                >
                  {p?.driver}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {p?.team}
                </div>
                <div className="mt-1 font-mono text-xs tabular-nums text-zinc-300">{p?.time}</div>
              </div>
              <motion.div
                className={`relative w-full overflow-hidden rounded-t-xl ${heights[i]}`}
                style={{
                  background: `linear-gradient(180deg, ${p?.color ?? "#fff"} 0%, ${p?.color ?? "#fff"}55 60%, #000 100%)`,
                  boxShadow: `0 0 30px ${p?.color ?? "#fff"}66`,
                }}
                initial={{ scaleY: 0, transformOrigin: "bottom" }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.4 + i * 0.15, ease: "easeOut" }}
              >
                <div
                  className="absolute inset-x-0 top-3 text-center font-black tabular-nums leading-none"
                  style={{
                    fontFamily: "'Kanit', system-ui, sans-serif",
                    fontSize: "clamp(2rem, 5vw, 4rem)",
                    color: "#fff",
                    textShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  {i === 1 ? "🏆" : `#${p?.number}`}
                </div>
                <div
                  className="absolute inset-x-0 bottom-3 text-center font-mono text-2xl font-black tabular-nums text-white"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
                >
                  {p?.points} pts
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 10. F1 DRIVER OF THE DAY — Top votos
// ============================================================
export type F1DotdProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  entries?: F1DotdEntry[];
};

export function F1DriverOfTheDay({
  eyebrow = "DRIVER OF THE DAY · 2025",
  title = "Los más votados por los aficionados",
  subtitle = "Agregado oficial de votaciones de los fans tras cada carrera.",
  entries = F1_DOTD_2025,
}: F1DotdProps) {
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2rem, 6vw, 4.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
          <p className="mt-4 text-zinc-400">{subtitle}</p>
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {entries.slice(0, 10).map((e, i) => (
            <motion.div
              key={e.name}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur"
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="font-mono text-3xl font-black tabular-nums text-red-500"
                  style={{ textShadow: "0 0 16px rgba(220,0,0,0.5)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-black tabular-nums text-white">
                    {e.wins}
                  </div>
                  <div className="text-[9px] font-bold tracking-widest text-zinc-500">DOTD</div>
                </div>
              </div>
              <div
                className="mt-4 font-black uppercase leading-tight"
                style={{
                  fontFamily: "'Kanit', system-ui, sans-serif",
                  fontSize: "1.2rem",
                }}
              >
                {e.name}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-bold tracking-widest text-zinc-400">
                <span>{e.races} top-5</span>
                <span className="text-red-400">
                  {Math.round(e.votes / Math.max(1, e.races))}% medio
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 11. F1 SEASON 2026 — Avance del nuevo reglamento
// ============================================================
export type F1Season2026Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  drivers?: F1Driver2026[];
  standings?: F1StandingsDriver[];
  teamStandings?: F1StandingsTeam[];
  lastRace?: F1LastRace | null;
};

export function F1Season2026({
  eyebrow = "TEMPORADA 2026 · NUEVA ERA",
  title = "Reglamento 2026",
  subtitle = "Motores 100% sostenibles, monoplazas más ligeros, aerodinámica activa. Estos son los pilotos confirmados y los primeros resultados.",
  drivers = F1_DRIVERS_2026,
  standings = F1_DRIVER_STANDINGS_2026,
  teamStandings = F1_TEAM_STANDINGS_2026,
  lastRace = F1_LAST_RACE_2026,
}: F1Season2026Props) {
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black py-28 text-white">
      {/* Background con gradient violeta neon (diferenciar de 2025) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(120,30,255,0.4), transparent 50%), radial-gradient(circle at 80% 80%, rgba(220,0,0,0.35), transparent 60%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(120,30,255,0.08) 0px, rgba(120,30,255,0.08) 1px, transparent 1px, transparent 6px)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4">
        <FadeIn>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.35em]"
            style={{ color: "#c08bff" }}
          >
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.8rem, 8vw, 6.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
              background: "linear-gradient(180deg, #fff 0%, #c08bff 50%, #6622ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(120,30,255,0.5))",
            }}
          >
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-zinc-300">{subtitle}</p>
        </FadeIn>

        {/* Top 5 standings 2026 */}
        {standings.length > 0 ? (
          <div className="mt-14">
            <FadeIn>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-400">
                CLASIFICACIÓN PILOTOS · 2026 EN CURSO
              </h3>
            </FadeIn>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
              {standings.slice(0, 5).map((d, i) => (
                <motion.div
                  key={d.name}
                  className="rounded-xl border border-white/15 bg-zinc-900/50 p-4 backdrop-blur"
                  style={{ borderColor: `${d.color}55` }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono text-3xl font-black tabular-nums"
                      style={{ color: d.color }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="font-mono text-2xl font-black tabular-nums text-white">
                      {d.points}
                    </div>
                  </div>
                  <div
                    className="mt-3 font-black uppercase leading-tight"
                    style={{
                      fontFamily: "'Kanit', system-ui, sans-serif",
                      fontSize: "1.15rem",
                    }}
                  >
                    {d.name}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {d.team}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-white/10 pt-2 text-[10px] font-bold tracking-widest text-zinc-400">
                    <span>{d.wins} VICTORIAS</span>
                    <span>{d.podiums} PODIOS</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Roster 2026 */}
        {drivers.length > 0 ? (
          <div className="mt-14">
            <FadeIn>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-400">
                PARRILLA 2026 · {drivers.length} PILOTOS CONFIRMADOS
              </h3>
            </FadeIn>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {drivers.map((d, i) => (
                <motion.div
                  key={d.name}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-zinc-900"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.03 }}
                  style={{
                    background: `linear-gradient(135deg, ${d.color}aa 0%, #000 100%)`,
                  }}
                >
                  <div
                    className="absolute -bottom-3 -right-2 select-none font-black leading-none text-white/15"
                    style={{
                      fontFamily: "'Kanit', system-ui, sans-serif",
                      fontSize: "5rem",
                    }}
                  >
                    {d.number}
                  </div>
                  <div className="relative flex h-full flex-col p-3">
                    <span className="self-start rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white backdrop-blur">
                      #{d.number}
                    </span>
                    <div className="mt-auto">
                      <div className="text-sm font-bold uppercase leading-tight">{d.name}</div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/70">
                        {d.team}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Última carrera 2026 */}
        {lastRace ? (
          <div className="mt-14 rounded-2xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur md:p-8">
            <FadeIn>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-400">
                ÚLTIMA CARRERA 2026 · GP DE {lastRace.track.toUpperCase()}
              </h3>
            </FadeIn>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {lastRace.podium.map((p, i) => (
                <motion.div
                  key={p.driver}
                  className="flex items-center gap-4 rounded-lg border border-white/10 bg-black/60 p-4"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-black"
                    style={{ background: p.color, color: "#fff" }}
                  >
                    {p.pos}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{p.driver}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      {p.team}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-black tabular-nums text-white">
                      {p.points}
                    </div>
                    <div className="text-[9px] font-bold tracking-widest text-zinc-500">PTS</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ============================================================
// 12. F1 SEASON BANNER — Separador gigante entre temporadas
// ============================================================
export type F1SeasonBannerProps = {
  year?: string;
  label?: string;
  description?: string;
  /** Tema visual: red (default 2025), violet (2026), neutral (histórico). */
  variant?: "red" | "violet" | "neutral";
};

export function F1SeasonBanner({
  year = "2025",
  label = "TEMPORADA EN CURSO",
  description = "Desde Melbourne hasta Abu Dhabi · 24 Grandes Premios · 10 escuderías",
  variant = "red",
}: F1SeasonBannerProps) {
  const palette = {
    red: {
      bg: "linear-gradient(180deg, #000 0%, #1a0000 50%, #000 100%)",
      glow: "rgba(220,0,0,0.5)",
      yearGrad: "linear-gradient(180deg, #fff 0%, #fff 50%, #DC0000 50%, #8B0000 100%)",
      labelColor: "#FF6666",
      lineColor: "#DC0000",
    },
    violet: {
      bg: "linear-gradient(180deg, #000 0%, #16002a 50%, #000 100%)",
      glow: "rgba(120,30,255,0.5)",
      yearGrad: "linear-gradient(180deg, #fff 0%, #fff 50%, #c08bff 50%, #6622ff 100%)",
      labelColor: "#c08bff",
      lineColor: "#6622ff",
    },
    neutral: {
      bg: "linear-gradient(180deg, #000 0%, #1a1a1a 50%, #000 100%)",
      glow: "rgba(255,255,255,0.3)",
      yearGrad: "linear-gradient(180deg, #fff 0%, #fff 50%, #999 50%, #444 100%)",
      labelColor: "#999",
      lineColor: "#666",
    },
  }[variant];

  return (
    <section
      className="csm-show-f1 relative overflow-hidden py-20 text-white"
      style={{ background: palette.bg }}
    >
      {/* Glow lateral */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${palette.glow}, transparent 60%)`,
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        aria-hidden
      />
      {/* Línea LED top */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${palette.lineColor} 50%, transparent 100%)`,
          boxShadow: `0 0 20px ${palette.lineColor}`,
        }}
        aria-hidden
      />
      {/* Línea LED bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${palette.lineColor} 50%, transparent 100%)`,
          boxShadow: `0 0 20px ${palette.lineColor}`,
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <FadeIn>
          <div
            className="text-[12px] font-bold uppercase tracking-[0.5em]"
            style={{ color: palette.labelColor }}
          >
            {label}
          </div>
        </FadeIn>
        <FadeIn delay={0.1} y={30}>
          <div
            className="mt-4 font-black uppercase leading-none tabular-nums"
            style={{
              fontSize: "clamp(7rem, 28vw, 22rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
              background: palette.yearGrad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 50px ${palette.glow})`,
              letterSpacing: "-0.02em",
            }}
          >
            {year}
          </div>
        </FadeIn>
        <FadeIn delay={0.3} y={20}>
          <p
            className="mx-auto mt-2 max-w-2xl text-sm tracking-widest"
            style={{ color: palette.labelColor }}
          >
            {description}
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ============================================================
// 13. F1 CHAMPIONS HISTORY — Campeones de temporadas pasadas (2022-2024)
// ============================================================
export type F1ChampionsProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  champions?: F1Champion[];
};

export function F1ChampionsHistory({
  eyebrow = "PALMARÉS RECIENTE",
  title = "Campeones por temporada",
  subtitle = "Mundial de Pilotos y de Constructores en las últimas temporadas. Datos derivados de los resultados oficiales por carrera.",
  champions = F1_CHAMPIONS_HISTORY,
}: F1ChampionsProps) {
  return (
    <section className="csm-show-f1 relative bg-zinc-950 py-24 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
            {eyebrow}
          </div>
          <h2
            className="mt-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              fontFamily: "'Kanit', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-zinc-400">{subtitle}</p>
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {champions.map((c, i) => (
            <motion.div
              key={c.year}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-7 backdrop-blur"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              {/* Diagonal stripe color campeón */}
              <div
                className="absolute -right-10 -top-10 h-40 w-40 opacity-30"
                style={{
                  background: `linear-gradient(135deg, ${c.driverColor} 0%, transparent 70%)`,
                  transform: "rotate(45deg)",
                }}
                aria-hidden
              />
              {/* Año gigante */}
              <div
                className="font-mono font-black leading-none tabular-nums"
                style={{
                  fontFamily: "'Kanit', system-ui, sans-serif",
                  fontSize: "clamp(3.5rem, 6vw, 5rem)",
                  background:
                    "linear-gradient(180deg, #fff 0%, #fff 50%, #DC0000 50%, #8B0000 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {c.year}
              </div>

              {/* Driver champ */}
              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  CAMPEÓN PILOTOS
                </div>
                <div
                  className="mt-2 font-black uppercase leading-tight"
                  style={{
                    fontFamily: "'Kanit', system-ui, sans-serif",
                    fontSize: "1.6rem",
                    color: c.driverColor,
                  }}
                >
                  🏆 {c.driver}
                </div>
                <div className="mt-1 text-[11px] font-bold tracking-wider text-zinc-300">
                  {c.driverTeam}
                </div>
                <div className="mt-3 flex gap-4 text-[11px]">
                  <div>
                    <div className="font-mono text-base font-black tabular-nums text-white">
                      {c.driverPoints}
                    </div>
                    <div className="text-[9px] tracking-widest text-zinc-500">PTS</div>
                  </div>
                  <div>
                    <div className="font-mono text-base font-black tabular-nums text-white">
                      {c.driverWins}
                    </div>
                    <div className="text-[9px] tracking-widest text-zinc-500">VICTORIAS</div>
                  </div>
                </div>
              </div>

              {/* Constructor champ */}
              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  CAMPEÓN CONSTRUCTORES
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      background: c.constructorColor,
                      boxShadow: `0 0 12px ${c.constructorColor}`,
                    }}
                  />
                  <div
                    className="font-black uppercase leading-tight"
                    style={{
                      fontFamily: "'Kanit', system-ui, sans-serif",
                      fontSize: "1.3rem",
                      color: c.constructorColor,
                    }}
                  >
                    {c.constructor}
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-[11px]">
                  <div>
                    <div className="font-mono text-base font-black tabular-nums text-white">
                      {c.constructorPoints}
                    </div>
                    <div className="text-[9px] tracking-widest text-zinc-500">PTS</div>
                  </div>
                  <div>
                    <div className="font-mono text-base font-black tabular-nums text-white">
                      {c.constructorWins}
                    </div>
                    <div className="text-[9px] tracking-widest text-zinc-500">VICTORIAS</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 14. F1 CTA — bloque final dramático
// ============================================================
export type F1CtaProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  emailPlaceholder?: string;
};

export function F1Cta({
  eyebrow = "VIVE LA F1 EN VIVO",
  title = "No te pierdas ni una vuelta.",
  subtitle = "Resultados, clasificaciones, análisis y momentos clave. Cada semana en tu inbox.",
  ctaText = "Suscríbete",
  ctaHref = "#",
  emailPlaceholder = "tu@email.com",
}: F1CtaProps) {
  return (
    <section className="csm-show-f1 relative overflow-hidden bg-black py-32 text-white">
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #000 0%, #1a0000 35%, #DC0000 70%, #000 100%)",
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(220,0,0,0.3) 0px, rgba(220,0,0,0.3) 1px, transparent 1px, transparent 4px)",
        }}
        aria-hidden
      />
      {/* Cross-flares */}
      {[0, 30, 65].map((y, i) => (
        <motion.div
          key={y}
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent"
          style={{ top: `${y}%` }}
          initial={{ x: "-100vw", opacity: 0 }}
          animate={{ x: "100vw", opacity: [0, 1, 0] }}
          transition={{
            duration: 3 + i * 0.5,
            delay: i * 0.6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          aria-hidden
        />
      ))}

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <FadeIn>
          <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-red-300">
            {eyebrow}
          </div>
        </FadeIn>
        <FadeIn delay={0.15} y={30}>
          <h2
            className="mt-5 font-black uppercase leading-[0.95]"
            style={{
              fontFamily: "'Kanit', system-ui, sans-serif",
              fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
              textShadow: "0 0 40px rgba(220,0,0,0.5)",
            }}
          >
            {title}
          </h2>
        </FadeIn>
        <FadeIn delay={0.3} y={20}>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-200">{subtitle}</p>
        </FadeIn>
        <FadeIn delay={0.45} y={20}>
          <form className="mx-auto mt-10 flex max-w-md gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder={emailPlaceholder}
              className="flex-1 rounded-lg border border-white/30 bg-black/60 px-4 py-3 text-white placeholder:text-zinc-400 backdrop-blur focus:border-red-500 focus:outline-none"
            />
            <a
              href={ctaHref}
              className="rounded-lg bg-white px-6 py-3 font-bold uppercase tracking-wider text-black transition hover:bg-red-500 hover:text-white"
              style={{ boxShadow: "0 0 30px rgba(255,255,255,0.4)" }}
            >
              {ctaText}
            </a>
          </form>
        </FadeIn>
      </div>
    </section>
  );
}
