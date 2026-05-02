"use client";

import {
  type ConditionGroup,
  STEP_GROUPS,
  STEP_LABELS,
  type Step,
  type StepType,
  TRIGGER_TYPES,
  type Trigger,
  type TriggerType,
} from "@/automations/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WEBHOOK_EVENTS } from "@/webhooks/events";
import {
  ArrowDown,
  ArrowLeft,
  Beaker,
  GripVertical,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAutomationAction,
  dryRunAction,
  triggerManualAction,
  updateAutomationAction,
} from "../_actions";

type AutomationDTO = {
  id: string;
  name: string;
  slug: string;
  description: string;
  triggerType: TriggerType;
  trigger: Trigger;
  conditions: ConditionGroup | null;
  steps: Step[];
  active: boolean;
  webhookSecret: string | null;
  runsTotal: number;
  runsFailed: number;
};

function newStep(type: StepType): Step {
  const id = `s_${Math.random().toString(36).slice(2, 8)}`;
  switch (type) {
    case "webhook":
      return { id, type: "webhook", url: "https://", method: "POST" };
    case "email":
      return { id, type: "email", to: "", subject: "", body: "" };
    case "slack":
      return { id, type: "slack", webhookUrl: "https://hooks.slack.com/...", text: "" };
    case "ai":
      return { id, type: "ai", task: "summarize", input: "" };
    case "http":
      return { id, type: "http", url: "https://", method: "GET" };
    case "db.entry.create":
      return { id, type: "db.entry.create", collectionSlug: "posts", title: "" };
    case "db.entry.update":
      return { id, type: "db.entry.update", entryId: "", patch: {} };
    case "db.subscriber.add":
      return { id, type: "db.subscriber.add", email: "" };
    case "db.comment.create":
      return {
        id,
        type: "db.comment.create",
        entryId: "",
        authorName: "",
        authorEmail: "",
        body: "",
      };
    case "sleep":
      return { id, type: "sleep", ms: 5000 };
    case "branch":
      // biome-ignore lint/suspicious/noThenProperty: branch.then/else is the conceptual if/else shape, not a thenable
      return { id, type: "branch", conditions: { all: [] }, then: [], else: [] };
  }
}

