"use client";

import type { AbVariant } from "@/ab/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Copy,
  FlaskConical,
  Pause,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAbTestAction,
  deleteAbTestAction,
  setAbTestStatusAction,
  updateAbTestAction,
} from "./_actions";

type Status = "draft" | "running" | "paused" | "completed";

type TestVM = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: Status;
  target: "block" | "page";
  variants: AbVariant[];
  minSampleSize: number;
  winnerVariantId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  running: "En curso",
  paused: "Pausado",
  completed: "Completado",
};

const STATUS_TONE: Record<Status, string> = {
  draft: "border-violet-400/40 text-violet-200",
  running: "border-emerald-400/40 text-emerald-300",
  paused: "border-amber-400/40 text-amber-300",
  completed: "border-pink-400/40 text-pink-300",
};

export function AbTestsBoard({ tests }: { tests: TestVM[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="size-4" /> Nuevo test
        </Button>
      </div>
      {creating ? <CreateForm onClose={() => setCreating(false)} /> : null}
      {tests.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <FlaskConical className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Aún no tienes tests. Crea el primero para empezar a medir conversiones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <TestRow key={t.id} test={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TestRow({ test }: { test: TestVM }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showDelete, setShowDelete] = useState(false);

  function changeStatus(action: "start" | "pause" | "resume" | "complete") {
    start(async () => {
      const res = await setAbTestStatusAction({ id: test.id, action });
      if (!res.ok) alert(`Error: ${res.error}`);
      else router.refresh();
    });
  }
  function copyKey() {
    navigator.clipboard.writeText(test.key);
  }
  function onDelete() {
    start(async () => {
      const res = await deleteAbTestAction({ id: test.id });
      if (!res.ok) alert(`Error: ${res.error}`);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/ab-tests/${test.id}`}
              className="font-semibold tracking-tight hover:underline"
            >
              {test.name}
            </Link>
            <Badge variant="outline" className={cn("gap-1.5", STATUS_TONE[test.status])}>
              {test.status === "running" ? (
                <Play className="size-3" />
              ) : test.status === "paused" ? (
                <Pause className="size-3" />
              ) : test.status === "completed" ? (
                <Trophy className="size-3" />
              ) : (
                <Square className="size-3" />
              )}
              {STATUS_LABEL[test.status]}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {test.target}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{test.key}</code>
            <button
              type="button"
              onClick={copyKey}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Copiar key"
            >
              <Copy className="size-3" />
            </button>
            <span>·</span>
            <span>{test.variants.length} variants</span>
            <span>·</span>
            <span>min. {test.minSampleSize.toLocaleString("es-ES")} muestras</span>
          </div>
          {test.description ? (
            <p className="text-sm text-muted-foreground">{test.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {test.variants.map((v) => (
              <span
                key={v.id}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px]",
                  v.isControl
                    ? "border-violet-400/40 text-violet-200"
                    : "border-muted-foreground/30 text-muted-foreground",
                  test.winnerVariantId === v.id ? "ring-1 ring-pink-400/60" : "",
                )}
              >
                {v.label} <span className="opacity-60">· {v.weight}%</span>
                {v.isControl ? <span className="ml-1 opacity-70">(control)</span> : null}
                {test.winnerVariantId === v.id ? (
                  <span className="ml-1 text-pink-300">★</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {test.status === "draft" || test.status === "paused" ? (
            <Button
              variant="default"
              size="sm"
              disabled={pending}
              onClick={() => changeStatus(test.status === "draft" ? "start" : "resume")}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              {test.status === "draft" ? "Iniciar" : "Reanudar"}
            </Button>
          ) : null}
          {test.status === "running" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => changeStatus("pause")}
              className="gap-1.5"
            >
              <Pause className="size-3.5" /> Pausar
            </Button>
          ) : null}
          {test.status === "running" || test.status === "paused" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => changeStatus("complete")}
              className="gap-1.5"
            >
              <Trophy className="size-3.5" /> Cerrar
            </Button>
          ) : null}
          <Link href={`/admin/ab-tests/${test.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              Resultados <ArrowRight className="size-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDelete(true)}
            disabled={pending}
            aria-label="Eliminar test"
            className="text-muted-foreground hover:text-red-300"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={`Eliminar test "${test.name}"`}
        description="Se borrarán también todas las assignments y events. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={onDelete}
        pending={pending}
      />
    </div>
  );
}

type VariantSlot = AbVariant & { _slot: string };

function nextSlotId() {
  return Math.random().toString(36).slice(2, 10);
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<"block" | "page">("block");
  const [minSample, setMinSample] = useState(100);
  const [variants, setVariants] = useState<VariantSlot[]>([
    { _slot: nextSlotId(), id: "control", label: "Control", weight: 50, isControl: true },
    { _slot: nextSlotId(), id: "v1", label: "Variante A", weight: 50, isControl: false },
  ]);
  const [error, setError] = useState<string | null>(null);

  function autoKey(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function addVariant() {
    if (variants.length >= 8) return;
    const id = `v${variants.length}`;
    setVariants([
      ...variants,
      {
        _slot: nextSlotId(),
        id,
        label: `Variante ${variants.length}`,
        weight: 0,
        isControl: false,
      },
    ]);
  }

  function removeVariant(idx: number) {
    if (variants.length <= 2) return;
    const next = variants.filter((_, i) => i !== idx);
    if (!next.some((v) => v.isControl)) next[0]!.isControl = true;
    setVariants(rebalance(next));
  }

  function setIsControl(idx: number) {
    setVariants(variants.map((v, i) => ({ ...v, isControl: i === idx })));
  }

  function patchVariant(idx: number, patch: Partial<AbVariant>) {
    setVariants(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function rebalance(list: VariantSlot[]): VariantSlot[] {
    const each = Math.floor(100 / list.length);
    let rem = 100 - each * list.length;
    return list.map((v) => {
      const w = each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      return { ...v, weight: w };
    });
  }

  function distribute() {
    setVariants(rebalance(variants));
  }

  async function handleSubmit() {
    setError(null);
    const total = variants.reduce((s, v) => s + Number(v.weight ?? 0), 0);
    if (total !== 100) {
      setError(`Los pesos deben sumar 100 (ahora suman ${total}).`);
      return;
    }
    if (!key || !name) {
      setError("Key y nombre son obligatorios.");
      return;
    }
    start(async () => {
      const res = await createAbTestAction({
        key,
        name,
        description: description || null,
        target,
        variants: variants.map((v) => ({
          id: v.id,
          label: v.label,
          weight: Number(v.weight),
          isControl: v.isControl,
        })),
        minSampleSize: minSample,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card/40 p-5 shadow-lg shadow-violet-500/5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Nuevo A/B Test</h3>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ab-name">Nombre</Label>
          <Input
            id="ab-name"
            value={name}
            placeholder="Hero CTA: Empezar vs Comenzar"
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              if (!key) setKey(autoKey(v));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab-key">Key</Label>
          <Input
            id="ab-key"
            value={key}
            placeholder="hero-cta"
            onChange={(e) => setKey(autoKey(e.target.value))}
          />
          <p className="text-[11px] text-muted-foreground">
            Slug usado en el bloque <code>Variantes A/B</code>.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ab-desc">Descripción</Label>
          <Textarea
            id="ab-desc"
            value={description}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué hipótesis quieres validar"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={target === "block" ? "default" : "outline"}
              size="sm"
              onClick={() => setTarget("block")}
            >
              Bloque
            </Button>
            <Button
              type="button"
              variant={target === "page" ? "default" : "outline"}
              size="sm"
              onClick={() => setTarget("page")}
            >
              Página
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab-sample">Muestra mínima</Label>
          <Input
            id="ab-sample"
            type="number"
            min={10}
            max={1_000_000}
            value={minSample}
            onChange={(e) => setMinSample(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Variantes</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={distribute}
              disabled={pending}
            >
              Repartir parejo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariant}
              disabled={pending || variants.length >= 8}
            >
              <Plus className="mr-1 size-3.5" /> Añadir
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div
              key={v._slot}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border bg-background/40 p-2"
            >
              <Input
                className="col-span-3"
                value={v.id}
                onChange={(e) =>
                  patchVariant(i, {
                    id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, ""),
                  })
                }
                placeholder="id"
              />
              <Input
                className="col-span-4"
                value={v.label}
                onChange={(e) => patchVariant(i, { label: e.target.value })}
                placeholder="Etiqueta"
              />
              <div className="col-span-3 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={v.weight}
                  onChange={(e) => patchVariant(i, { weight: Number(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                onClick={() => setIsControl(i)}
                className={cn(
                  "col-span-1 inline-flex h-8 items-center justify-center rounded-md border text-xs",
                  v.isControl
                    ? "border-violet-400/60 bg-violet-500/10 text-violet-200"
                    : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/40",
                )}
                title="Marcar como control"
              >
                {v.isControl ? <Check className="size-3" /> : "—"}
              </button>
              <button
                type="button"
                onClick={() => removeVariant(i)}
                disabled={variants.length <= 2}
                className="col-span-1 inline-flex h-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-300 disabled:opacity-30"
                aria-label="Eliminar variante"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          Crear test
        </Button>
      </div>
    </div>
  );
}

// Suprime warning lint para Pencil (reservado para edit dialog futuro)
void Pencil;
void updateAbTestAction;
