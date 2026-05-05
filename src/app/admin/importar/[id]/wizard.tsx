"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImportItem, ImportRow } from "@/db/schema";
import type {
  DescribeResult,
  ImportProgressEvent,
  ImportStats,
  MappingTarget,
} from "@/imports/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CollectionLite = { id: string; name: string; slug: string };

const TARGETS: Array<{ value: MappingTarget; label: string }> = [
  { value: "title", label: "Título" },
  { value: "slug", label: "Slug" },
  { value: "body", label: "Cuerpo" },
  { value: "excerpt", label: "Resumen" },
  { value: "publishedAt", label: "Fecha" },
  { value: "status", label: "Estado" },
  { value: "tags", label: "Tags" },
  { value: "categories", label: "Categorías" },
  { value: "cover", label: "Cover" },
  { value: "author", label: "Autor" },
  { value: "skip", label: "Ignorar" },
];

type Step = 1 | 2 | 3 | 4;

export function Wizard({
  initialRow,
  describe,
  collections,
  items,
}: {
  initialRow: ImportRow;
  describe: DescribeResult | null;
  collections: CollectionLite[];
  items: ImportItem[];
}) {
  const router = useRouter();
  const [row, setRow] = useState(initialRow);
  const [step, setStep] = useState<Step>(() => {
    if (
      initialRow.status === "completed" ||
      initialRow.status === "running" ||
      initialRow.status === "reverted"
    )
      return 4;
    if (initialRow.mapping) return 3;
    return 2;
  });
  const [savingMapping, setSavingMapping] = useState(false);
  const [running, setRunning] = useState(initialRow.status === "running");
  const [stats, setStats] = useState<ImportStats>(
    (initialRow.stats as ImportStats | null) ?? {
      detected: describe?.totalItems ?? 0,
      planned: describe?.totalItems ?? 0,
      imported: 0,
      skipped: 0,
      errored: 0,
      mediaPlanned: 0,
      mediaImported: 0,
    },
  );
  const [recentEvents, setRecentEvents] = useState<
    Array<{ status: string; title: string; at: number }>
  >([]);

  const initialMapping = (row.mapping ?? null) as {
    collectionId: string;
    defaultLocale?: string;
    defaultStatus?: "draft" | "published";
    fields?: Record<string, string>;
    createRedirects?: boolean;
    autoCreateTerms?: boolean;
  } | null;

  const [collectionId, setCollectionId] = useState(
    initialMapping?.collectionId ??
      collections.find((c) => c.slug === "posts")?.id ??
      collections[0]?.id ??
      "",
  );
  const [defaultStatus, setDefaultStatus] = useState<"draft" | "published">(
    initialMapping?.defaultStatus ?? "draft",
  );
  const [createRedirects, setCreateRedirects] = useState(initialMapping?.createRedirects ?? true);
  const [mediaPolicy, setMediaPolicy] = useState<"download" | "link" | "skip">(row.mediaPolicy);
  const [fieldMap, setFieldMap] = useState<Record<string, MappingTarget>>(() => {
    const base: Record<string, MappingTarget> = {};
    if (describe) {
      for (const f of describe.fields) base[f.key] = "skip";
      Object.assign(base, describe.suggested);
    }
    if (initialMapping?.fields) {
      Object.assign(base, initialMapping.fields as Record<string, MappingTarget>);
    }
    return base;
  });

  async function saveMapping(opts: { advance: boolean }) {
    setSavingMapping(true);
    try {
      const res = await fetch(`/api/admin/imports/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mapping: {
            collectionId,
            defaultLocale: "es",
            defaultStatus,
            fields: fieldMap,
            createRedirects,
          },
          mediaPolicy,
          status: "ready",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar");
        return;
      }
      setRow(data.row);
      if (opts.advance) setStep(3);
    } finally {
      setSavingMapping(false);
    }
  }

  async function runImport(dryRun: boolean) {
    if (!collectionId) {
      toast.error("Elige una colección destino");
      return;
    }
    await saveMapping({ advance: false });
    setRunning(true);
    setStep(4);
    setRecentEvents([]);
    try {
      const res = await fetch(`/api/admin/imports/${row.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo arrancar");
        setRunning(false);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
      setRunning(false);
    }
  }

  // SSE subscription cuando está running
  useEffect(() => {
    if (!running && step !== 4) return;
    const es = new EventSource(`/api/admin/imports/${row.id}/stream`);
    es.addEventListener("stats", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as ImportProgressEvent;
        if (ev.type === "stats") setStats(ev.stats);
      } catch {}
    });
    es.addEventListener("item", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as ImportProgressEvent;
        if (ev.type === "item") {
          setRecentEvents((prev) =>
            [{ status: ev.status, title: ev.title ?? ev.kind, at: Date.now() }, ...prev].slice(
              0,
              50,
            ),
          );
        }
      } catch {}
    });
    es.addEventListener("complete", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as ImportProgressEvent;
        if (ev.type === "complete") {
          setStats(ev.stats);
          setRunning(false);
          es.close();
          toast.success("Import finalizado");
          router.refresh();
        }
      } catch {}
    });
    es.addEventListener("error", () => {
      // browser auto-reconnects; no toast spam
    });
    return () => es.close();
  }, [running, step, row.id, router]);

  async function revert() {
    if (!confirm("¿Revertir este import? Borrará todas las entries que creó.")) return;
    const res = await fetch(`/api/admin/imports/${row.id}/revert`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo revertir");
      return;
    }
    toast.success(`Eliminadas ${data.deleted} entries`);
    router.refresh();
  }

  async function deleteImport() {
    if (!confirm("¿Eliminar este import? El archivo se borrará pero las entries persistirán."))
      return;
    const res = await fetch(`/api/admin/imports/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Import borrado");
    router.push("/admin/importar");
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} status={row.status} />

      {step === 2 ? (
        <Step2Mapping
          describe={describe}
          collections={collections}
          collectionId={collectionId}
          setCollectionId={setCollectionId}
          defaultStatus={defaultStatus}
          setDefaultStatus={setDefaultStatus}
          createRedirects={createRedirects}
          setCreateRedirects={setCreateRedirects}
          mediaPolicy={mediaPolicy}
          setMediaPolicy={setMediaPolicy}
          fieldMap={fieldMap}
          setFieldMap={setFieldMap}
          onContinue={() => saveMapping({ advance: true })}
          saving={savingMapping}
        />
      ) : null}

      {step === 3 ? (
        <Step3Preview
          describe={describe}
          onBack={() => setStep(2)}
          onDryRun={() => runImport(true)}
          onApply={() => runImport(false)}
        />
      ) : null}

      {step === 4 ? (
        <Step4Run
          row={row}
          stats={stats}
          running={running}
          recentEvents={recentEvents}
          items={items}
          onRevert={revert}
          onDelete={deleteImport}
          onApplyAfterDryRun={() => runImport(false)}
        />
      ) : null}
    </div>
  );
}

function Stepper({ step, status }: { step: Step; status: string }) {
  const steps = [
    { n: 1, label: "Subir" },
    { n: 2, label: "Mapear" },
    { n: 3, label: "Preview" },
    {
      n: 4,
      label: status === "completed" ? "Completo" : status === "running" ? "Ejecutando" : "Ejecutar",
    },
  ];
  return (
    <ol className="flex items-center gap-1 text-xs">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <li key={s.n} className="flex items-center gap-1">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[10px] font-medium",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                    : "border-border/60 text-muted-foreground",
              )}
            >
              {done ? "✓" : s.n}
            </span>
            <span className={cn(active ? "text-foreground font-medium" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <ChevronRight className="size-3 text-muted-foreground" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Step2Mapping(props: {
  describe: DescribeResult | null;
  collections: CollectionLite[];
  collectionId: string;
  setCollectionId: (id: string) => void;
  defaultStatus: "draft" | "published";
  setDefaultStatus: (s: "draft" | "published") => void;
  createRedirects: boolean;
  setCreateRedirects: (b: boolean) => void;
  mediaPolicy: "download" | "link" | "skip";
  setMediaPolicy: (p: "download" | "link" | "skip") => void;
  fieldMap: Record<string, MappingTarget>;
  setFieldMap: (fn: (prev: Record<string, MappingTarget>) => Record<string, MappingTarget>) => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const detected = props.describe?.totalItems ?? 0;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card/30 p-5">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium">{detected}</span>
          <span className="text-muted-foreground">items detectados</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Colección destino</Label>
          <select
            value={props.collectionId}
            onChange={(e) => props.setCollectionId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {props.collections.length === 0 ? <option value="">— sin colecciones —</option> : null}
            {props.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Estado por defecto</Label>
          <div className="flex gap-2">
            {(["draft", "published"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => props.setDefaultStatus(s)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm",
                  props.defaultStatus === s
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border",
                )}
              >
                {s === "draft" ? "Borrador" : "Publicado"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Imágenes en el cuerpo</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["link", "download", "skip"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => props.setMediaPolicy(p)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-xs",
                  props.mediaPolicy === p
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border",
                )}
              >
                <div className="font-medium">
                  {p === "link" ? "Linkear" : p === "download" ? "Re-hospedar" : "Quitar"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p === "link"
                    ? "Mantiene la URL original (rápido, depende del origen)"
                    : p === "download"
                      ? "Descarga + sube a tu Media Library (lento, persistente)"
                      : "Borra todas las imágenes del cuerpo"}
                </div>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 sm:col-span-2 text-sm">
          <input
            type="checkbox"
            checked={props.createRedirects}
            onChange={(e) => props.setCreateRedirects(e.target.checked)}
            className="size-4"
          />
          <span>
            Crear redirects 301 desde URLs originales hacia las nuevas (recomendado para SEO)
          </span>
        </label>
      </div>

      {props.describe ? (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em]">Mapeo de campos</Label>
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Campo de origen</th>
                  <th className="p-3 text-left">Ejemplo</th>
                  <th className="p-3 text-left">→ Mapear a</th>
                </tr>
              </thead>
              <tbody>
                {props.describe.fields.map((f) => (
                  <tr key={f.key} className="border-t">
                    <td className="p-3 font-medium">{f.label || f.key}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {f.example ? (
                        <code className="rounded bg-muted px-1.5 py-0.5">{f.example}</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={props.fieldMap[f.key] ?? "skip"}
                        onChange={(e) =>
                          props.setFieldMap((prev) => ({
                            ...prev,
                            [f.key]: e.target.value as MappingTarget,
                          }))
                        }
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                      >
                        {TARGETS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mb-2 inline size-4 text-amber-600" /> No se pudo describir el
          archivo. El parser probablemente no reconoce el formato. Verifica el tipo y vuelve a
          subir.
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          onClick={props.onContinue}
          disabled={props.saving || !props.collectionId}
          className="gap-2"
        >
          {props.saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Continuar al preview
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Step3Preview(props: {
  describe: DescribeResult | null;
  onBack: () => void;
  onDryRun: () => void;
  onApply: () => void;
}) {
  const sample = props.describe?.sample ?? [];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-[0.18em]">
          Preview de las primeras entries
        </Label>
        {sample.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin sample — el archivo puede estar vacío o no compatible.
          </p>
        ) : (
          <ul className="space-y-3">
            {sample.map((s, i) => (
              <li key={`${s.sourceId ?? i}`} className="rounded-2xl border bg-card/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{s.title ?? "(sin título)"}</h3>
                  {s.slug ? (
                    <Badge variant="outline" className="text-[10px]">
                      /{s.slug}
                    </Badge>
                  ) : null}
                  {s.status ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {s.status}
                    </Badge>
                  ) : null}
                  {s.publishedAt ? (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(s.publishedAt).toLocaleDateString("es-ES")}
                    </span>
                  ) : null}
                </div>
                {s.excerpt ? (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.excerpt}</p>
                ) : null}
                {s.content ? (
                  <pre className="mt-2 max-h-32 overflow-hidden rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground line-clamp-6">
                    {s.content.slice(0, 500)}
                    {s.content.length > 500 ? "…" : ""}
                  </pre>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(s.tags ?? []).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      #{t}
                    </Badge>
                  ))}
                  {(s.categories ?? []).map((c) => (
                    <Badge key={c} className="bg-primary/15 text-primary text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button variant="ghost" onClick={props.onBack} className="gap-2">
          <ChevronLeft className="size-4" /> Volver al mapeo
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={props.onDryRun} className="gap-2">
            <Play className="size-4" /> Dry-run (sin escribir)
          </Button>
          <Button onClick={props.onApply} className="gap-2">
            <Play className="size-4" /> Importar de verdad
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step4Run(props: {
  row: ImportRow;
  stats: ImportStats;
  running: boolean;
  recentEvents: Array<{ status: string; title: string; at: number }>;
  items: ImportItem[];
  onRevert: () => void;
  onDelete: () => void;
  onApplyAfterDryRun: () => void;
}) {
  const total = Math.max(props.stats.detected, props.stats.imported + props.stats.errored);
  const pct =
    total > 0 ? Math.round(((props.stats.imported + props.stats.errored) / total) * 100) : 0;
  const isDone =
    !props.running && (props.row.status === "completed" || props.row.status === "failed");
  const isReverted = props.row.status === "reverted";

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border bg-card/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {props.running ? (
              <>
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Ejecutando…</span>
              </>
            ) : props.row.dryRun && props.row.status === "completed" ? (
              <>
                <CheckCircle2 className="size-4 text-blue-500" />
                <span>Dry-run completado</span>
              </>
            ) : props.row.status === "completed" ? (
              <>
                <CheckCircle2 className="size-4 text-green-500" />
                <span>Import completado</span>
              </>
            ) : props.row.status === "failed" ? (
              <>
                <XCircle className="size-4 text-red-500" />
                <span>Falló</span>
              </>
            ) : isReverted ? (
              <>
                <RotateCcw className="size-4 text-muted-foreground" />
                <span>Revertido</span>
              </>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 text-xs">
          <Stat label="Detectados" value={props.stats.detected} />
          <Stat label="Importados" value={props.stats.imported} tone="green" />
          <Stat label="Errores" value={props.stats.errored} tone="red" />
          <Stat label="Media planeada" value={props.stats.mediaPlanned} />
          <Stat label="Media subida" value={props.stats.mediaImported} tone="blue" />
        </div>
      </div>

      {props.recentEvents.length > 0 ? (
        <div className="space-y-2 rounded-2xl border bg-card/30 p-4">
          <Label className="text-xs uppercase tracking-[0.18em]">Eventos recientes</Label>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {props.recentEvents.map((e) => (
              <li key={`${e.at}-${e.title}`} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-1.5 rounded-full",
                    e.status === "imported"
                      ? "bg-green-500"
                      : e.status === "failed"
                        ? "bg-red-500"
                        : "bg-muted-foreground",
                  )}
                />
                <span className="truncate">{e.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isDone || isReverted ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={props.onDelete} className="gap-2">
            <Trash2 className="size-4" /> Borrar lote
          </Button>
          <div className="flex gap-2">
            {props.row.dryRun && props.row.status === "completed" ? (
              <Button onClick={props.onApplyAfterDryRun} className="gap-2">
                <Play className="size-4" /> Importar de verdad
              </Button>
            ) : null}
            {!props.row.dryRun && props.row.status === "completed" && !isReverted ? (
              <Button variant="outline" onClick={props.onRevert} className="gap-2">
                <RotateCcw className="size-4" /> Revertir
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: { label: string; value: number; tone?: "green" | "red" | "blue" }) {
  const color =
    tone === "green"
      ? "text-green-700 dark:text-green-400"
      : tone === "red"
        ? "text-red-700 dark:text-red-400"
        : tone === "blue"
          ? "text-blue-700 dark:text-blue-400"
          : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/30 p-2 text-center">
      <div className={cn("text-base font-semibold", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
