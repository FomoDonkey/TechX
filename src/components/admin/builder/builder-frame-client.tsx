"use client";

/**
 * Wrapper client que vive DENTRO del iframe del builder.
 *
 * Responsabilidades:
 *  - Renderizar el árbol de bloques con `RenderLayout`.
 *  - Escuchar `BroadcastChannel("csm:builder:${pageId}")` para recibir
 *    actualizaciones de layout en vivo desde el editor parent.
 *  - Enviar postMessage al parent en cada click sobre un bloque para que el
 *    parent abra el inspector con el bloque seleccionado.
 *
 * El iframe se carga con la layout inicial guardada en BD; durante la edición
 * el parent envía updates por BroadcastChannel sin necesidad de recargar el
 * iframe — propaga animaciones/scroll position correctos.
 */

import { RenderLayout } from "@/blocks/render";
import { type BlockNode, type Breakpoint, normalizeLayout } from "@/blocks/types";
import { useEffect, useState } from "react";

type Props = {
  pageId: string;
  workspaceId: string;
  initialLayout: unknown[];
};

const GUEST_VIEWER = {
  isAuthenticated: false,
  email: null,
  isActive: false,
  tierId: null,
  country: null,
  device: "desktop" as const,
  utm: {},
  hour: null,
};

export function BuilderFrameClient({ pageId, workspaceId, initialLayout }: Props) {
  const [layout, setLayout] = useState<BlockNode[]>(() => normalizeLayout(initialLayout));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  // Listen for live layout updates from parent (page-builder editor).
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`csm:builder:${pageId}`);
    bc.onmessage = (ev) => {
      const data = ev.data as
        | { type: "layout"; layout: unknown[]; breakpoint?: Breakpoint }
        | { type: "selection"; id: string | null }
        | undefined;
      if (!data) return;
      if (data.type === "layout") {
        setLayout(normalizeLayout(data.layout));
        if (data.breakpoint) setBreakpoint(data.breakpoint);
      } else if (data.type === "selection") {
        setSelectedId(data.id);
      }
    };
    // Aviso al parent que el iframe está listo para recibir layout
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "csm-frame-ready", pageId }, "*");
    }
    return () => bc.close();
  }, [pageId]);

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // RenderLayout en editMode marca cada bloque con data-csm-block-id
    // (no data-block-id). Buscamos el más cercano al click.
    const block = target.closest("[data-csm-block-id]") as HTMLElement | null;
    const id = block?.getAttribute("data-csm-block-id") ?? null;
    setSelectedId(id);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "csm-frame-select", pageId, id },
        "*",
      );
    }
  }

  // biome-ignore lint/a11y/useKeyWithClickEvents: iframe overlay for editor selection.
  return (
    <div
      onClick={handleClick}
      className="csm-builder-frame relative min-h-screen w-full overflow-x-hidden"
    >
      <RenderLayout
        layout={layout}
        ctx={{
          workspaceId,
          mediaMap: new Map(),
          symbolMap: new Map(),
          viewer: GUEST_VIEWER,
          bypassGates: true,
          editMode: true,
        }}
        breakpoint={breakpoint}
      />
      {/* Overlay de selección — un solo div absolute que sigue al elemento
          con `data-csm-block-id={selectedId}` */}
      <SelectionRing selectedId={selectedId} />
    </div>
  );
}

/**
 * Dibuja un ring outline siguiendo al elemento seleccionado dentro del frame.
 * Usa `getBoundingClientRect` + ResizeObserver para reposicionar.
 */
function SelectionRing({ selectedId }: { selectedId: string | null }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    if (!selectedId) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-csm-block-id="${selectedId}"]`) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [selectedId]);

  if (!rect) return null;
  return (
    <div
      className="pointer-events-none absolute z-50 rounded-sm ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />
  );
}
