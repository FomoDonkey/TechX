"use client";

import { useUploader } from "@/components/admin/uploader/upload-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ImagePlus,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PickerItem = {
  id: string;
  url: string;
  filename: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  focalX: number | null;
  focalY: number | null;
  variants: unknown;
};

export type InsertImagePayload = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  caption: string;
  size: "small" | "medium" | "large" | "full";
  align: "left" | "center" | "right" | "full";
};

const TABS = [
  { id: "recent", label: "Recientes" },
  { id: "upload", label: "Subir" },
  { id: "url", label: "URL" },
  { id: "ai", label: "Generar IA" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function thumbUrlOf(it: PickerItem): string {
  const v = it.variants as { sizes?: Record<string, Record<string, { url?: string }>> } | null;
  return v?.sizes?.thumb?.webp?.url ?? v?.sizes?.thumb?.avif?.url ?? it.url;
}

export function MediaPicker() {
  const { open: openUploader, enqueueUrl } = useUploader();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("recent");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PickerItem | null>(null);
  const [size, setSize] = useState<InsertImagePayload["size"]>("medium");
  const [align, setAlign] = useState<InsertImagePayload["align"]>("center");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  // Bridge: open from anywhere via custom event.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("csm:media-picker:open", onOpen);
    return () => window.removeEventListener("csm:media-picker:open", onOpen);
  }, []);

  // Fetch when opening or query changes.
  useEffect(() => {
    if (!open || tab !== "recent") return;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      const url = `/api/admin/media?type=image&limit=60${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .then((j: { items: PickerItem[] }) => setItems(j.items))
        .catch(() => null)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [open, q, tab]);

  function reset() {
    setSelected(null);
    setAlt("");
    setCaption("");
    setSize("medium");
    setAlign("center");
  }

  function close() {
    setOpen(false);
    reset();
  }

  function pick(it: PickerItem) {
    setSelected(it);
    setAlt(it.alt ?? "");
  }

  function insert() {
    if (!selected) return;
    const payload: InsertImagePayload = {
      src: selected.url,
      alt: alt.trim(),
      width: selected.width,
      height: selected.height,
      focalX: selected.focalX ?? 50,
      focalY: selected.focalY ?? 50,
      caption: caption.trim(),
      size,
      align,
    };
    window.dispatchEvent(new CustomEvent("csm:media-picker:insert", { detail: payload }));
    close();
  }

  async function submitUrl() {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput);
    } catch {
      toast.error("URL inválida");
      return;
    }
    setLoading(true);
    try {
      await enqueueUrl(urlInput.trim());
      toast.success("Descargando — aparecerá en Recientes");
      setUrlInput("");
      setTab("recent");
    } finally {
      setLoading(false);
    }
  }

  async function submitAi() {
    if (!aiPrompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success("Imagen generada — aparecerá en Recientes");
      setAiPrompt("");
      setTab("recent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generando");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] flex h-[80vh] w-[min(960px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <Dialog.Title className="font-display text-base font-semibold">
              Seleccionar imagen
            </Dialog.Title>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="border-b">
            <nav className="flex gap-4 px-5 text-sm">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "border-b-2 py-2.5 transition-colors",
                    tab === t.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              {tab === "recent" ? (
                <>
                  <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
                    <div className="flex flex-1 items-center rounded-lg border bg-card px-2">
                      <Search className="size-4 text-muted-foreground" />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar…"
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                      <div className="grid h-32 place-items-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : items.length === 0 ? (
                      <div className="grid h-32 place-items-center text-muted-foreground">
                        No hay imágenes. Sube alguna en la pestaña “Subir”.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                        {items.map((it) => (
                          <button
                            type="button"
                            key={it.id}
                            onClick={() => pick(it)}
                            className={cn(
                              "group relative aspect-square overflow-hidden rounded-md border bg-muted/30 transition-all",
                              selected?.id === it.id
                                ? "ring-2 ring-primary"
                                : "hover:ring-2 hover:ring-primary/40",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumbUrlOf(it)}
                              alt={it.alt ?? ""}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              style={{
                                objectPosition: `${it.focalX ?? 50}% ${it.focalY ?? 50}%`,
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {tab === "upload" ? (
                <div className="grid flex-1 place-items-center p-8">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10">
                      <Upload className="size-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Arrastra archivos a cualquier parte o usa el botón:
                    </p>
                    <Button onClick={openUploader} className="gap-1.5">
                      <Upload className="size-4" /> Elegir archivos
                    </Button>
                    <p className="text-xs text-muted-foreground">También puedes pegar con ⌘V.</p>
                  </div>
                </div>
              ) : null}

              {tab === "url" ? (
                <div className="space-y-3 p-6">
                  <span className="block text-xs font-medium text-muted-foreground">
                    URL pública de imagen
                  </span>
                  <div className="flex gap-2">
                    <div className="flex flex-1 items-center rounded-lg border bg-background px-2">
                      <Link2 className="size-4 text-muted-foreground" />
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://…"
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <Button onClick={submitUrl} disabled={loading || !urlInput.trim()}>
                      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Descargar
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === "ai" ? (
                <div className="space-y-3 p-6">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3 text-primary" />
                    Describe la imagen
                  </span>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Una taza de café sobre un escritorio de madera, luz cálida, fotografía cinemática"
                    rows={4}
                    className="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={submitAi}
                      disabled={loading || !aiPrompt.trim()}
                      className="gap-1.5"
                    >
                      {loading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Generar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sin clave de Replicate, se devuelve una imagen placeholder coherente con el
                    prompt.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Insertion panel */}
            <aside className="hidden w-72 shrink-0 border-l bg-background p-4 md:block">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Insertar
              </h3>
              {selected ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrlOf(selected)}
                      alt=""
                      className="h-32 w-full object-cover"
                      style={{
                        objectPosition: `${selected.focalX ?? 50}% ${selected.focalY ?? 50}%`,
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-muted-foreground">Alt</span>
                    <Input value={alt} onChange={(e) => setAlt(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Caption
                    </span>
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Tamaño
                    </span>
                    <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg border bg-card p-0.5 text-xs">
                      {(["small", "medium", "large", "full"] as const).map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setSize(s)}
                          className={cn(
                            "rounded-md py-1 capitalize",
                            size === s
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Alineación
                    </span>
                    <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg border bg-card p-0.5">
                      {(
                        [
                          { v: "left", I: AlignLeft },
                          { v: "center", I: AlignCenter },
                          { v: "right", I: AlignRight },
                          { v: "full", I: ImagePlus },
                        ] as const
                      ).map(({ v, I }) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setAlign(v)}
                          className={cn(
                            "grid place-items-center rounded-md py-1.5",
                            align === v
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                          aria-label={v}
                        >
                          <I className="size-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={insert} className="w-full">
                    Insertar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona una imagen.</p>
              )}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
