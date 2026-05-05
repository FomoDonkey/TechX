"use client";

import { savePageAction } from "@/app/admin/paginas/_actions";
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
import { CollapsibleAside } from "@/components/admin/collapsible-aside";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isEditableTarget } from "@/lib/dom";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Check,
  Eye,
  Home,
  Loader2,
  Monitor,
  Send,
  Settings2,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Status = "draft" | "published" | "archived";
type Seo = { title?: string; description?: string; ogImage?: string } | null;

type Props = {
  pageId: string;
  initialTitle: string;
  initialPath: string;
  initialStatus: Status;
  initialIsHome: boolean;
  initialLayout: BlockNode[];
  initialSeo: Seo;
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
  workspaceSlug: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function PageBuilder(props: Props) {
  const router = useRouter();
  const [layout, setLayout] = useState<BlockNode[]>(props.initialLayout);
  const [title, setTitle] = useState(props.initialTitle);
  const [path, setPath] = useState(props.initialPath);
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [isHome, setIsHome] = useState(props.initialIsHome);
  const [seo, setSeo] = useState<Seo>(props.initialSeo);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [, startTransition] = useTransition();
  const lastSentRef = useRef<string>("");
  const dirtyRef = useRef(false);

  // Build initial render context with media + symbols (won't update on add — refresh on save)
  const ctx: RenderContext = useMemo(() => {
    const mediaMap = new Map<string, ResolvedMedia>();
    for (const m of props.initialMediaIndex) mediaMap.set(m.id, m);
    // also add recentMedia so newly-picked images render in canvas before save
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

  // ----- handlers -----
  const addBlockAtRoot = useCallback((kind: string, index?: number) => {
    setLayout((l) => {
      const node = newBlockNode(kind);
      const i = typeof index === "number" ? index : l.length;
      const next = insertNode(l, null, i, node);
      // Schedule selection
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

  const handleSave = useCallback(
    async (overrides?: Partial<{ status: Status; isHome: boolean }>): Promise<boolean> => {
      // Cancela el timer pendiente de autosave si lo hay (evita doble save).
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const payloadInput = {
        id: props.pageId,
        title,
        path,
        layout: layout as never,
        seo,
        ...(overrides?.status ? { status: overrides.status } : {}),
        ...(typeof overrides?.isHome === "boolean" ? { isHome: overrides.isHome } : {}),
      };
      setSaveState("saving");
      const res = await savePageAction(payloadInput);
      if (res.ok) {
        lastSentRef.current = JSON.stringify({
          layout,
          title,
          path,
          seo,
          status: overrides?.status ?? status,
          isHome: overrides?.isHome ?? isHome,
        });
        dirtyRef.current = false;
        setSaveState("saved");
        if (res.path && res.path !== path) setPath(res.path);
        if (overrides?.status) setStatus(overrides.status);
        if (typeof overrides?.isHome === "boolean") setIsHome(overrides.isHome);
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
        return true;
      }
      setSaveState("error");
      toast.error(res.error);
      return false;
    },
    [layout, title, path, seo, status, isHome, props.pageId],
  );

  // Autosave debounced. Guarda el timer en ref para que handleSave imperativo
  // (⌘S, publicar) pueda cancelarlo y evitar doble save del mismo payload.
  useEffect(() => {
    const payload = JSON.stringify({ layout, title, path, seo, status, isHome });
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
  }, [layout, title, path, seo, status, isHome, handleSave]);

  // Beforeunload guard
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

  // Keyboard shortcuts
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
        e.preventDefault();
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, removeBlock, duplicateBlock, selectedId]);

  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  function publish() {
    setConfirmPublish(false);
    startTransition(async () => {
      const ok = await handleSave({ status: "published" });
      if (ok) {
        toast.success("Página publicada");
        // Refresh AFTER el save real completa, no antes (race fix).
        router.refresh();
      }
    });
  }

  function unpublish() {
    setConfirmUnpublish(false);
    startTransition(async () => {
      const ok = await handleSave({ status: "draft" });
      if (ok) toast.success("Vuelta a borrador");
    });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <NextLink
            href="/admin/paginas"
            className="grid size-8 place-items-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </NextLink>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted/40"
            >
              <span className="truncate text-sm font-semibold">{title || "Sin título"}</span>
              <Settings2 className="size-3.5 text-muted-foreground" />
            </button>
            <code className="block px-2 text-[11px] text-muted-foreground">{path}</code>
          </div>
        </div>

        {/* Breakpoint switcher */}
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

        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <NextLink
            href={encodeURI(path)}
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center gap-1.5 rounded-lg border px-3 text-xs hover:bg-muted md:inline-flex"
          >
            <Eye className="size-3.5" /> Ver
          </NextLink>
          {status === "published" ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmUnpublish(true)}>
              Despublicar
            </Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={() => setConfirmPublish(true)}>
              <Send className="size-3.5" /> Publicar
            </Button>
          )}
        </div>
      </header>

      {/* Body — flex con paneles colapsables. Cada CollapsibleAside persiste
          su estado en localStorage. Inspector solo aparece con bloque seleccionado. */}
      <div className="flex min-h-0 flex-1">
        <CollapsibleAside storageKey="csm:builder-palette" side="left" widthOpen="240px">
          <BlockPalette onAdd={(k) => addBlockAtRoot(k)} />
        </CollapsibleAside>
        <BuilderCanvas
          layout={layout}
          ctx={ctx}
          breakpoint={breakpoint}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDropNew={(kind, _parentId, index) => addBlockAtRoot(kind, index)}
          pageId={props.pageId}
        />
        {selectedNode ? (
          <CollapsibleAside
            storageKey="csm:builder-inspector"
            side="right"
            widthOpen="340px"
            openSignal={selectedNode.id}
          >
            <BuilderInspector
              node={selectedNode}
              symbols={props.symbols}
              recentMedia={props.recentMedia}
              onChange={(patch) => selectedNode && updateBlock(selectedNode.id, patch)}
              onClose={() => setSelectedId(null)}
              onDuplicate={() => selectedNode && duplicateBlock(selectedNode.id)}
              onDelete={() => selectedNode && removeBlock(selectedNode.id)}
            />
          </CollapsibleAside>
        ) : null}
      </div>

      {/* Settings dialog */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title={title}
        setTitle={setTitle}
        path={path}
        setPath={setPath}
        isHome={isHome}
        setIsHome={setIsHome}
        seo={seo}
        setSeo={setSeo}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="¿Publicar página?"
        description={
          <>
            Esta página estará accesible públicamente en{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{path}</code>.
          </>
        }
        confirmLabel="Publicar"
        onConfirm={publish}
      />

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="¿Despublicar página?"
        description="Dejará de ser accesible para visitantes (volverá a borrador). El contenido se conserva."
        confirmLabel="Despublicar"
        variant="destructive"
        onConfirm={unpublish}
      />
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

function SettingsDialog({
  open,
  onClose,
  title,
  setTitle,
  path,
  setPath,
  isHome,
  setIsHome,
  seo,
  setSeo,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  setTitle: (v: string) => void;
  path: string;
  setPath: (v: string) => void;
  isHome: boolean;
  setIsHome: (v: boolean) => void;
  seo: Seo;
  setSeo: (v: Seo) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 shadow-2xl">
          <Dialog.Title className="font-display text-lg font-semibold">
            Ajustes de la página
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Título, ruta, SEO y home.
          </Dialog.Description>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-title">Título</Label>
              <Input id="ps-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-path">Ruta</Label>
              <Input id="ps-path" value={path} onChange={(e) => setPath(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Empieza por /. Ej: <code>/sobre</code>
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Home className="size-4" />
                <div>
                  <div className="text-sm font-medium">Página principal</div>
                  <div className="text-xs text-muted-foreground">
                    Se sirve en la raíz del sitio /
                  </div>
                </div>
              </div>
              <Switch checked={isHome} onCheckedChange={setIsHome} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-seo-title">SEO Title</Label>
              <Input
                id="ps-seo-title"
                value={seo?.title ?? ""}
                onChange={(e) => setSeo({ ...(seo ?? {}), title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-seo-desc">SEO Description</Label>
              <Input
                id="ps-seo-desc"
                value={seo?.description ?? ""}
                onChange={(e) => setSeo({ ...(seo ?? {}), description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
