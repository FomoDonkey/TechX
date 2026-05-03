"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Segment } from "@/db/schema";
import {
  FIELD_LABELS,
  OP_LABELS,
  SEGMENT_FIELDS,
  SEGMENT_OPS,
  type SegmentField,
  type SegmentOp,
  type SegmentRulesPayload,
} from "@/newsletter/segments";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createSegmentAction,
  deleteSegmentAction,
  previewSegmentAction,
  updateSegmentAction,
} from "./_actions";

type ConditionRow = { field: SegmentField; op: SegmentOp; value: string };

export function SegmentEditor({ segment }: { segment?: Segment }) {
  const router = useRouter();
  const [name, setName] = useState(segment?.name ?? "");
  const [combinator, setCombinator] = useState<"all" | "any">(() => {
    const r = segment?.rules as Record<string, unknown> | undefined;
    if (r && "any" in r) return "any";
    return "all";
  });
  const [conditions, setConditions] = useState<ConditionRow[]>(() =>
    loadConditions(segment?.rules),
  );
  const [preview, setPreview] = useState<{ matched: number; total: number } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Live preview con debounce 600ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const rules = buildRules(combinator, conditions);
      startPreview(async () => {
        const result = await previewSegmentAction({ rules });
        if (result.ok) setPreview({ matched: result.matched, total: result.total });
      });
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [combinator, conditions]);

  function addCondition() {
    setConditions([...conditions, { field: "status", op: "eq", value: "active" }]);
  }
  function updateCondition(idx: number, patch: Partial<ConditionRow>) {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeCondition(idx: number) {
    setConditions(conditions.filter((_, i) => i !== idx));
  }

  function save() {
    const rules = buildRules(combinator, conditions);
    startSave(async () => {
      if (segment) {
        const r = await updateSegmentAction({ id: segment.id, name, rules });
        if (r.ok) router.push("/admin/segmentos");
      } else {
        const r = await createSegmentAction({ name, rules });
        if (r.ok) router.push(`/admin/segmentos/${r.segment.id}`);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/segmentos">
            <ArrowLeft className="mr-1.5 size-4" />
            Volver
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {segment ? "Editar segmento" : "Nuevo segmento"}
        </h1>
        <span className="ml-auto" />
        {segment ? (
          <Button
            variant="ghost"
            className="text-rose-500"
            onClick={() => {
              if (!confirm("¿Eliminar este segmento?")) return;
              startDelete(async () => {
                await deleteSegmentAction({ id: segment.id });
                router.push("/admin/segmentos");
              });
            }}
            disabled={deleting}
          >
            <Trash2 className="mr-1.5 size-4" />
            Borrar
          </Button>
        ) : null}
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Guardar
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card/30 p-5">
            <label
              htmlFor="segment-name"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Nombre del segmento
            </label>
            <Input
              id="segment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Suscriptores VIP confirmados"
              className="text-lg"
            />
          </div>

          <div className="rounded-2xl border bg-card/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Reglas
              </h2>
              <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCombinator("all")}
                  className={`rounded-full px-3 py-1 ${combinator === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Todas (AND)
                </button>
                <button
                  type="button"
                  onClick={() => setCombinator("any")}
                  className={`rounded-full px-3 py-1 ${combinator === "any" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Cualquiera (OR)
                </button>
              </div>
            </div>

            {conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin reglas. Sin reglas el segmento incluye <strong>todos</strong> los suscriptores
                activos confirmados.
              </p>
            ) : (
              <div className="space-y-2">
                {conditions.map((c, idx) => (
                  <div
                    key={`cond-${idx}-${c.field}`}
                    className="flex items-center gap-2 rounded-xl border bg-background p-2"
                  >
                    <select
                      value={c.field}
                      onChange={(e) =>
                        updateCondition(idx, { field: e.target.value as SegmentField })
                      }
                      className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                    >
                      {SEGMENT_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.op}
                      onChange={(e) => updateCondition(idx, { op: e.target.value as SegmentOp })}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {SEGMENT_OPS.map((o) => (
                        <option key={o} value={o}>
                          {OP_LABELS[o]}
                        </option>
                      ))}
                    </select>
                    {needsValue(c.op) ? (
                      <Input
                        value={c.value}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        placeholder={placeholderForField(c.field, c.op)}
                        className="h-9 flex-1 text-sm"
                      />
                    ) : (
                      <div className="flex-1 text-xs text-muted-foreground">—</div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                      aria-label="Eliminar regla"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={addCondition} className="mt-3">
              <Plus className="mr-1.5 size-4" />
              Añadir regla
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card/30 p-5">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Users className="size-3.5" /> Audiencia estimada
            </p>
            {previewing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Calculando…
              </div>
            ) : preview ? (
              <div>
                <div className="text-3xl font-semibold tabular-nums">{preview.matched}</div>
                <p className="text-xs text-muted-foreground">
                  de {preview.total} suscriptores activos confirmados
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aún sin calcular</p>
            )}
          </div>
          <div className="rounded-2xl border bg-muted/20 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">💡 Ejemplos</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                · <strong>tag</strong> en <code>vip,premium</code>
              </li>
              <li>
                · <strong>locale</strong> es igual a <code>es</code>
              </li>
              <li>
                · <strong>lastOpenAt</strong> en los últimos N días <code>30</code>
              </li>
              <li>
                · <strong>bounceCount</strong> menor que <code>3</code>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function needsValue(op: SegmentOp): boolean {
  return op !== "is_set" && op !== "is_not_set";
}

function placeholderForField(field: SegmentField, op: SegmentOp): string {
  if (op === "in" || op === "not_in") return "valor1, valor2, valor3";
  if (op === "in_last_days" || op === "not_in_last_days") return "número de días (ej: 30)";
  if (
    field === "createdAt" ||
    field === "confirmedAt" ||
    field === "lastOpenAt" ||
    field === "lastClickAt"
  ) {
    if (op === "before" || op === "after") return "YYYY-MM-DD";
  }
  if (field === "bounceCount") return "número (ej: 3)";
  if (field === "hasMembership") return "true / false";
  return "valor";
}

function loadConditions(rules: unknown): ConditionRow[] {
  if (!rules || typeof rules !== "object") return [];
  if ("field" in rules) {
    const r = rules as { field: string; op: string; value?: unknown };
    return [{ field: r.field as SegmentField, op: r.op as SegmentOp, value: stringify(r.value) }];
  }
  const inner =
    "all" in rules
      ? (rules as { all: unknown[] }).all
      : "any" in rules
        ? (rules as { any: unknown[] }).any
        : [];
  if (!Array.isArray(inner)) return [];
  return inner
    .filter(
      (c): c is { field: string; op: string; value?: unknown } =>
        typeof c === "object" && c !== null && "field" in c,
    )
    .map((c) => ({
      field: c.field as SegmentField,
      op: c.op as SegmentOp,
      value: stringify(c.value),
    }));
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function buildRules(combinator: "all" | "any", conditions: ConditionRow[]): SegmentRulesPayload {
  if (conditions.length === 0) return null;
  const parsed = conditions.map((c) => {
    let value: unknown = c.value;
    if (c.op === "in" || c.op === "not_in") {
      value = c.value
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (
      c.op === "in_last_days" ||
      c.op === "not_in_last_days" ||
      c.op === "gt" ||
      c.op === "lt" ||
      c.op === "gte" ||
      c.op === "lte"
    ) {
      value = Number(c.value);
    } else if (c.field === "hasMembership") {
      value = c.value === "true";
    } else if (c.op === "is_set" || c.op === "is_not_set") {
      value = undefined;
    }
    return { field: c.field, op: c.op, value };
  });
  if (parsed.length === 1) return parsed[0] as never;
  return { [combinator]: parsed } as never;
}
