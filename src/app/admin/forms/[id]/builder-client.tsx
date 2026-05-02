"use client";

import { FieldRenderer, buildDefaultValues } from "@/components/forms/field-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isVisible } from "@/forms/conditional";
import type {
  Field,
  FieldKind,
  FormSchema,
  FormStep,
  SelectOption,
  VisibleClause,
  VisibleOp,
} from "@/forms/types";
import { isInputField } from "@/forms/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Eye,
  FileText,
  GripVertical,
  Hash,
  Heading1,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  Mail,
  Minus,
  PenLine,
  Phone,
  Plus,
  Save,
  Send,
  Star,
  Trash2,
  Type,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { publishFormAction, testSubmitAction, updateFormAction } from "../_actions";

type FormDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  schema: FormSchema | null;
};

type FieldPaletteItem = {
  kind: FieldKind;
  label: string;
  icon: typeof Type;
  group: "input" | "choice" | "advanced" | "layout";
};

const PALETTE: FieldPaletteItem[] = [
  { kind: "text", label: "Texto", icon: Type, group: "input" },
  { kind: "email", label: "Email", icon: Mail, group: "input" },
  { kind: "url", label: "URL", icon: LinkIcon, group: "input" },
  { kind: "tel", label: "Teléfono", icon: Phone, group: "input" },
  { kind: "textarea", label: "Texto largo", icon: AlignLeft, group: "input" },
  { kind: "number", label: "Número", icon: Hash, group: "input" },
  { kind: "select", label: "Desplegable", icon: ChevronDown, group: "choice" },
  { kind: "multiselect", label: "Multi-selección", icon: List, group: "choice" },
  { kind: "checkbox", label: "Casilla", icon: CheckSquare, group: "choice" },
  { kind: "radio", label: "Radio", icon: CircleDot, group: "choice" },
  { kind: "date", label: "Fecha", icon: Calendar, group: "input" },
  { kind: "rating", label: "Valoración", icon: Star, group: "advanced" },
  { kind: "file", label: "Archivo", icon: FileText, group: "advanced" },
  { kind: "signature", label: "Firma", icon: PenLine, group: "advanced" },
  { kind: "hidden", label: "Oculto", icon: ImageIcon, group: "advanced" },
  { kind: "section", label: "Sección", icon: Minus, group: "layout" },
  { kind: "heading", label: "Título", icon: Heading1, group: "layout" },
  { kind: "divider", label: "Divisoria", icon: Minus, group: "layout" },
];

const GROUP_LABELS: Record<FieldPaletteItem["group"], string> = {
  input: "Entrada",
  choice: "Elección",
  advanced: "Avanzados",
  layout: "Diseño",
};

