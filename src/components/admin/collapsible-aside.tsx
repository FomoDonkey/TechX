"use client";

/**
 * Wrapper client para sidebars admin colapsables. Persiste el estado
 * `open/closed` en localStorage por `storageKey` para que la elección
 * del usuario sobreviva navegación y reload.
 *
 * Uso típico:
 *   <CollapsibleAside storageKey="csm:sidebar-admin" side="left" widthOpen="240px">
 *     <Sidebar />
 *   </CollapsibleAside>
 *
 * El botón flotante para expandir aparece pegado al borde cuando está colapsado.
 */

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  children: ReactNode;
  storageKey: string;
  side: "left" | "right";
  widthOpen: string;
  /** Si true, abierto por defecto. Default true. */
  defaultOpen?: boolean;
  /** Clase extra para el contenedor del aside. */
  className?: string;
  /**
   * Cualquier cambio de valor en este prop fuerza re-abrir el panel (incluso
   * si el usuario lo había colapsado). Útil para que el inspector se abra
   * cuando se selecciona un bloque distinto.
   */
  openSignal?: number | string;
};

export function CollapsibleAside({
  children,
  storageKey,
  side,
  widthOpen,
  defaultOpen = true,
  className,
  openSignal,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "0") setOpen(false);
      else if (stored === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, hydrated, storageKey]);

  // Force-open cuando cambia openSignal. No re-cierra si ya estaba abierto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo queremos triggear con openSignal, no con hydrated.
  useEffect(() => {
    if (openSignal === undefined) return;
    setOpen(true);
  }, [openSignal]);

  const PanelIcon = side === "left" ? PanelLeftClose : PanelRightClose;
  const ExpandIcon = side === "left" ? ChevronRight : ChevronLeft;

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-border/60 bg-background transition-[width] duration-200 ease-out",
        side === "left" ? "border-r" : "border-l",
        className,
      )}
      style={{ width: open ? widthOpen : "0px" }}
      aria-expanded={open}
    >
      {/* Toggle interno (visible cuando está abierto, dentro del header) */}
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-3 z-10 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            side === "left" ? "right-2" : "left-2",
          )}
          aria-label="Colapsar panel"
          title="Colapsar panel"
        >
          <PanelIcon className="size-4" />
        </button>
      ) : null}

      {/* Contenido scrollable cuando está abierto. Cuando está colapsado, oculto. */}
      <div
        className={cn(
          "flex-1 overflow-hidden transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {children}
      </div>

      {/* Botón flotante para re-expandir cuando está colapsado. Pegado al borde. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "absolute top-4 z-20 grid size-9 place-items-center rounded-r-lg border bg-background text-muted-foreground shadow-md transition-colors hover:bg-muted hover:text-foreground",
            side === "left"
              ? "left-0 rounded-l-none border-l-0"
              : "right-0 rounded-l-lg rounded-r-none border-r-0",
          )}
          aria-label="Expandir panel"
          title="Expandir panel"
        >
          <ExpandIcon className="size-4" />
        </button>
      ) : null}
    </aside>
  );
}
