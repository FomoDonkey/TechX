"use client";

import type { ModerationThresholds } from "@/ai/moderation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveModerationThresholdsAction } from "./_actions";

type Props = {
  initial: ModerationThresholds;
  defaults: ModerationThresholds;
  isDefault: boolean;
};

export function ModerationForm({ initial, defaults, isDefault }: Props) {
  const [spam, setSpam] = useState(initial.spamThreshold);
  const [pending, setPending] = useState(initial.pendingThreshold);
  const [pendingTr, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = spam !== initial.spamThreshold || pending !== initial.pendingThreshold;
  const valid = pending < spam && pending >= 0 && spam <= 100;

  const labels = useMemo(() => zoneLabels(spam, pending), [spam, pending]);

  function reset() {
    setSpam(defaults.spamThreshold);
    setPending(defaults.pendingThreshold);
  }

  function save() {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const r = await saveModerationThresholdsAction({
        spamThreshold: spam,
        pendingThreshold: pending,
      });
      if (!r.ok) setError(r.error);
      else setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-medium">Umbrales de auto-clasificación</h2>
        <Badge variant={isDefault && !dirty ? "outline" : "default"}>
          {isDefault && !dirty ? "Por defecto" : "Personalizado"}
        </Badge>
      </div>

      <Slider
        label="Pending → Spam"
        value={spam}
        onChange={(v) => setSpam(Math.max(v, pending + 1))}
        description="Score por encima del cual el comentario se clasifica como spam y no entra en la cola humana."
      />

      <Slider
        label="Approved → Pending"
        value={pending}
        onChange={(v) => setPending(Math.min(v, spam - 1))}
        description="Score por encima del cual el comentario va a pending para revisión humana antes de publicarse."
      />

      <ZoneVisualizer spam={spam} pending={pending} />

      <div className="rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">Predicción con estos umbrales</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="inline-block w-20 font-mono">0..{pending - 1}</span> →{" "}
            <span className="text-emerald-600 dark:text-emerald-400">approved</span>{" "}
            <span className="text-muted-foreground/80">({labels.approved})</span>
          </li>
          <li>
            <span className="inline-block w-20 font-mono">
              {pending}..{spam - 1}
            </span>{" "}
            → <span className="text-amber-600 dark:text-amber-400">pending</span>{" "}
            <span className="text-muted-foreground/80">({labels.pending})</span>
          </li>
          <li>
            <span className="inline-block w-20 font-mono">{spam}..100</span> →{" "}
            <span className="text-rose-600 dark:text-rose-400">spam</span>{" "}
            <span className="text-muted-foreground/80">({labels.spam})</span>
          </li>
        </ul>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedAt && !dirty && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Guardado correctamente.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!dirty || !valid || pendingTr}>
          {pendingTr ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>Guardar</span>
        </Button>
        <Button variant="ghost" onClick={reset} disabled={pendingTr}>
          <RotateCcw className="size-4" />
          <span>Restaurar defaults</span>
        </Button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium" htmlFor={`slider-${label}`}>
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums">{value}</span>
      </div>
      <input
        id={`slider-${label}`}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ZoneVisualizer({ spam, pending }: { spam: number; pending: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-8 overflow-hidden rounded-md border">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500/30"
          style={{ width: `${pending}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-500/30"
          style={{ left: `${pending}%`, width: `${spam - pending}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-rose-500/30"
          style={{ width: `${100 - spam}%` }}
        />
        <div className="relative flex h-full items-center justify-between px-2 text-[10px] font-mono uppercase tracking-wide text-foreground/70">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

function zoneLabels(
  spam: number,
  pending: number,
): {
  approved: string;
  pending: string;
  spam: string;
} {
  const a = labelFor("approved", pending);
  const p = labelFor("pending", spam - pending);
  const s = labelFor("spam", 100 - spam);
  return { approved: a, pending: p, spam: s };
}

function labelFor(zone: "approved" | "pending" | "spam", width: number): string {
  if (width <= 0) return "rango vacío";
  if (zone === "approved") return width > 50 ? "permisivo" : width > 25 ? "moderado" : "estricto";
  if (zone === "spam") return width > 50 ? "agresivo" : width > 25 ? "balanced" : "indulgente";
  return width > 50 ? "amplia revisión" : width > 25 ? "moderado" : "minimo en cola";
}
