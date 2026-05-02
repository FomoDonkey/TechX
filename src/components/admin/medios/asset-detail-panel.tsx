"use client";

import { deleteMediaAction, updateMediaAction } from "@/app/admin/medios/_actions";
import { regenerateAltAction, regenerateTagsAction } from "@/app/admin/medios/_ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AssetUsage } from "@/lib/asset-usage";
import type { MediaRow } from "@/lib/media-types";
import { mediaKind } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Calendar,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  asset: MediaRow;
  usages: AssetUsage[];
};

const TABS = [
  { id: "info", label: "Info" },
  { id: "crops", label: "Crops" },
  { id: "uses", label: "Usos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const RATIOS: Array<{ name: string; ratio: number }> = [
  { name: "1:1", ratio: 1 },
  { name: "16:9", ratio: 16 / 9 },
  { name: "4:3", ratio: 4 / 3 },
  { name: "9:16", ratio: 9 / 16 },
];

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FocalImage({
  url,
  focalX,
  focalY,
  setFocal,
  alt,
}: {
  url: string;
  focalX: number;
  focalY: number;
  setFocal: (x: number, y: number) => void;
  alt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFocal(Math.max(0, Math.min(100, Math.round(x))), Math.max(0, Math.min(100, Math.round(y))));
  }

  return (
    <div
      ref={ref}
      onMouseDown={(e) => {
        setDragging(true);
        pick(e);
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onMouseMove={(e) => {
        if (dragging) pick(e);
      }}
      className="relative cursor-crosshair overflow-hidden rounded-xl border bg-muted/30 select-none"
      style={{ aspectRatio: "16 / 10" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-full w-full object-contain" draggable={false} />
      <div
        className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ring-4 ring-primary/40"
        style={{
          left: `${focalX}%`,
          top: `${focalY}%`,
          backgroundColor: "rgba(255,255,255,0.4)",
        }}
      />
    </div>
  );
}

function CropPreviews({
  url,
  focalX,
  focalY,
}: {
  url: string;
  focalX: number;
  focalY: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {RATIOS.map((r) => (
        <div key={r.name} className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">{r.name}</div>
          <div
            className="overflow-hidden rounded-lg border bg-muted/30"
            style={{ aspectRatio: `${r.ratio}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AssetDetailPanel({ asset, usages }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("info");
  const [alt, setAlt] = useState(asset.alt ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [focalX, setFocalX] = useState(asset.focalX ?? 50);
  const [focalY, setFocalY] = useState(asset.focalY ?? 50);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(asset.tagsManual ?? []);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("asset");
    router.replace(`/admin/medios?${next.toString()}`, { scroll: false });
  }

  function setFocal(x: number, y: number) {
    if (x === focalX && y === focalY) return;
    setFocalX(x);
    setFocalY(y);
    setDirty(true);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
    setDirty(true);
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await updateMediaAction({
        id: asset.id,
        patch: {
          alt: alt.trim() || null,
          caption: caption.trim() || null,
          focalX,
          focalY,
          tagsManual: tags,
        },
      });
      if (res.ok) {
        toast.success("Guardado");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error guardando");
      }
    });
  }

  function doDelete() {
    if (!confirm(`¿Eliminar “${asset.filename ?? asset.id}”?`)) return;
    start(async () => {
      await deleteMediaAction([asset.id]);
      toast.success("Eliminado");
      close();
      router.refresh();
    });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  const url = asset.url;
  const kind = mediaKind(asset.mime);
  const tagsSuggested = (asset.aiTags ?? []).filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-2xl flex-col bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <Dialog.Title className="truncate font-display text-base font-semibold">
              {asset.filename ?? "Sin nombre"}
            </Dialog.Title>
            <div className="flex items-center gap-1">
              {dirty ? (
                <Button size="sm" onClick={save} disabled={pending} className="gap-1.5">
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Guardar
                </Button>
              ) : null}
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
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
                  {t.id === "uses" && usages.length > 0 ? (
                    <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">
                      {usages.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {tab === "info" ? (
              <>
                {kind === "image" ? (
                  <FocalImage
                    url={url}
                    focalX={focalX}
                    focalY={focalY}
                    setFocal={setFocal}
                    alt={alt}
                  />
                ) : (
                  <div className="grid place-items-center rounded-xl border bg-muted/30 p-12 text-muted-foreground">
                    <ImageIcon className="size-10" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Tipo" value={asset.mime} />
                  <Stat label="Tamaño" value={fmtBytes(asset.size)} />
                  <Stat
                    label="Dimensiones"
                    value={asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
                  />
                  <Stat
                    label="Color dominante"
                    value={
                      asset.dominantColor ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="size-4 rounded border"
                            style={{ backgroundColor: asset.dominantColor }}
                          />
                          {asset.dominantColor}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Stat label="Foco" value={`${focalX}% / ${focalY}%`} />
                  <Stat
                    label="Subido"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3" />
                        {new Date(asset.createdAt).toLocaleString("es")}
                      </span>
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Texto alternativo
                    </span>
                    {kind === "image" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await regenerateAltAction(asset.id);
                            if (r.ok) {
                              setAlt(r.alt);
                              setDirty(true);
                              toast.success("Alt sugerido");
                              router.refresh();
                            } else {
                              toast.error(r.error ?? "Error");
                            }
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
                      >
                        <Sparkles className="size-3" /> Sugerir con IA
                      </button>
                    ) : null}
                  </div>
                  <Textarea
                    value={alt}
                    onChange={(e) => {
                      setAlt(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Describe la imagen para SEO y accesibilidad…"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-muted-foreground">Caption</span>
                  <Textarea
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Pie de foto opcional"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-muted-foreground">Etiquetas</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-foreground"
                      >
                        <Tag className="size-2.5" />
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="rounded-full hover:bg-muted"
                          aria-label={`Quitar ${t}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="añadir y Enter…"
                      className="h-7 w-32 text-xs"
                    />
                  </div>
                  {tagsSuggested.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      <Sparkles className="mr-1 inline size-3 text-primary" />
                      Sugeridas:{" "}
                      {tagsSuggested.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="mr-1 rounded-full border px-1.5 py-0.5 hover:bg-muted"
                          onClick={() => {
                            setTags([...tags, t]);
                            setDirty(true);
                          }}
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {kind === "image" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await regenerateTagsAction(asset.id);
                          if (r.ok) {
                            toast.success("Etiquetas regeneradas");
                            router.refresh();
                          } else {
                            toast.error(r.error ?? "Error");
                          }
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
                    >
                      <Sparkles className="size-3" /> Regenerar etiquetas
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-muted-foreground">Acciones</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copy(url, "URL")}
                    >
                      <Copy className="size-3.5" /> URL
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copy(`![${alt || asset.filename || ""}](${url})`, "Markdown")}
                    >
                      <Copy className="size-3.5" /> Markdown
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        copy(
                          `<img src="${url}" alt="${alt || ""}" width="${asset.width}" height="${asset.height}" />`,
                          "HTML",
                        )
                      }
                    >
                      <Copy className="size-3.5" /> HTML
                    </Button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs hover:bg-muted"
                      download
                    >
                      <Download className="size-3.5" /> Descargar
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={doDelete}
                      disabled={pending}
                    >
                      <Trash2 className="size-3.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {tab === "crops" ? (
              <>
                {kind === "image" ? (
                  <>
                    <FocalImage
                      url={url}
                      focalX={focalX}
                      focalY={focalY}
                      setFocal={setFocal}
                      alt={alt}
                    />
                    <p className="text-xs text-muted-foreground">
                      Click & drag para mover el punto focal — los crops se actualizan en vivo.
                    </p>
                    <CropPreviews url={url} focalX={focalX} focalY={focalY} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Crops disponibles solo para imágenes.
                  </p>
                )}
              </>
            ) : null}

            {tab === "uses" ? (
              <>
                {usages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este archivo no se usa en ningún post.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {usages.map((u) => (
                      <li key={u.entryId} className="flex items-center justify-between p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{u.title}</div>
                          <div className="text-xs text-muted-foreground">
                            /blog/{u.slug} · {u.status}
                          </div>
                        </div>
                        <Link
                          href={`/admin/contenido/${u.entryId}`}
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                        >
                          <ExternalLink className="size-3" /> Editar
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}
