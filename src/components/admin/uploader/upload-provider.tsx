"use client";

import { Button } from "@/components/ui/button";
import { isEditableTarget } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  filename: string;
  size: number;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  folderId: string | null;
  abort?: () => void;
  /** Cuándo entró a estado terminal (done|error); usado para auto-clear. */
  finishedAt?: number;
};

const DONE_TTL_MS = 6_000;

type UploaderApi = {
  enqueueFiles: (files: FileList | File[], folderId?: string | null) => void;
  enqueueUrl: (url: string, folderId?: string | null) => Promise<void>;
  setActiveFolder: (folderId: string | null) => void;
  open: () => void;
};

const Ctx = createContext<UploaderApi | null>(null);

const MAX_PARALLEL = 3;

export function useUploader(): UploaderApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUploader fuera de UploadProvider");
  return ctx;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const folderRef = useRef<string | null>(null);

  const upload = useCallback(
    (item: QueueItem, file: File) => {
      const xhr = new XMLHttpRequest();
      const folderQs = item.folderId ? `?folder=${encodeURIComponent(item.folderId)}` : "";
      xhr.open("POST", `/api/uploads${folderQs}`);
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, progress: pct } : it)));
        }
      });
      xhr.onerror = () => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "error", error: "Error de red", finishedAt: Date.now() }
              : it,
          ),
        );
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "done", progress: 100, finishedAt: Date.now() }
                : it,
            ),
          );
          router.refresh();
        } else {
          let msg = `HTTP ${xhr.status}`;
          try {
            const j = JSON.parse(xhr.responseText) as { error?: string; results?: unknown[] };
            if (j.error) msg = j.error;
            else if (Array.isArray(j.results) && j.results[0]) {
              const first = j.results[0] as { ok: boolean; error?: string };
              if (!first.ok && first.error) msg = first.error;
            }
          } catch {
            /* ignore */
          }
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "error", error: msg, finishedAt: Date.now() }
                : it,
            ),
          );
        }
      };

      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "uploading", abort: () => xhr.abort(), progress: 0 }
            : it,
        ),
      );
    },
    [router],
  );

  // Process queue: keep MAX_PARALLEL uploads in flight.
  const queueRef = useRef<Map<string, File>>(new Map());
  useEffect(() => {
    const inFlight = items.filter((it) => it.status === "uploading").length;
    const slots = MAX_PARALLEL - inFlight;
    if (slots <= 0) return;
    const next = items.filter((it) => it.status === "queued").slice(0, slots);
    for (const item of next) {
      const file = queueRef.current.get(item.id);
      if (!file) continue;
      upload(item, file);
      queueRef.current.delete(item.id);
    }
  }, [items, upload]);

  const enqueueFiles = useCallback((files: FileList | File[], folderId?: string | null) => {
    const folder = folderId !== undefined ? folderId : folderRef.current;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const newItems: QueueItem[] = arr.map((f) => {
      const id = uid();
      queueRef.current.set(id, f);
      return {
        id,
        filename: f.name,
        size: f.size,
        status: "queued",
        progress: 0,
        folderId: folder ?? null,
      };
    });
    setItems((prev) => [...newItems, ...prev]);
    setCollapsed(false);
  }, []);

  const enqueueUrl = useCallback(
    async (url: string, folderId?: string | null) => {
      const folder = folderId !== undefined ? folderId : folderRef.current;
      const itemId = uid();
      const filename = url.split("/").filter(Boolean).pop()?.slice(0, 80) ?? "remoto";
      setItems((prev) => [
        {
          id: itemId,
          filename,
          size: 0,
          status: "uploading",
          progress: 5,
          folderId: folder ?? null,
        },
        ...prev,
      ]);
      try {
        const res = await fetch("/api/uploads/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, folderId: folder ?? null }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: "done", progress: 100, finishedAt: Date.now() }
              : it,
          ),
        );
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, status: "error", error: msg, finishedAt: Date.now() } : it,
          ),
        );
      }
    },
    [router],
  );

  const setActiveFolder = useCallback((folderId: string | null) => {
    folderRef.current = folderId;
  }, []);

  // ----- DOM listeners: drag-drop global + paste -----
  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
      dragCounter.current += 1;
      setDragActive(true);
    }
    function onDragLeave() {
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDragActive(false);
    }
    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      dragCounter.current = 0;
      setDragActive(false);
      if (!e.dataTransfer) return;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        e.preventDefault();
        enqueueFiles(files);
      }
    }
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      // Si el foco está en un input, textarea, select o contentEditable
      // (Tiptap), dejamos que ese widget maneje el paste — no robamos
      // imágenes pegadas dentro del editor.
      if (isEditableTarget(e.target)) return;
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        enqueueFiles(files);
        toast.success(`Pegado ${files.length} archivo(s) desde el portapapeles`);
      }
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [enqueueFiles]);

  // ----- file input opener -----
  const inputRef = useRef<HTMLInputElement>(null);
  const open = useCallback(() => inputRef.current?.click(), []);

  const api = useMemo<UploaderApi>(
    () => ({ enqueueFiles, enqueueUrl, setActiveFolder, open }),
    [enqueueFiles, enqueueUrl, setActiveFolder, open],
  );

  // Auto-purga items terminados (done) tras DONE_TTL_MS. Errores se quedan
  // hasta que el usuario los descarte manualmente con "Limpiar".
  useEffect(() => {
    const hasExpiringDone = items.some((it) => it.status === "done" && it.finishedAt);
    if (!hasExpiringDone) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setItems((prev) => {
        const next = prev.filter(
          (it) => !(it.status === "done" && it.finishedAt && now - it.finishedAt > DONE_TTL_MS),
        );
        return next.length === prev.length ? prev : next;
      });
    }, 1_000);
    return () => clearInterval(timer);
  }, [items]);

  const inFlightCount = items.filter((it) => it.status === "uploading").length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const visible = items;

  return (
    <Ctx.Provider value={api}>
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm,audio/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) enqueueFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {dragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 px-12 py-10 text-center shadow-2xl">
            <UploadCloud className="size-12 text-primary" />
            <p className="font-display text-2xl font-semibold">Suelta para subir</p>
            <p className="text-muted-foreground text-sm">
              Imágenes, vídeo, audio o PDF · máximo 50 MB
            </p>
          </div>
        </div>
      ) : null}

      {visible.length > 0 && !collapsed ? (
        <div className="fixed bottom-4 right-4 z-[90] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <UploadCloud className="size-4" />
              <span className="font-medium">
                {inFlightCount > 0 ? `Subiendo ${inFlightCount}…` : "Subidas"}
              </span>
              {doneCount > 0 ? (
                <span className="text-muted-foreground text-xs">· {doneCount} listas</span>
              ) : null}
              {errorCount > 0 ? (
                <span className="text-destructive text-xs">· {errorCount} error</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItems((prev) => prev.filter((it) => it.status === "uploading"))}
                className="h-7 px-2 text-xs"
              >
                Limpiar
              </Button>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {visible.slice(0, 12).map((it) => (
              <li key={it.id} className="border-b px-3 py-2 text-xs last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium" title={it.filename}>
                    {it.filename}
                  </span>
                  <span
                    className={cn(
                      "shrink-0",
                      it.status === "done" && "text-emerald-500",
                      it.status === "error" && "text-destructive",
                      it.status === "uploading" && "text-muted-foreground",
                    )}
                  >
                    {it.status === "done" ? (
                      <CheckCircle2 className="size-4" />
                    ) : it.status === "error" ? (
                      <XCircle className="size-4" />
                    ) : (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatBytes(it.size)}</span>
                  {it.status === "error" ? (
                    <span className="text-destructive">{it.error}</span>
                  ) : (
                    <span>{it.progress}%</span>
                  )}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all",
                      it.status === "error" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visible.length > 0 && collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-xl hover:bg-muted"
        >
          <UploadCloud className="size-3.5" />
          {inFlightCount > 0 ? `Subiendo ${inFlightCount}` : `${doneCount} listas`}
        </button>
      ) : null}
    </Ctx.Provider>
  );
}
