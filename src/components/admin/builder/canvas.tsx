"use client";

import { RenderLayout } from "@/blocks/render";
import type { BlockNode, Breakpoint, RenderContext } from "@/blocks/types";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { useMemo } from "react";

const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  mobile: 390,
  tablet: 820,
  desktop: 1280,
};

type Props = {
  layout: BlockNode[];
  ctx: RenderContext;
  breakpoint: Breakpoint;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropNew: (kind: string, parentId: string | null, index: number) => void;
};

export function BuilderCanvas({ layout, ctx, breakpoint, selectedId, onSelect, onDropNew }: Props) {
  const width = BREAKPOINT_WIDTHS[breakpoint];

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const block = target.closest("[data-block-id]") as HTMLElement | null;
    if (!block) {
      onSelect(null);
      return;
    }
    onSelect(block.dataset.blockId ?? null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/csm-block-kind");
    if (!kind) return;
    // Drop at root, end of layout
    onDropNew(kind, null, layout.length);
  }

  return (
    <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[radial-gradient(circle_at_50%_-20%,oklch(0.72_0.18_290_/.05),transparent_70%)] py-6">
      <div
        className={cn(
          "flex flex-col rounded-2xl border bg-background shadow-xl shadow-black/20 transition-all",
          breakpoint === "mobile" && "w-[390px]",
          breakpoint === "tablet" && "w-[820px]",
          breakpoint === "desktop" && "w-[1280px]",
        )}
        style={{ minWidth: width }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {layout.length === 0 ? (
          <EmptyCanvas onDropNew={(k) => onDropNew(k, null, 0)} />
        ) : (
          <div className="relative">
            {/* Render each top-level block wrapped with selection overlay */}
            {layout.map((node) => (
              <SelectionWrapper key={node.id} blockId={node.id} isSelected={selectedId === node.id}>
                <RenderLayout layout={[node]} ctx={ctx} breakpoint={breakpoint} />
              </SelectionWrapper>
            ))}
            {/* Drop zone at end */}
            <DropZone
              onDropKind={(k) => onDropNew(k, null, layout.length)}
              label="Suelta aquí o haz click en un bloque del panel"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SelectionWrapper({
  children,
  blockId,
  isSelected,
}: {
  children: React.ReactNode;
  blockId: string;
  isSelected: boolean;
}) {
  return (
    <div data-block-id={blockId} className={cn("relative isolate", isSelected && "z-10")}>
      {children}
      {isSelected ? (
        <div className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-primary ring-offset-2 ring-offset-background" />
      ) : null}
    </div>
  );
}

function EmptyCanvas({ onDropNew }: { onDropNew: (kind: string) => void }) {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center p-12"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const kind = e.dataTransfer.getData("application/csm-block-kind");
        if (kind) onDropNew(kind);
      }}
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-foreground/20 bg-card/30 px-12 py-20 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Icons.LayoutPanelLeft className="size-6" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Lienzo en blanco</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Arrastra un bloque desde el panel de la izquierda o haz click sobre uno para añadirlo.
            Empieza por <strong>Hero</strong>.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {(["hero", "cta", "features-grid", "section"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onDropNew(k)}
              className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted"
            >
              + {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DropZone({
  onDropKind,
  label,
}: {
  onDropKind: (kind: string) => void;
  label: string;
}) {
  return (
    <div
      className="flex h-12 items-center justify-center px-6 text-[10.5px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const kind = e.dataTransfer.getData("application/csm-block-kind");
        if (kind) onDropKind(kind);
      }}
    >
      <span className="flex items-center gap-2">
        <span className="h-px w-12 bg-current opacity-40" /> {label}{" "}
        <span className="h-px w-12 bg-current opacity-40" />
      </span>
    </div>
  );
}

export function useCanvasContext(initial: RenderContext): RenderContext {
  // Por simplicidad, el contexto inicial se preserva. La fase 4 no resuelve
  // dinámicamente nuevas referencias de media añadidas en el builder — el preview
  // refresca tras autosave + revalidate, ya con el ctx completo del server.
  return useMemo(() => initial, [initial]);
}
