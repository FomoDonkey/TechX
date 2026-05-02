"use client";

import type { ThemeSpec } from "@/themes/types";
import { ArrowLeftRight, Check, Eye, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyThemeAction } from "./_actions";

interface GalleryProps {
  builtins: ThemeSpec[];
  customs: { id: string; spec: ThemeSpec; basedOn: string | null }[];
  activeSlug: string;
}

export function ThemeGallery({ builtins, customs, activeSlug }: GalleryProps) {
  const [active, setActive] = useState(activeSlug);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(slug: string) {
    startTransition(async () => {
      const res = await applyThemeAction({ slug });
      if (res.ok) {
        setActive(slug);
        toast.success("Tema aplicado");
      } else {
        toast.error(res.error);
      }
    });
  }

  const all: { spec: ThemeSpec; kind: "builtin" | "custom"; basedOn?: string | null }[] = [
    ...builtins.map((spec) => ({ spec, kind: "builtin" as const })),
    ...customs.map((c) => ({ spec: c.spec, kind: "custom" as const, basedOn: c.basedOn })),
  ];

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {all.map(({ spec, kind, basedOn }) => (
          <ThemeCard
            key={spec.slug}
            spec={spec}
            kind={kind}
            basedOn={basedOn ?? null}
            isActive={active === spec.slug}
            isPending={pending && active !== spec.slug}
            onApply={() => apply(spec.slug)}
            onPreview={() => setPreviewSlug(spec.slug)}
          />
        ))}
      </div>

      {previewSlug ? (
        <PreviewModal
          slug={previewSlug}
          spec={all.find((t) => t.spec.slug === previewSlug)?.spec}
          isActive={active === previewSlug}
          onClose={() => setPreviewSlug(null)}
          onApply={() => {
            apply(previewSlug);
            setPreviewSlug(null);
          }}
        />
      ) : null}
    </>
  );
}

function ThemeCard({
  spec,
  kind,
  basedOn,
  isActive,
  isPending,
  onApply,
  onPreview,
}: {
  spec: ThemeSpec;
  kind: "builtin" | "custom";
  basedOn: string | null;
  isActive: boolean;
  isPending: boolean;
  onApply: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card transition-all ${
        isActive
          ? "border-primary shadow-[0_0_0_3px] shadow-primary/15"
          : "border-border/60 hover:border-foreground/30"
      }`}
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: spec.preview.gradient }}
      >
        <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/30 text-2xl backdrop-blur-sm">
          {spec.preview.emoji}
        </span>
        {isActive ? (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            <Check className="size-3" /> Activo
          </span>
        ) : null}
        <div className="absolute bottom-3 left-4 right-4 grid grid-cols-5 gap-1.5">
          {Object.values(spec.tokens.colors.light)
            .slice(0, 5)
            .map((c, i) => (
              <span
                key={`l-${spec.slug}-${String(c)}-${i}`}
                className="h-2 rounded-full ring-1 ring-white/20"
                style={{ background: c }}
              />
            ))}
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{spec.name}</h3>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {spec.tagline}
            </p>
          </div>
          {kind === "custom" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
              Custom
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{spec.description}</p>
        {basedOn ? (
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Basado en {basedOn}
          </p>
        ) : null}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            <Eye className="size-3.5" /> Previsualizar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={isActive || isPending}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "cursor-default bg-muted text-muted-foreground"
                : "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
            }`}
          >
            {isActive ? (
              <>
                <Check className="size-3.5" /> Aplicado
              </>
            ) : isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Aplicando…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Aplicar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  slug,
  spec,
  isActive,
  onClose,
  onApply,
}: {
  slug: string;
  spec: ThemeSpec | undefined;
  isActive: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const w = device === "mobile" ? 390 : device === "tablet" ? 820 : 1280;
  const h = device === "mobile" ? 844 : device === "tablet" ? 1180 : 800;

  if (!spec) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{spec.preview.emoji}</span>
            <div>
              <h2 className="font-display text-lg font-semibold">{spec.name}</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {spec.tagline}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeviceTabs device={device} onChange={setDevice} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={isActive}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium ${
                isActive
                  ? "cursor-default bg-muted text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {isActive ? "Activo" : "Aplicar este tema"}
            </button>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/30 p-6">
          <div
            className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            style={{ width: w, height: h, maxWidth: "100%", maxHeight: "100%" }}
          >
            <iframe
              title={`Preview ${spec.name}`}
              src={`/api/admin/theme-preview?slug=${encodeURIComponent(slug)}`}
              className="h-full w-full border-0"
            />
          </div>
        </div>
        <footer className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftRight className="size-3.5" />
            Esta vista no toca el sitio público hasta que apliques.
          </span>
          <span className="text-xs">{spec.description}</span>
        </footer>
      </div>
    </div>
  );
}

function DeviceTabs({
  device,
  onChange,
}: {
  device: "mobile" | "tablet" | "desktop";
  onChange: (d: "mobile" | "tablet" | "desktop") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
      {(["mobile", "tablet", "desktop"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`rounded-md px-2.5 py-1 capitalize transition ${
            device === d
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {d === "mobile" ? "Móvil" : d === "tablet" ? "Tablet" : "Desktop"}
        </button>
      ))}
    </div>
  );
}
