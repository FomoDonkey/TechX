"use client";

import type { AiBudgetConfig } from "@/ai/usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAiBudgetAction } from "./_actions";

export function BudgetForm({
  initial,
  isDefault,
}: {
  initial: AiBudgetConfig;
  isDefault: boolean;
}) {
  const [budgetUsd, setBudgetUsd] = useState(initial.monthlyBudgetMicros / 1_000_000);
  const [alertPct, setAlertPct] = useState(Math.round(initial.alertAtPct * 100));
  const [hardBlock, setHardBlock] = useState(initial.hardBlock);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    budgetUsd * 1_000_000 !== initial.monthlyBudgetMicros ||
    alertPct / 100 !== initial.alertAtPct ||
    hardBlock !== initial.hardBlock;

  function save() {
    setError(null);
    start(async () => {
      const r = await saveAiBudgetAction({
        monthlyBudgetMicros: Math.floor(budgetUsd * 1_000_000),
        alertAtPct: alertPct / 100,
        hardBlock,
      });
      if (!r.ok) setError(r.error);
      else setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-medium">Presupuesto mensual</h2>
        <Badge variant={isDefault && !dirty ? "outline" : "default"}>
          {isDefault && !dirty ? "Por defecto" : "Personalizado"}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="budget" className="text-sm font-medium">
              Budget mensual (USD)
            </label>
            <span className="font-mono text-sm tabular-nums">
              {budgetUsd === 0 ? "Ilimitado" : `${budgetUsd.toFixed(2)} USD`}
            </span>
          </div>
          <input
            id="budget"
            type="number"
            min={0}
            max={1000}
            step={0.5}
            value={budgetUsd}
            onChange={(e) => setBudgetUsd(Math.max(0, Number(e.target.value) || 0))}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            0 = ilimitado (sólo aplican los caps por usuario). Default: 1 USD.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="alert" className="text-sm font-medium">
              Avisar al alcanzar
            </label>
            <span className="font-mono text-sm tabular-nums">{alertPct}%</span>
          </div>
          <input
            id="alert"
            type="range"
            min={0}
            max={100}
            step={5}
            value={alertPct}
            onChange={(e) => setAlertPct(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            Cuando el consumo del mes alcance este % se mostrará un aviso (no bloquea).
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
          <input
            type="checkbox"
            checked={hardBlock}
            onChange={(e) => setHardBlock(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Bloquear duro al 100%</p>
            <p className="text-xs text-muted-foreground">
              Cuando se alcance el budget, las llamadas a IA devuelven 429 hasta el próximo mes. Si
              está desactivado, sólo se muestra aviso pero las calls siguen ejecutándose.
            </p>
          </div>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedAt && !dirty && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Guardado correctamente.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>Guardar presupuesto</span>
        </Button>
      </div>
    </div>
  );
}
