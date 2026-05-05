"use client";

import "@/components/admin/editor/editor-styles.css";
import { RenderLayout } from "@/blocks/render";
import type { BlockNode, Breakpoint, RenderContext } from "@/blocks/types";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Canvas del page builder = iframe que carga `/admin/builder-frame/[pageId]`.
 *
 * Por qué iframe: para que cuando el usuario hace clic en mobile/tablet, el
 * viewport del iframe sea exactamente ese ancho — y los breakpoints Tailwind
 * (`md:`, `lg:`) responden de verdad. Es el approach que usan Webflow,
 * Framer, Builder.io, etc. Es lo que el usuario realmente verá al publicar.
 *
 * Comunicación con el iframe via BroadcastChannel para layout updates en
 * vivo + postMessage para clicks/selección. La layout inicial la lee el
 * iframe de la BD; los edits sin guardar se sincronizan via channel.
 */

const BREAKPOINT_WIDTHS: Record<Breakpoint, number | null> = {
  mobile: 390,
  tablet: 820,
  desktop: null, // null = ancho completo (fluid)
};

type Props = {
  layout: BlockNode[];
  ctx: RenderContext;
  breakpoint: Breakpoint;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropNew: (kind: string, parentId: string | null, index: number) => void;
  /** ID de la página — si está, render por iframe (responsive real). Si no,
   * render inline (modo símbolo, sin responsive de viewport). */
  pageId?: string;
};

export function BuilderCanvas(props: Props) {
  if (!props.pageId) {
    return <BuilderCanvasInline {...props} />;
  }
  return <BuilderCanvasIframe {...props} pageId={props.pageId} />;
}

function BuilderCanvasIframe({
  layout,
  breakpoint,
  selectedId,
  onSelect,
  onDropNew,
  pageId,
}: Props & { pageId: string }) {
  const fixedWidth = BREAKPOINT_WIDTHS[breakpoint];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const [frameReady, setFrameReady] = useState(false);

  // Mide ancho del wrapper para scale-to-fit (solo aplica a tablet/móvil
  // cuando el ancho fijo no cabe).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => setWrapperWidth(wrapper.clientWidth));
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Listen for messages from iframe child (selection + ready signal).
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as
        | { type: "csm-frame-ready"; pageId: string }
        | { type: "csm-frame-select"; pageId: string; id: string | null }
        | undefined;
      if (!data || data.pageId !== pageId) return;
      if (data.type === "csm-frame-ready") {
        setFrameReady(true);
      } else if (data.type === "csm-frame-select") {
        onSelect(data.id);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pageId, onSelect]);

  // Broadcast layout to iframe whenever it changes (live updates without
  // reloading). Solo emite cuando el iframe ha avisado que está ready.
  useEffect(() => {
    if (!frameReady) return;
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`csm:builder:${pageId}`);
    bc.postMessage({ type: "layout", layout, breakpoint });
    bc.close();
  }, [layout, breakpoint, pageId, frameReady]);

  // Broadcast selection cuando cambia desde el parent (ej. inspector close).
  useEffect(() => {
    if (!frameReady) return;
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`csm:builder:${pageId}`);
    bc.postMessage({ type: "selection", id: selectedId });
    bc.close();
  }, [selectedId, pageId, frameReady]);

  // Calcula scale para tablet/mobile si el canvas no cabe.
  const padX = 48;
  const available = Math.max(120, wrapperWidth - padX);
  const scale = fixedWidth ? Math.min(1, available / fixedWidth) : 1;
  const renderedWidth = fixedWidth ?? Math.max(320, available);
  const useScale = fixedWidth !== null && scale < 1;
  const iframeHeight = useScale ? "100%" : "100%";

  // Drop zones del palette — se manejan con HTML5 drag/drop sobre un overlay
  // detectando el evento drop. Por simplicidad, un drop sobre el iframe wrapper
  // añade el bloque al final.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/csm-block-kind");
      if (!kind) return;
      onDropNew(kind, null, layout.length);
    },
    [layout.length, onDropNew],
  );

  // Memoize iframe src to avoid reload on unrelated re-renders.
  const iframeSrc = useMemo(() => `/builder-frame/${pageId}`, [pageId]);

  return (
    <div
      ref={wrapperRef}
      className="relative flex min-h-0 flex-1 flex-col items-center overflow-auto bg-[radial-gradient(circle_at_50%_-20%,oklch(0.72_0.18_290_/.05),transparent_70%)] py-6"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      {/* Indicador de modo + scale */}
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
        {breakpoint === "mobile" ? (
          <>
            <Icons.Smartphone className="size-3.5" /> Móvil · 390px
          </>
        ) : breakpoint === "tablet" ? (
          <>
            <Icons.Tablet className="size-3.5" /> Tablet · 820px
          </>
        ) : (
          <>
            <Icons.Monitor className="size-3.5" /> Escritorio · {Math.round(renderedWidth)}px
          </>
        )}
        {useScale ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
            <Icons.ZoomOut className="size-2.5" /> {Math.round(scale * 100)}%
          </span>
        ) : null}
      </div>

      {/* Iframe del canvas — viewport propio para que md:/lg: respondan
          al ancho del iframe, no al de la ventana. */}
      <div
        style={{
          width: useScale ? renderedWidth * scale : "100%",
          maxWidth: "100%",
          flex: "1 1 auto",
          display: "flex",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <div
          className={cn(
            "csm-edit-canvas overflow-hidden rounded-2xl border bg-background shadow-xl shadow-black/20",
            !useScale && "h-full",
          )}
          style={{
            width: renderedWidth,
            transform: useScale ? `scale(${scale})` : undefined,
            transformOrigin: useScale ? "top left" : undefined,
            // Para mobile/tablet sin scale, alto fluido. Con scale, el wrapper
            // exterior compensa el alto vía la prop `width`.
            height: useScale ? "100%" : undefined,
            minHeight: useScale ? "100%" : "min(80vh, 800px)",
          }}
        >
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Editor canvas"
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="block h-full w-full border-0"
            style={{ height: iframeHeight, minHeight: useScale ? renderedWidth * 1.4 : 600 }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback inline (sin iframe) — usado por symbol-builder donde no hay
 * pageId y la responsividad del viewport no aplica.
 */
function BuilderCanvasInline({ layout, ctx, breakpoint, selectedId, onSelect, onDropNew }: Props) {
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const block = target.closest("[data-block-id]") as HTMLElement | null;
    onSelect(block?.dataset.blockId ?? null);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/csm-block-kind");
    if (kind) onDropNew(kind, null, layout.length);
  }
  return (
    <div
      className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[radial-gradient(circle_at_50%_-20%,oklch(0.72_0.18_290_/.05),transparent_70%)] py-6"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div
        className={cn(
          "csm-edit-canvas flex flex-col rounded-2xl border bg-background shadow-xl shadow-black/20",
          breakpoint === "mobile" && "w-[390px]",
          breakpoint === "tablet" && "w-[820px]",
          breakpoint === "desktop" && "w-full max-w-5xl",
        )}
      >
        {layout.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Lienzo vacío. Arrastra un bloque del panel.
          </div>
        ) : (
          <div className="relative">
            {layout.map((node) => (
              <div
                key={node.id}
                data-block-id={node.id}
                className={cn(
                  "relative isolate",
                  selectedId === node.id &&
                    "outline outline-2 outline-violet-500 outline-offset-2",
                )}
              >
                <RenderLayout layout={[node]} ctx={ctx} breakpoint={breakpoint} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
