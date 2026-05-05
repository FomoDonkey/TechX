"use client";

import type { BranchProtectionConfig } from "@/branches/protection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setBranchProtectionAction } from "../../_actions";

const DEFAULTS: BranchProtectionConfig = {
  requireReviewers: 0,
  requireApprovers: 0,
  requireCommentsResolved: false,
  requireStatusApproved: false,
};

export function ProtectionForm({
  branchId,
  initial,
}: {
  branchId: string;
  initial: BranchProtectionConfig;
}) {
  const [config, setConfig] = useState<BranchProtectionConfig>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isDefault =
    config.requireReviewers === 0 &&
    config.requireApprovers === 0 &&
    !config.requireCommentsResolved &&
    !config.requireStatusApproved;

  const dirty =
    config.requireReviewers !== initial.requireReviewers ||
    config.requireApprovers !== initial.requireApprovers ||
    config.requireCommentsResolved !== initial.requireCommentsResolved ||
    config.requireStatusApproved !== initial.requireStatusApproved;

  function update<K extends keyof BranchProtectionConfig>(
    key: K,
    value: BranchProtectionConfig[K],
  ) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function save(payload: BranchProtectionConfig | null) {
    setError(null);
    start(async () => {
      const r = await setBranchProtectionAction({ branchId, config: payload });
      if (!r.ok) setError(r.error);
      else {
        setSavedAt(Date.now());
        if (payload === null) setConfig(DEFAULTS);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-medium">Reglas de protección</h2>
        <Badge variant={isDefault ? "outline" : "default"}>
          {isDefault ? "Sin reglas" : "Personalizado"}
        </Badge>
      </div>

      <div className="space-y-5">
        <NumberRule
          label="Reviewers requeridos"
          description="Cantidad mínima de usuarios distintos asignados como reviewer en alguna entry de la branch."
          value={config.requireReviewers}
          onChange={(v) => update("requireReviewers", v)}
        />
        <NumberRule
          label="Approvers requeridos"
          description="Cantidad mínima de usuarios distintos asignados como approver."
          value={config.requireApprovers}
          onChange={(v) => update("requireApprovers", v)}
        />
        <BoolRule
          label="Comentarios resueltos"
          description="Todos los comentarios de la branch deben estar en estado resolved."
          value={config.requireCommentsResolved}
          onChange={(v) => update("requireCommentsResolved", v)}
        />
        <BoolRule
          label="Status aprobado"
          description="Todas las entries de la branch deben estar en approved, scheduled o published (no draft/review)."
          value={config.requireStatusApproved}
          onChange={(v) => update("requireStatusApproved", v)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedAt && !dirty && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Guardado correctamente.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(config)} disabled={!dirty || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>Guardar reglas</span>
        </Button>
        <Button variant="ghost" disabled={pending || isDefault} onClick={() => save(null)}>
          <Trash2 className="size-4" />
          <span>Quitar todas</span>
        </Button>
      </div>
    </div>
  );
}

function NumberRule({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`rule-${label}`} className="text-sm font-medium">
          {label}
        </label>
        <input
          id={`rule-${label}`}
          type="number"
          min={0}
          max={10}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(10, Number(e.target.value))))}
          className="h-8 w-16 rounded-md border bg-background px-2 text-right font-mono text-sm tabular-nums"
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function BoolRule({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-primary"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
