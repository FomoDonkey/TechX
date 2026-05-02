"use client";

import { saveSymbolAction } from "@/app/admin/simbolos/_actions";
import { newBlockNode } from "@/blocks/registry";
import {
  type BlockNode,
  type Breakpoint,
  type RenderContext,
  type ResolvedMedia,
  cloneNodeWithNewIds,
  findNode,
  findParent,
  insertNode,
  removeNode,
  updateNode,
} from "@/blocks/types";
import { BuilderCanvas } from "@/components/admin/builder/canvas";
import { BuilderInspector } from "@/components/admin/builder/inspector";
import { BlockPalette } from "@/components/admin/builder/palette";
import { Input } from "@/components/ui/input";
import { isEditableTarget } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Loader2, Monitor, Smartphone, Tablet, X } from "lucide-react";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  symbolId: string;
  initialName: string;
  initialDescription: string | null;
  initialLayout: BlockNode[];
  initialMediaIndex: ResolvedMedia[];
  symbols: { id: string; name: string }[];
  recentMedia: {
    id: string;
    url: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    mime: string;
  }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function SymbolBuilder(props: Props) {
  const [layout, setLayout] = useState<BlockNode[]>(props.initialLayout);
  const [name, setName] = useState(props.initialName);
  const [description, setDescription] = useState(props.initialDescription ?? "");
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const lastSentRef = useRef<string>("");
  const dirtyRef = useRef(false);

  const ctx: RenderContext = useMemo(() => {
    const mediaMap = new Map<string, ResolvedMedia>();
    for (const m of props.initialMediaIndex) mediaMap.set(m.id, m);
    for (const m of props.recentMedia) {
      if (!mediaMap.has(m.id)) {
        mediaMap.set(m.id, {
          id: m.id,
          url: m.url,
          alt: m.alt,
          width: m.width,
          height: m.height,
          blurhash: null,
          focalX: 50,
          focalY: 50,
          mime: m.mime,
        });
      }
    }
    return { workspaceId: "", mediaMap, symbolMap: new Map() };
  }, [props.initialMediaIndex, props.recentMedia]);

  const selectedNode = useMemo(
    () => (selectedId ? findNode(layout, selectedId) : null),
    [layout, selectedId],
  );

  const addBlockAtRoot = useCallback((kind: string, index?: number) => {
    setLayout((l) => {
      const node = newBlockNode(kind);
      const i = typeof index === "number" ? index : l.length;
      const next = insertNode(l, null, i, node);
      queueMicrotask(() => setSelectedId(node.id));
      return next;
    });
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<BlockNode>) => {
    setLayout((l) => updateNode(l, id, (n) => ({ ...n, ...patch })));
  }, []);

  const removeBlock = useCallback(
    (id: string) => {
      setLayout((l) => removeNode(l, id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  const duplicateBlock = useCallback((id: string) => {
    setLayout((l) => {
      const node = findNode(l, id);
      if (!node) return l;
      const parent = findParent(l, id);
      const clone = cloneNodeWithNewIds(node);
      const next = insertNode(l, parent?.parent?.id ?? null, (parent?.index ?? 0) + 1, clone);
      queueMicrotask(() => setSelectedId(clone.id));
      return next;
    });
  }, []);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setSaveState("saving");
    const res = await saveSymbolAction({
      id: props.symbolId,
      name,
      description: description || null,
      layout: layout as never,
    });
    if (res.ok) {
      lastSentRef.current = JSON.stringify({ layout, name, description });
      dirtyRef.current = false;
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      return true;
    }
    setSaveState("error");
    toast.error(res.error);
    return false;
  }, [layout, name, description, props.symbolId]);

  useEffect(() => {
    const payload = JSON.stringify({ layout, name, description });
    if (lastSentRef.current === "") {
      lastSentRef.current = payload;
      return;
    }
    if (payload === lastSentRef.current) return;
    dirtyRef.current = true;
    setSaveState("saving");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      startTransition(() => {
        void handleSave();
      });
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [layout, name, description, handleSave]);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        startTransition(() => {
          void handleSave();
        });
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeBlock(selectedId);
      } else if (meta && e.key === "d" && selectedId) {
        e.preventDefault();
        duplicateBlock(selectedId);
      } else if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, removeBlock, duplicateBlock, selectedId]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <NextLink
            href="/admin/simbolos"
            className="grid size-8 place-items-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </NextLink>
          <div className="min-w-0 flex-1 max-w-md">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 border-none bg-transparent px-2 text-base font-semibold focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          <BPButton
            current={breakpoint}
            value="desktop"
            set={setBreakpoint}
            icon={<Monitor className="size-3.5" />}
          />
          <BPButton
            current={breakpoint}
            value="tablet"
            set={setBreakpoint}
            icon={<Tablet className="size-3.5" />}
          />
          <BPButton
            current={breakpoint}
            value="mobile"
            set={setBreakpoint}
            icon={<Smartphone className="size-3.5" />}
          />
        </div>
        <SaveIndicator state={saveState} />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px]">
        <BlockPalette onAdd={(k) => addBlockAtRoot(k)} />
        <BuilderCanvas
          layout={layout}
          ctx={ctx}
          breakpoint={breakpoint}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDropNew={(kind, _parentId, index) => addBlockAtRoot(kind, index)}
        />
        <BuilderInspector
          node={selectedNode}
          symbols={props.symbols}
          recentMedia={props.recentMedia}
          onChange={(patch) => selectedNode && updateBlock(selectedNode.id, patch)}
          onClose={() => setSelectedId(null)}
          onDuplicate={() => selectedNode && duplicateBlock(selectedNode.id)}
          onDelete={() => selectedNode && removeBlock(selectedNode.id)}
        />
      </div>
    </div>
  );
}

function BPButton({
  current,
  value,
  set,
  icon,
}: {
  current: Breakpoint;
  value: Breakpoint;
  set: (v: Breakpoint) => void;
  icon: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => set(value)}
      title={value}
      className={cn(
        "flex h-7 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        state === "saving"
          ? "border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300"
          : state === "saved"
            ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
            : state === "error"
              ? "border-destructive/30 bg-destructive/8 text-destructive"
              : "border-border text-muted-foreground",
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3 animate-spin" /> Guardando…
        </>
      ) : state === "saved" ? (
        <>
          <Check className="size-3" /> Guardado
        </>
      ) : state === "error" ? (
        <>
          <X className="size-3" /> Error
        </>
      ) : (
        <>Listo</>
      )}
    </div>
  );
}
