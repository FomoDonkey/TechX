"use client";

/**
 * Cursor virtual auto-animado para los iframes de preview de plantillas.
 *
 * Por qué existe:
 *  - Efectos como Magnetic, Spotlight y otros dependen de mousemove real para
 *    verse. Sin cursor en el iframe se quedan estáticos.
 *
 * Cómo funciona — tour guiado:
 *  1. Solo se activa si `window.parent !== window` (estamos en iframe).
 *  2. Localiza targets `[data-csm-target]` en el DOM (hero-center, cta-primary,
 *     cta-secondary, etc).
 *  3. Construye una secuencia de waypoints. Para cada target, añade además
 *     puntos auxiliares cercanos para crear un movimiento "explorando" (no
 *     simplemente saltando de elemento a elemento).
 *  4. Anima el cursor entre waypoints con easing easeInOutCubic.
 *  5. En cada frame dispatcha `mousemove` sobre el elemento bajo el cursor
 *     → React captura via delegation y los efectos responden.
 *  6. Pausa breve en cada waypoint para que el efecto se aprecie.
 *  7. Refresca la lista de targets cada 5s por si el layout cambia.
 */

import { useEffect, useRef, useState } from "react";

type Waypoint = { x: number; y: number; pause: number };

const STEP_DURATION_MS = 1100; // tiempo de tránsito entre waypoints
const PAUSE_DEFAULT_MS = 700; // pausa estándar al llegar
const PAUSE_LONG_MS = 1300; // pausa larga (CTAs, hero centro)

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function buildWaypoints(): Waypoint[] {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-csm-target]"));
  if (targets.length === 0) return [];

  const waypoints: Waypoint[] = [];
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const kind = el.getAttribute("data-csm-target");
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    if (kind === "hero-center") {
      // Recorrido por el área del hero — diagonal grande (revela el spotlight,
      // dispara mousemove sobre toda la sección).
      const padX = r.width * 0.2;
      const padY = r.height * 0.2;
      waypoints.push({ x: r.left + padX, y: r.top + padY, pause: PAUSE_DEFAULT_MS });
      waypoints.push({ x: r.right - padX, y: r.bottom - padY, pause: PAUSE_DEFAULT_MS });
      waypoints.push({ x: cx, y: cy, pause: PAUSE_LONG_MS });
    } else if (kind === "cta-primary" || kind === "cta-secondary") {
      // Sobrevolar el botón con pausa larga para que magnetic se vea bien.
      waypoints.push({ x: cx, y: cy, pause: PAUSE_LONG_MS });
      // Pequeño wiggle alrededor para amplificar el efecto magnético.
      waypoints.push({ x: cx - r.width * 0.4, y: cy + 8, pause: 300 });
      waypoints.push({ x: cx + r.width * 0.4, y: cy - 8, pause: 300 });
    }
  }
  return waypoints;
}

export function DemoCursor() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const waypointsRef = useRef<Waypoint[]>([]);
  const stateRef = useRef({
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    startedAt: 0,
    waitingUntil: 0,
    idx: 0,
  });

  useEffect(() => {
    const isIframe = typeof window !== "undefined" && window.parent !== window;
    if (!isIframe) return;
    setActive(true);

    // Build inicial — esperamos un poco a que el DOM se asiente (animaciones
    // initial fade-in del hero pueden cambiar dimensiones).
    const refresh = () => {
      const wps = buildWaypoints();
      if (wps.length > 0) {
        waypointsRef.current = wps;
        // Si idx está fuera de rango, reset.
        if (stateRef.current.idx >= wps.length) stateRef.current.idx = 0;
      }
    };
    const initialTimer = setTimeout(() => {
      refresh();
      // Posición inicial: centro del viewport.
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      stateRef.current.fromX = cx;
      stateRef.current.fromY = cy;
      const first = waypointsRef.current[0];
      if (first) {
        stateRef.current.toX = first.x;
        stateRef.current.toY = first.y;
      } else {
        stateRef.current.toX = cx;
        stateRef.current.toY = cy;
      }
      stateRef.current.startedAt = performance.now();
      setPos({ x: cx, y: cy });
    }, 800);

    // Refresca targets cada 5s (por si el layout cambia o el iframe rerenders).
    const refreshTimer = setInterval(refresh, 5_000);

    let raf = 0;
    let lastDispatch = 0;

    const tick = () => {
      const s = stateRef.current;
      const wps = waypointsRef.current;
      const now = performance.now();

      if (wps.length === 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // Si estamos en pausa, mantener posición destino.
      if (now < s.waitingUntil) {
        const x = s.toX;
        const y = s.toY;
        setPos({ x, y });
        // Sigue dispatchando mousemove durante la pausa para que el efecto
        // se mantenga (importante para spotlight con orb pegado al cursor).
        if (now - lastDispatch > 33) {
          lastDispatch = now;
          dispatchMouseMove(x, y);
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - s.startedAt;
      const t = Math.min(1, elapsed / STEP_DURATION_MS);
      const e = easeInOutCubic(t);
      const x = s.fromX + (s.toX - s.fromX) * e;
      const y = s.fromY + (s.toY - s.fromY) * e;

      setPos({ x, y });

      if (now - lastDispatch > 33) {
        lastDispatch = now;
        dispatchMouseMove(x, y);
      }

      // Llegamos al destino → siguiente waypoint
      if (t >= 1) {
        const cur = wps[s.idx];
        s.waitingUntil = now + (cur?.pause ?? PAUSE_DEFAULT_MS);
        s.idx = (s.idx + 1) % wps.length;
        const next = wps[s.idx];
        if (next) {
          s.fromX = s.toX;
          s.fromY = s.toY;
          s.toX = next.x;
          s.toY = next.y;
        }
        s.startedAt = now + (cur?.pause ?? PAUSE_DEFAULT_MS);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(initialTimer);
      clearInterval(refreshTimer);
    };
  }, []);

  if (!active) return null;

  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${pos.x - 5}px, ${pos.y - 4}px)`,
        pointerEvents: "none",
        zIndex: 999_999,
        willChange: "transform",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
      }}
    >
      <title>Cursor demo</title>
      {/* Aura violeta pulsante */}
      <circle cx="11" cy="11" r="11" fill="rgba(155,92,255,0.18)">
        <animate attributeName="r" values="9;13;9" dur="1.6s" repeatCount="indefinite" />
        <animate
          attributeName="opacity"
          values="0.45;0.15;0.45"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Puntero clásico (Apple-like) blanco con borde negro */}
      <path
        d="M5 3 L5 17 L9 13.5 L11.5 18.5 L13.5 17.6 L11 12.6 L16 12.6 Z"
        fill="white"
        stroke="black"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function dispatchMouseMove(x: number, y: number) {
  try {
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const ev = new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
    });
    el.dispatchEvent(ev);
  } catch {
    /* swallow — algunos elementos throwean en elementFromPoint con shadow DOM */
  }
}
