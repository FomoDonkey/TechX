"use client";

import { isEditableTarget } from "@/lib/dom";
import type { MediaRow } from "@/lib/media-types";
import { mediaKind } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Music, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  items: MediaRow[];
  selected: Set<string>;
  onToggle: (id: string, multi: boolean) => void;
  onOpen: (id: string) => void;
};

const TARGET_ROW_HEIGHT = 200;
const ROW_GAP = 8;

type RowItem = MediaRow & { displayW: number; displayH: number };

function buildRows(items: MediaRow[], containerW: number): RowItem[][] {
  if (containerW <= 0) return [];
  const rows: RowItem[][] = [];
  let buf: MediaRow[] = [];
  let aspectSum = 0;

  function flush(forceLast = false) {
    if (buf.length === 0) return;
    let scale = 1;
    const widthAtTarget = aspectSum * TARGET_ROW_HEIGHT + ROW_GAP * (buf.length - 1);
    if (!forceLast && widthAtTarget < containerW) {
      // tall row that doesn't fill — leave it natural height for the last row
    }
    scale = (containerW - ROW_GAP * (buf.length - 1)) / (aspectSum * TARGET_ROW_HEIGHT);
    if (forceLast && scale > 1.4) scale = 1; // last row: don't blow up
    const finalH = TARGET_ROW_HEIGHT * scale;
    const row: RowItem[] = buf.map((it) => {
      const aspect = (it.width ?? 1) / (it.height ?? 1);
      return { ...it, displayH: finalH, displayW: finalH * aspect };
    });
    rows.push(row);
    buf = [];
    aspectSum = 0;
  }

  for (const it of items) {
    const aspect = (it.width ?? 800) / (it.height ?? 600);
    buf.push(it);
    aspectSum += aspect;
    const widthAtTarget = aspectSum * TARGET_ROW_HEIGHT + ROW_GAP * (buf.length - 1);
    if (widthAtTarget >= containerW) flush(false);
  }
  flush(true);
  return rows;
}

function variantUrl(item: MediaRow, size: "thumb" | "small" | "medium"): string {
  const v = item.variants as { sizes?: Record<string, Record<string, { url?: string }>> } | null;
  return v?.sizes?.[size]?.webp?.url ?? v?.sizes?.[size]?.avif?.url ?? item.url;
}

function srcSet(item: MediaRow): string | undefined {
  const v = item.variants as {
    sizes?: Record<string, Record<string, { url?: string; w?: number }>>;
  } | null;
  if (!v?.sizes) return undefined;
  const parts: string[] = [];
  for (const sz of ["thumb", "small", "medium"] as const) {
    const w = v.sizes[sz]?.webp;
    if (w?.url && w.w) parts.push(`${w.url} ${w.w}w`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function Tile({
  item,
  selected,
  onToggle,
  onOpen,
  width,
  height,
}: {
  item: RowItem;
  selected: boolean;
  onToggle: (id: string, multi: boolean) => void;
  onOpen: (id: string) => void;
  width: number;
  height: number;
}) {
  const kind = mediaKind(item.mime);
  return (
    <button
      type="button"
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onToggle(item.id, true);
        else onOpen(item.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(item.id);
      }}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-lg border bg-muted/30 transition-all",
        selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/40",
      )}
      style={{
        width,
        height,
        backgroundColor: item.dominantColor ?? undefined,
      }}
    >
      {kind === "image" ? (
        <img
          src={variantUrl(item, "small")}
          srcSet={srcSet(item)}
          sizes={`${Math.ceil(width)}px`}
          alt={item.alt ?? item.filename ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${item.focalX ?? 50}% ${item.focalY ?? 50}%` }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          {kind === "video" ? <Video className="size-10" /> : null}
          {kind === "audio" ? <Music className="size-10" /> : null}
          {kind === "doc" ? <FileText className="size-10" /> : null}
          {kind === "other" ? <ImageIcon className="size-10" /> : null}
          <span className="line-clamp-2 px-2 text-center text-[10px]">{item.filename}</span>
        </div>
      )}

      <span
        className={cn(
          "absolute left-2 top-2 grid size-5 place-items-center rounded border-2 border-white/80 bg-black/40 text-white transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id, false);
        }}
      >
        {selected ? <span className="block h-2 w-2 rounded-sm bg-primary" /> : null}
      </span>

      {!item.alt ? (
        <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
          sin alt
        </span>
      ) : null}

      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-3 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {item.filename ?? "Sin nombre"}
      </span>
    </button>
  );
}

export function MediaGrid({ items, selected, onToggle, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => buildRows(items, width), [items, width]);

  return (
    <div ref={containerRef} className="space-y-2 p-4">
      {rows.map((row, i) => (
        <div key={`row-${i}-${row[0]?.id ?? "x"}`} className="flex gap-2">
          {row.map((item) => (
            <Tile
              key={item.id}
              item={item}
              width={item.displayW}
              height={item.displayH}
              selected={selected.has(item.id)}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function itemsKey(items: MediaRow[]): string {
  // Hash estable basado en IDs visibles + count, para detectar cambios de lista.
  return items.length === 0
    ? "empty"
    : `${items.length}:${items[0]?.id}:${items[items.length - 1]?.id}`;
}

export function MediaGridShell({ items }: { items: MediaRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, multi: boolean) {
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (prev.has(id) && multi) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSel() {
    setSelected(new Set());
  }

  function open(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("asset", id);
    router.replace(`/admin/medios?${next.toString()}`, { scroll: false });
  }

  // Keyboard: backspace deletes selection.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clearSel es estable; solo importa el size para resuscribir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if ((e.key === "Backspace" || e.key === "Delete") && selected.size > 0) {
        e.preventDefault();
        // Delegated to BulkBar via window event
        window.dispatchEvent(new CustomEvent("csm:medios:bulk-delete"));
      } else if (e.key === "Escape" && selected.size > 0) {
        clearSel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  // Reset selección si cambian los items (filtro/búsqueda/paginación) — evita
  // borrar IDs que ya no son visibles en el filtro actual.
  // biome-ignore lint/correctness/useExhaustiveDependencies: queremos resetear cuando cambia la lista visible
  useEffect(() => {
    setSelected(new Set());
  }, [itemsKey(items)]);

  return (
    <div className="relative">
      <MediaGrid items={items} selected={selected} onToggle={toggle} onOpen={open} />
      {selected.size > 0 ? <BulkBar ids={Array.from(selected)} onClear={clearSel} /> : null}
    </div>
  );
}

import { BulkBar } from "./bulk-bar";