export function AutomationClient({ automation }: { automation: AutomationDTO }) {
  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description);
  const [triggerType, setTriggerType] = useState<TriggerType>(automation.triggerType);
  const [trigger, setTrigger] = useState<Trigger>(automation.trigger);
  const [steps, setSteps] = useState<Step[]>(automation.steps);
  const [active, setActive] = useState(automation.active);
  const [tab, setTab] = useState<"editor" | "runs" | "settings">("editor");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const r = await updateAutomationAction({
        id: automation.id,
        name,
        description,
        triggerType,
        trigger,
        steps,
        active,
      });
      if (r.ok) toast.success("Guardado");
      else toast.error(r.error);
    });
  }

  function toggleActive() {
    start(async () => {
      const next = !active;
      const r = await updateAutomationAction({ id: automation.id, active: next });
      if (r.ok) {
        setActive(next);
        toast.success(next ? "Activada" : "Pausada");
      } else toast.error(r.error);
    });
  }

  function destroy() {
    if (!confirm("Eliminar automatización? Esto no se puede deshacer.")) return;
    start(async () => {
      const r = await deleteAutomationAction(automation.id);
      if (r.ok) {
        toast.success("Eliminada");
        router.push("/admin/automatizaciones");
      } else toast.error(r.error);
    });
  }

  function runNow() {
    start(async () => {
      const r = await triggerManualAction({ id: automation.id, payload: { test: true } });
      if (r.ok) toast.success(`Ejecutando run ${r.runId}`);
      else toast.error(r.error);
    });
  }

  function dryRunNow() {
    start(async () => {
      // Guardamos primero por si los steps cambiaron
      await updateAutomationAction({ id: automation.id, steps });
      const r = await dryRunAction({ id: automation.id, payload: { test: true } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      console.log("Dry run result", r.result);
      const failed = r.result.steps.find((s) => s.status === "failed");
      if (failed) toast.error(`Step ${failed.index} falló: ${failed.error}`);
      else toast.success(`OK — ${r.result.steps.length} steps. Mira la consola.`);
    });
  }

  function addStep(type: StepType) {
    setSteps([...steps, newStep(type)]);
  }

  function updateStep(idx: number, patch: Partial<Step>) {
    setSteps(steps.map((s, i) => (i === idx ? ({ ...s, ...patch } as Step) : s)));
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(idx, 1);
    if (item) next.splice(ni, 0, item);
    setSteps(next);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/admin/automatizaciones">
            <ArrowLeft className="size-3.5" /> Automatizaciones
          </Link>
        </Button>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-md text-base font-semibold"
          />
          {active ? (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
              Activa
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Pausada
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={toggleActive}
          disabled={pending}
        >
          {active ? (
            <>
              <Pause className="size-3.5" /> Pausar
            </>
          ) : (
            <>
              <Play className="size-3.5" /> Activar
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={dryRunNow}
          disabled={pending}
        >
          <Beaker className="size-3.5" /> Probar
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={runNow} disabled={pending}>
          <Zap className="size-3.5" /> Ejecutar
        </Button>
        <Button size="sm" className="gap-1.5" onClick={save} disabled={pending}>
          <Save className="size-3.5" /> Guardar
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {(["editor", "runs", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "editor" ? "Editor" : t === "runs" ? "Runs" : "Ajustes"}
          </button>
        ))}
      </div>

      {tab === "editor" ? (
        <EditorTab
          description={description}
          setDescription={setDescription}
          triggerType={triggerType}
          setTriggerType={setTriggerType}
          trigger={trigger}
          setTrigger={setTrigger}
          steps={steps}
          updateStep={updateStep}
          removeStep={removeStep}
          moveStep={moveStep}
          addStep={addStep}
        />
      ) : tab === "runs" ? (
        <RunsTab
          automationId={automation.id}
          runsTotal={automation.runsTotal}
          runsFailed={automation.runsFailed}
        />
      ) : (
        <SettingsTab automation={automation} onDelete={destroy} />
      )}
    </div>
  );
}

function EditorTab({
  description,
  setDescription,
  triggerType,
  setTriggerType,
  trigger,
  setTrigger,
  steps,
  updateStep,
  removeStep,
  moveStep,
  addStep,
}: {
  description: string;
  setDescription: (s: string) => void;
  triggerType: TriggerType;
  setTriggerType: (t: TriggerType) => void;
  trigger: Trigger;
  setTrigger: (t: Trigger) => void;
  steps: Step[];
  updateStep: (i: number, patch: Partial<Step>) => void;
  removeStep: (i: number) => void;
  moveStep: (i: number, dir: -1 | 1) => void;
  addStep: (t: StepType) => void;
}) {
  return (
    <>
      <section className="rounded-2xl border bg-card/30 p-5 space-y-3">
        <Label htmlFor="desc">Descripción</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </section>

      <section className="rounded-2xl border bg-card/30 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Trigger</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {TRIGGER_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTriggerType(t.value);
                setTrigger({ type: t.value } as Trigger);
              }}
              className={cn(
                "rounded-lg border p-2 text-left text-xs",
                triggerType === t.value ? "border-primary bg-primary/10" : "border-border/60",
              )}
            >
              <div className="font-medium">{t.label}</div>
              <div className="text-[10px] text-muted-foreground">{t.description}</div>
            </button>
          ))}
        </div>

        {triggerType === "event" ? (
          <div className="space-y-1.5">
            <Label htmlFor="evt">Evento</Label>
            <select
              id="evt"
              value={(trigger as { event?: string }).event ?? "*"}
              onChange={(e) => setTrigger({ type: "event", event: e.target.value as never })}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="*">Todos</option>
              {WEBHOOK_EVENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {triggerType === "form_submit" ? (
          <div className="space-y-1.5">
            <Label htmlFor="fid">Form ID (UUID)</Label>
            <Input
              id="fid"
              value={(trigger as { formId?: string }).formId ?? ""}
              onChange={(e) => setTrigger({ type: "form_submit", formId: e.target.value })}
              className="font-mono text-xs"
              placeholder="UUID del form"
            />
          </div>
        ) : null}

        {triggerType === "cron" ? (
          <div className="space-y-1.5">
            <Label htmlFor="cron">Cron schedule</Label>
            <Input
              id="cron"
              value={(trigger as { schedule?: string }).schedule ?? "0 * * * *"}
              onChange={(e) => setTrigger({ type: "cron", schedule: e.target.value })}
              className="font-mono text-xs"
              placeholder="0 9 * * 1-5"
            />
            <p className="text-[10px] text-muted-foreground">
              ⚠ Para que se ejecute automáticamente, añade el cron en vercel.json apuntando a
              /api/automations/{"{id}"}/trigger.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Steps</h2>
        {steps.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sin steps. Añade el primero abajo.
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s.id ?? i} className="flex">
                <div className="flex w-10 flex-col items-center pt-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-mono">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 ? <div className="mt-1 flex-1 w-px bg-border" /> : null}
                </div>
                <div className="flex-1 rounded-2xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {s.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {STEP_LABELS[s.type as StepType] ?? s.type}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => moveStep(i, -1)}
                        aria-label="Subir"
                      >
                        <GripVertical className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => moveStep(i, 1)}
                        aria-label="Bajar"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-rose-500"
                        onClick={() => removeStep(i)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <StepEditor step={s} onChange={(patch) => updateStep(i, patch)} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border bg-card/20 p-4 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Añadir step
          </p>
          {STEP_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mt-2 mb-1 text-[10px] text-muted-foreground">{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.types.map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => addStep(t)}
                  >
                    <Plus className="size-3" /> {STEP_LABELS[t]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StepEditor({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  const common = (
    <Input
      placeholder="Nombre opcional"
      value={step.name ?? ""}
      onChange={(e) => onChange({ name: e.target.value || undefined } as Partial<Step>)}
      className="text-xs h-8"
    />
  );

  switch (step.type) {
    case "webhook":
      return (
        <>
          {common}
          <Input
            placeholder="https://example.com/hook"
            value={step.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Step>)}
            className="font-mono text-xs"
          />
          <Textarea
            placeholder='{"campo":"{{trigger.payload.foo}}"}'
            value={step.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value } as Partial<Step>)}
            rows={3}
            className="font-mono text-xs"
          />
        </>
      );
    case "email":
      return (
        <>
          {common}
          <Input
            placeholder="destinatario@ejemplo.com"
            value={step.to}
            onChange={(e) => onChange({ to: e.target.value } as Partial<Step>)}
            className="text-xs"
          />
          <Input
            placeholder="Asunto"
            value={step.subject}
            onChange={(e) => onChange({ subject: e.target.value } as Partial<Step>)}
            className="text-xs"
          />
          <Textarea
            placeholder="HTML o texto plano"
            value={step.body}
            onChange={(e) => onChange({ body: e.target.value } as Partial<Step>)}
            rows={3}
            className="text-xs"
          />
        </>
      );
    case "slack":
      return (
        <>
          {common}
          <Input
            placeholder="https://hooks.slack.com/services/..."
            value={step.webhookUrl}
            onChange={(e) => onChange({ webhookUrl: e.target.value } as Partial<Step>)}
            className="font-mono text-xs"
          />
          <Textarea
            placeholder="Mensaje (soporta {{trigger.payload.x}})"
            value={step.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<Step>)}
            rows={2}
            className="text-xs"
          />
        </>
      );
    case "ai":
      return (
        <>
          {common}
          <select
            value={step.task}
            onChange={(e) => onChange({ task: e.target.value as never } as Partial<Step>)}
            className="flex h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            <option value="summarize">Resumir</option>
            <option value="classify">Clasificar</option>
            <option value="extract_json">Extraer JSON</option>
          </select>
          <Textarea
            placeholder="Texto de entrada (templates OK)"
            value={step.input}
            onChange={(e) => onChange({ input: e.target.value } as Partial<Step>)}
            rows={3}
            className="text-xs"
          />
          {step.task === "classify" ? (
            <Input
              placeholder="Etiquetas separadas por coma"
              value={(step.labels ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  labels: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                } as Partial<Step>)
              }
              className="text-xs"
            />
          ) : null}
        </>
      );
    case "http":
      return (
        <>
          {common}
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <select
              value={step.method ?? "GET"}
              onChange={(e) => onChange({ method: e.target.value as never } as Partial<Step>)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
            <Input
              placeholder="URL"
              value={step.url}
              onChange={(e) => onChange({ url: e.target.value } as Partial<Step>)}
              className="font-mono text-xs"
            />
          </div>
          {step.method && step.method !== "GET" ? (
            <Textarea
              placeholder="Body"
              value={step.body ?? ""}
              onChange={(e) => onChange({ body: e.target.value } as Partial<Step>)}
              rows={3}
              className="font-mono text-xs"
            />
          ) : null}
        </>
      );
    case "db.entry.create":
      return (
        <>
          {common}
          <Input
            placeholder="Slug de colección (posts, pages, ...)"
            value={step.collectionSlug}
            onChange={(e) => onChange({ collectionSlug: e.target.value } as Partial<Step>)}
            className="text-xs font-mono"
          />
          <Input
            placeholder="Título"
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value } as Partial<Step>)}
            className="text-xs"
          />
          <Textarea
            placeholder="Body texto plano (opcional)"
            value={step.bodyText ?? ""}
            onChange={(e) => onChange({ bodyText: e.target.value } as Partial<Step>)}
            rows={3}
            className="text-xs"
          />
        </>
      );
    case "db.subscriber.add":
      return (
        <>
          {common}
          <Input
            placeholder="email@ejemplo.com (templates OK)"
            value={step.email}
            onChange={(e) => onChange({ email: e.target.value } as Partial<Step>)}
            className="text-xs"
          />
          <Input
            placeholder="Tags separados por coma"
            value={(step.tags ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                tags: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              } as Partial<Step>)
            }
            className="text-xs"
          />
        </>
      );
    case "sleep":
      return (
        <>
          {common}
          <div className="flex items-center gap-2">
            <Label className="text-xs">Esperar</Label>
            <Input
              type="number"
              min={0}
              max={3_600_000}
              value={step.ms}
              onChange={(e) => onChange({ ms: Number(e.target.value) } as Partial<Step>)}
              className="text-xs w-32"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
        </>
      );
    case "branch":
      return (
        <>
          {common}
          <p className="text-[11px] text-muted-foreground">
            Las ramas anidadas (then/else) se editan vía JSON. Próximamente: editor visual.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer">Ver JSON</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[10px]">
              {JSON.stringify(
                // biome-ignore lint/suspicious/noThenProperty: branch shape mirrors if/then/else, not Promise
                { conditions: step.conditions, then: step.then, else: step.else },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      );
    default:
      return (
        <pre className="rounded bg-muted p-2 text-[10px] overflow-x-auto">
          {JSON.stringify(step, null, 2)}
        </pre>
      );
  }
}

function RunsTab({
  automationId,
  runsTotal,
  runsFailed,
}: {
  automationId: string;
  runsTotal: number;
  runsFailed: number;
}) {
  return (
    <div className="rounded-2xl border bg-card/30 p-5 space-y-3">
      <div className="flex gap-4 text-xs">
        <span>
          Total runs: <strong>{runsTotal}</strong>
        </span>
        <span>
          Fallidos: <strong className="text-rose-500">{runsFailed}</strong>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Para ver el log detallado, usa el endpoint REST{" "}
        <code>/api/v1/automations/{automationId}/runs</code>.
      </p>
    </div>
  );
}

function SettingsTab({
  automation,
  onDelete,
}: { automation: AutomationDTO; onDelete: () => void }) {
  return (
    <>
      <section className="rounded-2xl border bg-card/30 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Slug</h2>
        <code className="block rounded-lg bg-muted px-3 py-2 text-xs font-mono">
          {automation.slug}
        </code>
      </section>
      {automation.triggerType === "webhook_in" && automation.webhookSecret ? (
        <section className="rounded-2xl border bg-card/30 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Webhook entrante</h2>
          <p className="text-xs text-muted-foreground">
            POST a <code>/api/automations/{automation.id}/trigger</code> con header
            <code> x-csm-secret: …</code>
          </p>
          <code className="block rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all">
            {automation.webhookSecret}
          </code>
        </section>
      ) : null}
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Zona de peligro</h2>
        <Button variant="destructive" onClick={onDelete}>
          Eliminar automatización
        </Button>
      </section>
    </>
  );
}
