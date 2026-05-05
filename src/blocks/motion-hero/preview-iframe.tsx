"use client";

/**
 * Preview LIVE de una plantilla en miniatura. Carga la página real
 * `/template-preview/[id]` dentro de un iframe escalado al tamaño del card.
 *
 * Por qué iframe en vez de re-render inline:
 *  - Los hero variants (magnetic, spotlight, particles…) tienen efectos que
 *    dependen del rendering full-screen y CSS de la página real.
 *  - El iframe garantiza fidelidad 1:1 con cómo se ve la plantilla aplicada.
 *  - Aislamiento: el CSS/JS de la card no contamina el preview y viceversa.
 *
 * Performance:
 *  - `loading="lazy"` browser-native + `IntersectionObserver` para montar
 *    solo cuando el card es visible.
 *  - `pointer-events: none` para que el card padre capture hover.
 *  - Auto-scale via `ResizeObserver`: la plantilla se diseña a 1280×800 y se
 *    escala proporcionalmente al ancho del card, manteniendo aspect 16:10.
 */

import { useEffect, useRef, useState } from "react";

const DESIGN_W = 1280;
const DESIGN_H = 800;

type Props = {
  templateId: string;
  /** Ya empezó hover en la card padre — fuerza monte aunque IO aún no disparó. */
  force?: boolean;
};

export function PreviewIframe({ templateId, force }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [visible, setVisible] = useState(false);

  // Auto-scale según ancho del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setScale(w / DESIGN_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lazy mount: solo carga el iframe cuando el card entra en viewport.
  useEffect(() => {
    if (force) {
      setVisible(true);
      return undefined;
    }
    const el = containerRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [force]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#0a0612]"
      // Skeleton mientras no hay iframe — dibuja un gradient sutil para no
      // ver "nada" en cards bajo el fold.
      style={
        visible
          ? undefined
          : {
              backgroundImage:
                "radial-gradient(closest-side at 30% 30%, rgba(155,92,255,0.15), transparent), radial-gradient(closest-side at 70% 70%, rgba(255,93,177,0.12), transparent)",
            }
      }
    >
      {visible ? (
        <iframe
          title="Preview de plantilla"
          src={`/template-preview/${templateId}`}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          className="border-0 absolute origin-top-left"
          style={{
            width: `${DESIGN_W}px`,
            height: `${DESIGN_H}px`,
            transform: `scale(${scale})`,
          }}
        />
      ) : null}
      {/* pointer-events:none global: el card padre captura hover */}
      <div aria-hidden className="absolute inset-0" style={{ pointerEvents: "none" }} />
    </div>
  );
}