function newId(): string {
  return `f_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultField(kind: FieldKind): Field {
  const id = newId();
  switch (kind) {
    case "text":
    case "email":
    case "url":
    case "tel":
      return { id, key: id, type: kind, label: capitalize(kind) };
    case "textarea":
      return { id, key: id, type: "textarea", label: "Texto largo", rows: 4 };
    case "number":
      return { id, key: id, type: "number", label: "Número" };
    case "select":
      return {
        id,
        key: id,
        type: "select",
        label: "Desplegable",
        options: [
          { value: "opt1", label: "Opción 1" },
          { value: "opt2", label: "Opción 2" },
        ],
      };
    case "multiselect":
      return {
        id,
        key: id,
        type: "multiselect",
        label: "Multi-selección",
        options: [
          { value: "opt1", label: "Opción 1" },
          { value: "opt2", label: "Opción 2" },
        ],
      };
    case "checkbox":
      return { id, key: id, type: "checkbox", label: "Acepto los términos" };
    case "radio":
      return {
        id,
        key: id,
        type: "radio",
        label: "Elige una",
        options: [
          { value: "a", label: "Opción A" },
          { value: "b", label: "Opción B" },
        ],
      };
    case "date":
      return { id, key: id, type: "date", label: "Fecha" };
    case "rating":
      return { id, key: id, type: "rating", label: "Valoración", max: 5 };
    case "file":
      return { id, key: id, type: "file", label: "Archivo" };
    case "signature":
      return { id, key: id, type: "signature", label: "Firma" };
    case "hidden":
      return { id, key: id, type: "hidden", label: "Oculto", value: "" };
    case "payment":
      return { id, key: id, type: "payment", label: "Pago", amountCents: 1000 };
    case "section":
      return { id, type: "section", label: "Nueva sección" };
    case "heading":
      return { id, type: "heading", text: "Título" };
    case "divider":
      return { id, type: "divider" };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BuilderClient({ form }: { form: FormDTO }) {
  const initial = form.schema ?? { fields: [], steps: [] };
  const [schema, setSchema] = useState<FormSchema>(initial);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  const [pending, start] = useTransition();
  const [confirmPublish, setConfirmPublish] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const dirty = useMemo(
    () => JSON.stringify(schema) !== JSON.stringify(initial),
    [schema, initial],
  );

  // Si no hay steps, todos los fields van en "step virtual 0"
  const stepFields = useMemo(() => {
    if (schema.steps.length === 0) return schema.fields.map((f) => f.id);
    const step = schema.steps[selectedStepIdx];
    return step?.fieldIds ?? [];
  }, [schema, selectedStepIdx]);

  const fieldsInStep = stepFields
    .map((fid) => schema.fields.find((f) => f.id === fid))
    .filter((f): f is Field => Boolean(f));

  const selectedField = selectedFieldId
    ? (schema.fields.find((f) => f.id === selectedFieldId) ?? null)
    : null;

  function addField(kind: FieldKind) {
    const f = defaultField(kind);
    const next: FormSchema = {
      ...schema,
      fields: [...schema.fields, f],
      steps:
        schema.steps.length === 0
          ? schema.steps
          : schema.steps.map((s, i) =>
              i === selectedStepIdx ? { ...s, fieldIds: [...s.fieldIds, f.id] } : s,
            ),
    };
    setSchema(next);
    setSelectedFieldId(f.id);
  }

  function updateField(id: string, patch: Partial<Field>) {
    setSchema({
      ...schema,
      fields: schema.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as Field) : f)),
    });
  }

  function deleteField(id: string) {
    setSchema({
      ...schema,
      fields: schema.fields.filter((f) => f.id !== id),
      steps: schema.steps.map((s) => ({ ...s, fieldIds: s.fieldIds.filter((fid) => fid !== id) })),
    });
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    if (schema.steps.length === 0) {
      const oldIdx = schema.fields.findIndex((f) => f.id === active.id);
      const newIdx = schema.fields.findIndex((f) => f.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      setSchema({ ...schema, fields: arrayMove(schema.fields, oldIdx, newIdx) });
    } else {
      const step = schema.steps[selectedStepIdx];
      if (!step) return;
      const oldIdx = step.fieldIds.indexOf(String(active.id));
      const newIdx = step.fieldIds.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0) return;
      const newOrder = arrayMove(step.fieldIds, oldIdx, newIdx);
      setSchema({
        ...schema,
        steps: schema.steps.map((s, i) =>
          i === selectedStepIdx ? { ...s, fieldIds: newOrder } : s,
        ),
      });
    }
  }

  function addStep() {
    const baseFieldIds = schema.steps.length === 0 ? schema.fields.map((f) => f.id) : [];
    const newStep: FormStep = {
      id: `s_${Math.random().toString(36).slice(2, 8)}`,
      title: `Paso ${schema.steps.length + 1}`,
      fieldIds: baseFieldIds.length > 0 && schema.steps.length === 0 ? baseFieldIds : [],
    };
    const newSteps =
      schema.steps.length === 0
        ? [
            newStep,
            { id: `s_${Math.random().toString(36).slice(2, 8)}`, title: "Paso 2", fieldIds: [] },
          ]
        : [...schema.steps, newStep];
    setSchema({ ...schema, steps: newSteps });
    setSelectedStepIdx(newSteps.length - 1);
  }

  function removeStep(idx: number) {
    if (schema.steps.length <= 1) {
      // Volver a single-step (todos los fields visibles).
      setSchema({ ...schema, steps: [] });
      setSelectedStepIdx(0);
      return;
    }
    const removedStep = schema.steps[idx];
    if (!removedStep) return;
    // Los fields del step removido se reasignan al primer step.
    const firstStepIdx = idx === 0 ? 1 : 0;
    const newSteps = schema.steps
      .map((s, i) => {
        if (i === idx) return null;
        if (i === firstStepIdx) return { ...s, fieldIds: [...s.fieldIds, ...removedStep.fieldIds] };
        return s;
      })
      .filter((s): s is FormStep => s !== null);
    setSchema({ ...schema, steps: newSteps });
    setSelectedStepIdx(Math.max(0, idx - 1));
  }

  function save() {
    start(async () => {
      const r = await updateFormAction({ id: form.id, schema });
      if (r.ok) toast.success("Guardado");
      else toast.error(r.error ?? "Error al guardar");
    });
  }

  function publish() {
    start(async () => {
      const r = await updateFormAction({ id: form.id, schema });
      if (!r.ok) {
        toast.error(r.error ?? "Error al guardar");
        return;
      }
      const p = await publishFormAction(form.id);
      if (p.ok) {
        toast.success(`Publicado v${p.form.version}`);
        location.reload();
      } else toast.error(p.error);
    });
  }

  return (
    <div className="grid h-[calc(100vh-180px)] grid-cols-[260px_1fr_320px]">
      {/* Paleta */}
      <aside className="border-r overflow-y-auto p-4 space-y-5 bg-card/20">
        <div className="space-y-3">
          {(["input", "choice", "advanced", "layout"] as const).map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {GROUP_LABELS[g]}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PALETTE.filter((p) => p.group === g).map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.kind}
                      type="button"
                      onClick={() => addField(p.kind)}
                      className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Pasos
          </p>
          {schema.steps.length === 0 ? (
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addStep}>
              <Plus className="size-3.5" /> Convertir en multi-step
            </Button>
          ) : (
            <div className="space-y-1">
              {schema.steps.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md border p-1.5 text-xs",
                    i === selectedStepIdx ? "border-primary bg-primary/5" : "border-border/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedStepIdx(i)}
                    className="flex-1 truncate text-left"
                  >
                    {s.title ?? `Paso ${i + 1}`}{" "}
                    <span className="text-muted-foreground">({s.fieldIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500"
                    aria-label="Eliminar paso"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={addStep}>
                <Plus className="size-3.5" /> Añadir paso
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <section className="overflow-y-auto bg-muted/20 px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {schema.steps.length === 0
                ? `${schema.fields.length} campos`
                : `Paso ${selectedStepIdx + 1} de ${schema.steps.length} · ${fieldsInStep.length} campos`}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowPreview((s) => !s)}
              >
                <Eye className="size-3.5" /> {showPreview ? "Editor" : "Preview"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={save}
                disabled={pending}
              >
                <Save className="size-3.5" /> Guardar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmPublish(true)}
                disabled={pending}
              >
                <Send className="size-3.5" /> Publicar
              </Button>
            </div>
          </div>

          {showPreview ? (
            <PreviewPane fields={fieldsInStep} schema={schema} formId={form.id} />
          ) : (
            <div className="space-y-2 rounded-2xl border bg-card p-5">
              {fieldsInStep.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <ClipboardList className="mx-auto size-10 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sin campos. Añade desde la paleta.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={fieldsInStep.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fieldsInStep.map((f) => (
                      <SortableRow
                        key={f.id}
                        field={f}
                        selected={selectedFieldId === f.id}
                        onSelect={() => setSelectedFieldId(f.id)}
                        onDelete={() => deleteField(f.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Inspector */}
      <aside className="border-l overflow-y-auto p-4 bg-card/20">
        {selectedField ? (
          <FieldInspector
            field={selectedField}
            allFields={schema.fields.filter(isInputField)}
            onChange={(patch) => updateField(selectedField.id, patch)}
          />
        ) : (
          <FormInspector schema={schema} onChange={(patch) => setSchema({ ...schema, ...patch })} />
        )}
      </aside>

      {dirty ? (
        <div className="fixed bottom-4 right-4 rounded-full border bg-background/90 backdrop-blur px-3 py-1.5 text-xs shadow-lg">
          Cambios sin guardar
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={form.status === "published" ? "Publicar nueva versión" : "Publicar formulario"}
        description={
          form.status === "published"
            ? "Se creará una nueva versión inmutable y los nuevos envíos usarán este schema."
            : `El formulario quedará accesible públicamente en /forms/${form.slug}.`
        }
        confirmLabel="Publicar"
        onConfirm={publish}
        pending={pending}
      />
    </div>
  );
}

// ============================================================
// Sortable row (canvas)
// ============================================================

function SortableRow({
  field,
  selected,
  onSelect,
  onDelete,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const showCondition = "visibleIf" in field && field.visibleIf;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group flex items-start gap-2 rounded-xl border p-3 transition-colors cursor-pointer",
        selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-border",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="mt-1 cursor-grab text-muted-foreground"
        aria-label="Arrastrar"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {"label" in field ? field.label : field.type}
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {field.type}
          </Badge>
          {"required" in field && field.required ? (
            <Badge variant="outline" className="text-[10px] text-rose-500">
              required
            </Badge>
          ) : null}
          {showCondition ? (
            <Badge variant="outline" className="text-[10px] text-amber-500">
              condicional
            </Badge>
          ) : null}
        </div>
        {"key" in field && field.key ? (
          <p className="text-[10px] font-mono text-muted-foreground">{field.key}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500"
        aria-label="Eliminar"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ============================================================
// Inspector — Field
// ============================================================

function FieldInspector({
  field,
  allFields,
  onChange,
}: {
  field: Field;
  allFields: Field[];
  onChange: (patch: Partial<Field>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Campo</p>
        <p className="text-sm font-mono">{field.type}</p>
      </div>

      {"label" in field ? (
        <div className="space-y-1.5">
          <Label htmlFor="lbl">Etiqueta</Label>
          <Input
            id="lbl"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value } as Partial<Field>)}
          />
        </div>
      ) : null}

      {"key" in field ? (
        <div className="space-y-1.5">
          <Label htmlFor="key">Key</Label>
          <Input
            id="key"
            value={field.key}
            onChange={(e) =>
              onChange({
                key: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
              } as Partial<Field>)
            }
            className="font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Identificador en el JSON de la submission y nombre del input.
          </p>
        </div>
      ) : null}

      {"help" in field ? (
        <div className="space-y-1.5">
          <Label htmlFor="help">Ayuda</Label>
          <Textarea
            id="help"
            value={field.help ?? ""}
            onChange={(e) => onChange({ help: e.target.value } as Partial<Field>)}
            rows={2}
          />
        </div>
      ) : null}

      {"placeholder" in field &&
      (field.type === "text" ||
        field.type === "email" ||
        field.type === "url" ||
        field.type === "tel" ||
        field.type === "textarea" ||
        field.type === "number" ||
        field.type === "select") ? (
        <div className="space-y-1.5">
          <Label htmlFor="ph">Placeholder</Label>
          <Input
            id="ph"
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value } as Partial<Field>)}
          />
        </div>
      ) : null}

      {"required" in field ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ required: e.target.checked } as Partial<Field>)}
            className="size-4 rounded"
          />
          Obligatorio
        </label>
      ) : null}

      {field.type === "text" ||
      field.type === "email" ||
      field.type === "url" ||
      field.type === "tel" ||
      field.type === "textarea" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="min">Mín. chars</Label>
            <Input
              id="min"
              type="number"
              value={field.minLength ?? ""}
              onChange={(e) =>
                onChange({
                  minLength: e.target.value === "" ? undefined : Number(e.target.value),
                } as Partial<Field>)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">Máx. chars</Label>
            <Input
              id="max"
              type="number"
              value={field.maxLength ?? ""}
              onChange={(e) =>
                onChange({
                  maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                } as Partial<Field>)
              }
            />
          </div>
        </div>
      ) : null}

      {field.type === "number" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="nmin">Mín.</Label>
            <Input
              id="nmin"
              type="number"
              value={field.min ?? ""}
              onChange={(e) =>
                onChange({
                  min: e.target.value === "" ? undefined : Number(e.target.value),
                } as Partial<Field>)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nmax">Máx.</Label>
            <Input
              id="nmax"
              type="number"
              value={field.max ?? ""}
              onChange={(e) =>
                onChange({
                  max: e.target.value === "" ? undefined : Number(e.target.value),
                } as Partial<Field>)
              }
            />
          </div>
        </div>
      ) : null}

      {field.type === "select" || field.type === "multiselect" || field.type === "radio" ? (
        <OptionsEditor
          options={field.options}
          onChange={(options) => onChange({ options } as Partial<Field>)}
        />
      ) : null}

      {field.type === "rating" ? (
        <div className="space-y-1.5">
          <Label htmlFor="rmax">Máx. estrellas</Label>
          <Input
            id="rmax"
            type="number"
            min={1}
            max={10}
            value={field.max ?? 5}
            onChange={(e) => onChange({ max: Number(e.target.value) } as Partial<Field>)}
          />
        </div>
      ) : null}

      {"visibleIf" in field || isInputField(field) ? (
        <ConditionalEditor
          condition={"visibleIf" in field ? field.visibleIf : undefined}
          allFields={allFields.filter((f) => f.id !== field.id)}
          onChange={(visibleIf) => onChange({ visibleIf } as Partial<Field>)}
        />
      ) : null}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (next: SelectOption[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Opciones</Label>
      <div className="space-y-1">
        {options.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: options have no stable id; reordering UI not supported here
          <div key={i} className="flex items-center gap-1">
            <Input
              value={o.value}
              onChange={(e) =>
                onChange(options.map((x, j) => (i === j ? { ...x, value: e.target.value } : x)))
              }
              placeholder="value"
              className="font-mono text-xs h-8"
            />
            <Input
              value={o.label}
              onChange={(e) =>
                onChange(options.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))
              }
              placeholder="Etiqueta"
              className="text-xs h-8"
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-rose-500"
              aria-label="Eliminar"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-xs"
        onClick={() =>
          onChange([...options, { value: `opt${options.length + 1}`, label: "Nueva opción" }])
        }
      >
        <Plus className="size-3" /> Añadir
      </Button>
    </div>
  );
}

function ConditionalEditor({
  condition,
  allFields,
  onChange,
}: {
  condition?: { all?: VisibleClause[]; any?: VisibleClause[] };
  allFields: Field[];
  onChange: (next: { all?: VisibleClause[]; any?: VisibleClause[] } | undefined) => void;
}) {
  const clauses = condition?.all ?? condition?.any ?? [];
  const mode: "all" | "any" = condition?.any ? "any" : "all";

  function setClauses(next: VisibleClause[], m: "all" | "any" = mode) {
    if (next.length === 0) onChange(undefined);
    else onChange({ [m]: next } as { all?: VisibleClause[]; any?: VisibleClause[] });
  }

  return (
    <div className="rounded-xl border border-dashed p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider">Mostrar si</Label>
        {clauses.length > 0 ? (
          <select
            value={mode}
            onChange={(e) => setClauses(clauses, e.target.value as "all" | "any")}
            className="rounded-md border bg-background px-1.5 py-0.5 text-xs"
          >
            <option value="all">Todas (Y)</option>
            <option value="any">Alguna (O)</option>
          </select>
        ) : null}
      </div>
      {clauses.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Sin condiciones — siempre visible.</p>
      ) : (
        clauses.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: clauses have no stable id; reordering UI not supported here
          <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1">
            <select
              value={c.fieldKey}
              onChange={(e) =>
                setClauses(
                  clauses.map((x, j) => (i === j ? { ...x, fieldKey: e.target.value } : x)),
                )
              }
              className="rounded-md border bg-background px-1.5 py-1 text-xs"
            >
              <option value="">Campo...</option>
              {allFields
                .filter((f): f is typeof f & { key: string } => "key" in f && Boolean(f.key))
                .map((f) => (
                  <option key={f.id} value={f.key}>
                    {("label" in f && f.label) || f.key}
                  </option>
                ))}
            </select>
            <select
              value={c.op}
              onChange={(e) =>
                setClauses(
                  clauses.map((x, j) => (i === j ? { ...x, op: e.target.value as VisibleOp } : x)),
                )
              }
              className="rounded-md border bg-background px-1.5 py-1 text-xs"
            >
              <option value="eq">==</option>
              <option value="neq">!=</option>
              <option value="contains">contiene</option>
              <option value="empty">vacío</option>
              <option value="not_empty">no vacío</option>
              <option value="gt">{">"}</option>
              <option value="lt">{"<"}</option>
              <option value="in">in</option>
              <option value="not_in">not in</option>
            </select>
            <Input
              value={c.value === undefined ? "" : String(c.value)}
              onChange={(e) =>
                setClauses(
                  clauses.map((x, j) =>
                    i === j ? { ...x, value: parseValue(e.target.value, c.op) } : x,
                  ),
                )
              }
              placeholder={c.op === "in" || c.op === "not_in" ? "a, b, c" : "valor"}
              className="text-xs h-8"
              disabled={c.op === "empty" || c.op === "not_empty"}
            />
            <button
              type="button"
              onClick={() => setClauses(clauses.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-rose-500"
              aria-label="Eliminar"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))
      )}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => setClauses([...clauses, { fieldKey: "", op: "eq", value: "" }])}
      >
        <Plus className="size-3" /> Añadir condición
      </Button>
    </div>
  );
}

function parseValue(v: string, op: VisibleOp): unknown {
  if (op === "in" || op === "not_in") return v.split(",").map((s) => s.trim());
  if (op === "gt" || op === "lt") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

// ============================================================
// Inspector — Form root (cuando no hay field seleccionado)
// ============================================================

function FormInspector({
  schema,
  onChange,
}: {
  schema: FormSchema;
  onChange: (patch: Partial<FormSchema>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Formulario</p>
      <div className="space-y-1.5">
        <Label htmlFor="submitlbl">Texto del botón</Label>
        <Input
          id="submitlbl"
          value={schema.submitLabel ?? ""}
          onChange={(e) => onChange({ submitLabel: e.target.value || undefined })}
          placeholder="Enviar"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="success">Mensaje de éxito</Label>
        <Textarea
          id="success"
          value={schema.successMessage ?? ""}
          onChange={(e) => onChange({ successMessage: e.target.value || undefined })}
          rows={2}
          placeholder="¡Gracias por tu envío!"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="redirect">Redirigir a (opcional)</Label>
        <Input
          id="redirect"
          value={schema.redirectUrl ?? ""}
          onChange={(e) => onChange({ redirectUrl: e.target.value || undefined })}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

// ============================================================
// Preview pane (test runner)
// ============================================================

function PreviewPane({
  fields,
  schema,
  formId,
}: {
  fields: Field[];
  schema: FormSchema;
  formId: string;
}) {
  const [data, setData] = useState<Record<string, unknown>>(() =>
    buildDefaultValues(schema.fields),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function submit() {
    start(async () => {
      const r = await testSubmitAction({ formId, data });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const out = r.result;
      if (out.kind === "validation_error") {
        const next: Record<string, string> = {};
        for (const i of out.issues) next[i.path.join(".")] = i.message;
        setErrors(next);
        setResult("Errores de validación");
        return;
      }
      setErrors({});
      setResult(`Resultado: ${out.kind} ${"submissionId" in out ? `· ${out.submissionId}` : ""}`);
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => {
          if (!isInputField(f)) {
            return (
              <FieldRenderer
                key={f.id}
                field={f}
                value={undefined}
                onChange={() => {}}
                data={data}
              />
            );
          }
          const key = f.key;
          return (
            <FieldRenderer
              key={f.id}
              field={f}
              value={data[key]}
              onChange={(v) => setData({ ...data, [key]: v })}
              data={data}
              error={errors[key]}
            />
          );
        })}
      </div>
      <Button onClick={submit} disabled={pending} className="gap-1.5">
        <Send className="size-3.5" /> {schema.submitLabel ?? "Enviar"}
      </Button>
      {result ? <p className="text-xs text-muted-foreground">{result}</p> : null}
    </div>
  );
}
