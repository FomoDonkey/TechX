"use client";

import { updateCollectionAction } from "@/app/admin/colecciones/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type CollectionSchema,
  FIELD_KIND_CATALOG,
  type FieldDef,
  type FieldKind,
  type FieldKindMeta,
} from "@/lib/fields";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Icons from "lucide-react";
import { Check, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  collectionId: string;
  initialSchema: CollectionSchema;
  initialName: string;
  initialIcon: string | null;
  initialDescription: string | null;
  initialSingleton: boolean;
  isBuiltin: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function lucide(name: string) {
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[name];
  return Cmp ?? Icons.Type;
}

function newFieldOfKind(kind: FieldKind): FieldDef {
  const meta = FIELD_KIND_CATALOG.find((c) => c.kind === kind);
  const baseLabel = meta?.label ?? kind;
  const id = nanoid(10);
  const key = `campo_${id.slice(0, 4)}`;
  return {
    id,
    key,
    label: baseLabel,
    kind,
    required: false,
    showInList: kind === "text" || kind === "image",
    ...(kind === "select" || kind === "multiselect"
      ? { options: [{ value: "opcion-1", label: "Opción 1" }] }
      : {}),
  };
}

export function CollectionBuilder(props: Props) {
  const [schema, setSchema] = useState<CollectionSchema>(props.initialSchema);
  const [name, setName] = useState(props.initialName);
  const [icon, setIcon] = useState(props.initialIcon ?? "Layers");
  const [description, setDescription] = useState(props.initialDescription ?? "");
  const [singleton, setSingleton] = useState(props.initialSingleton);
  const [selectedId, setSelectedId] = useState<string | null>(schema.fields[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const lastSentRef = useRef<string>("");
  const dirtyRef = useRef(false);

  const selectedField = useMemo(
    () => schema.fields.find((f) => f.id === selectedId) ?? null,
    [schema.fields, selectedId],
  );

  // Autosave
  useEffect(() => {
    const payload = JSON.stringify({ schema, name, icon, description, singleton });
    if (payload === lastSentRef.current) return;
    if (lastSentRef.current === "") {
      // primera carga
      lastSentRef.current = payload;
      return;
    }
    dirtyRef.current = true;
    setSaveState("saving");
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await updateCollectionAction({
          id: props.collectionId,
          name,
          icon: icon || null,
          description: description || null,
          isSingleton: singleton,
          schema,
        });
        if (res.ok) {
          lastSentRef.current = payload;
          dirtyRef.current = false;
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1500);
        } else {
          setSaveState("error");
          toast.error(res.error ?? "Error al guardar");
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [schema, name, icon, description, singleton, props.collectionId]);

  // Warn on unload if dirty
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function addField(kind: FieldKind) {
    const f = newFieldOfKind(kind);
    setSchema((s) => ({ ...s, fields: [...s.fields, f] }));
    setSelectedId(f.id);
  }

  function removeField(id: string) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.filter((f) => f.id !== id),
      titleField: s.titleField === id ? undefined : s.titleField,
    }));
    if (selectedId === id) setSelectedId(null);
  }

  function updateField(id: string, patch: Partial<FieldDef>) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  function moveField(fromIndex: number, toIndex: number) {
    setSchema((s) => {
      const next = [...s.fields];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return s;
      next.splice(toIndex, 0, moved);
      return { ...s, fields: next };
    });
  }

  return (
    <div className="grid flex-1 grid-cols-[260px_minmax(0,1fr)_320px] overflow-hidden">
      {/* LEFT: palette */}
      <FieldsPalette onAdd={addField} />

      {/* CENTER: fields list + meta */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/15">
        <div className="border-b bg-background/60 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SaveIndicator state={saveState} />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 p-6">
          <CollectionMeta
            name={name}
            setName={setName}
            icon={icon}
            setIcon={setIcon}
            description={description}
            setDescription={setDescription}
            singleton={singleton}
            setSingleton={setSingleton}
            isBuiltin={props.isBuiltin}
          />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Campos ({schema.fields.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Arrastra para reordenar · click para editar
              </span>
            </div>

            {schema.fields.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
                Aún no hay campos. Elige un tipo en el panel izquierdo para empezar.
              </div>
            ) : (
              <SortableFields
                fields={schema.fields}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={removeField}
                onMove={moveField}
              />
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: inspector */}
      <FieldInspector
        field={selectedField}
        onChange={(patch) => selectedField && updateField(selectedField.id, patch)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

// ============================================================
// LEFT: palette
// ============================================================
function FieldsPalette({ onAdd }: { onAdd: (k: FieldKind) => void }) {
  const grouped = useMemo(() => {
    const out: Record<string, FieldKindMeta[]> = {};
    for (const m of FIELD_KIND_CATALOG) {
      if (!out[m.group]) out[m.group] = [];
      out[m.group]!.push(m);
    }
    return out;
  }, []);
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r bg-background/40">
      <div className="border-b px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Tipos de campo
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-3">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="mb-1.5 px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.map((m) => {
                const Icon = lucide(m.icon);
                return (
                  <button
                    key={m.kind}
                    type="button"
                    onClick={() => onAdd(m.kind)}
                    className="group flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm hover:border-border hover:bg-card"
                    title={m.description}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    <div className="flex-1">
                      <div className="text-sm leading-tight">{m.label}</div>
                      <div className="line-clamp-1 text-[10.5px] text-muted-foreground">
                        {m.description}
                      </div>
                    </div>
                    <Plus className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ============================================================
// CENTER: meta + sortable list
// ============================================================
function CollectionMeta(props: {
  name: string;
  setName: (v: string) => void;
  icon: string;
  setIcon: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  singleton: boolean;
  setSingleton: (v: boolean) => void;
  isBuiltin: boolean;
}) {
  const Icon = lucide(props.icon);
  return (
    <section className="rounded-2xl border bg-card/40 p-5">
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto]">
        <div className="flex flex-col items-center gap-1">
          <Label className="text-xs">Icono</Label>
          <div className="flex items-center gap-2">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-6" />
            </div>
            <Input
              value={props.icon}
              onChange={(e) => props.setIcon(e.target.value)}
              placeholder="Layers"
              className="h-9 w-28 text-xs"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-name" className="text-xs">
            Nombre
          </Label>
          <Input
            id="meta-name"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
          />
          <Textarea
            value={props.description}
            onChange={(e) => props.setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="resize-none text-sm"
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Label className="text-xs">Singleton</Label>
          <Switch
            checked={props.singleton}
            onCheckedChange={props.setSingleton}
            disabled={props.isBuiltin}
          />
          {props.isBuiltin ? (
            <span className="text-[10px] text-muted-foreground">no editable</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SortableFields({
  fields,
  selectedId,
  onSelect,
  onRemove,
  onMove,
}: {
  fields: FieldDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from === -1 || to === -1) return;
    onMove(from, to);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              selected={selectedId === f.id}
              onSelect={() => onSelect(f.id)}
              onRemove={() => onRemove(f.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function FieldRow({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: FieldDef;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const meta = FIELD_KIND_CATALOG.find((c) => c.kind === field.kind);
  const Icon = lucide(meta?.icon ?? "Type");
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card/60 px-3 py-2.5 transition-all",
        selected && "border-primary ring-2 ring-primary/30",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Arrastrar"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex flex-1 items-center gap-3 text-left">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-foreground/70">
          <Icon className="size-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{field.label || "(sin label)"}</span>
            {field.required ? (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                requerido
              </span>
            ) : null}
            {field.unique ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                único
              </span>
            ) : null}
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            <code>{field.key}</code> · {meta?.label}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Eliminar campo"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

// ============================================================
// RIGHT: inspector
// ============================================================
function FieldInspector({
  field,
  onChange,
  onClose,
}: {
  field: FieldDef | null;
  onChange: (patch: Partial<FieldDef>) => void;
  onClose: () => void;
}) {
  if (!field) {
    return (
      <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-background/40 p-6 text-center">
        <div className="my-auto">
          <Icons.Settings2 className="mx-auto mb-3 size-8 text-muted-foreground" />
          <div className="text-sm font-medium text-muted-foreground">Sin selección</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona un campo para editar sus opciones.
          </p>
        </div>
      </aside>
    );
  }
  const meta = FIELD_KIND_CATALOG.find((c) => c.kind === field.kind);
  const Icon = lucide(meta?.icon ?? "Type");
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-background/40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{meta?.label}</div>
            <div className="truncate text-[11px] text-muted-foreground">{field.key}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4 text-sm">
        <div className="space-y-1.5">
          <Label htmlFor="f-label">Label</Label>
          <Input
            id="f-label"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-key">Key</Label>
          <Input
            id="f-key"
            value={field.key}
            onChange={(e) => onChange({ key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
            spellCheck={false}
          />
          <p className="text-[11px] text-muted-foreground">
            Usado en JSON y API. Solo letras, números y _.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-desc">Descripción (ayuda)</Label>
          <Textarea
            id="f-desc"
            value={field.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
          />
        </div>

        <ToggleRow
          label="Requerido"
          description="No se puede dejar vacío"
          checked={Boolean(field.required)}
          onChange={(v) => onChange({ required: v })}
        />
        <ToggleRow
          label="Mostrar en lista"
          description="Aparece como columna en el listado de entries"
          checked={Boolean(field.showInList)}
          onChange={(v) => onChange({ showInList: v })}
        />

        {/* Por kind */}
        {(field.kind === "text" || field.kind === "longtext" || field.kind === "markdown") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-min">Min chars</Label>
              <Input
                id="f-min"
                type="number"
                value={field.minLength ?? ""}
                onChange={(e) =>
                  onChange({
                    minLength: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-max">Max chars</Label>
              <Input
                id="f-max"
                type="number"
                value={field.maxLength ?? ""}
                onChange={(e) =>
                  onChange({
                    maxLength: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="f-placeholder">Placeholder</Label>
              <Input
                id="f-placeholder"
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </div>
          </div>
        )}

        {field.kind === "number" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-min2">Min</Label>
              <Input
                id="f-min2"
                type="number"
                value={field.min ?? ""}
                onChange={(e) =>
                  onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-max2">Max</Label>
              <Input
                id="f-max2"
                type="number"
                value={field.max ?? ""}
                onChange={(e) =>
                  onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-step">Step</Label>
              <Input
                id="f-step"
                type="number"
                value={field.step ?? ""}
                onChange={(e) =>
                  onChange({ step: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
          </div>
        )}

        {field.kind === "ref" && (
          <div className="space-y-1.5">
            <Label htmlFor="f-ref">Slug de colección referenciada</Label>
            <Input
              id="f-ref"
              value={field.refCollection ?? ""}
              onChange={(e) => onChange({ refCollection: e.target.value })}
              placeholder="posts"
            />
          </div>
        )}

        {(field.kind === "select" || field.kind === "multiselect") && (
          <OptionsEditor
            options={field.options ?? []}
            onChange={(opts) => onChange({ options: opts })}
          />
        )}
      </div>
    </aside>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-[11px] text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string }[];
  onChange: (opts: { value: string; label: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Opciones</Label>
      <ul className="space-y-1.5">
        {options.map((opt, i) => (
          <li key={`opt-${i}-${opt.value}`} className="flex items-center gap-2">
            <Input
              className="h-9 flex-1"
              value={opt.label}
              placeholder="Etiqueta visible"
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...opt, label: e.target.value };
                onChange(next);
              }}
            />
            <Input
              className="h-9 w-24"
              value={opt.value}
              placeholder="valor"
              onChange={(e) => {
                const next = [...options];
                next[i] = {
                  ...opt,
                  value: e.target.value.replace(/[^a-z0-9-_]/gi, "-").toLowerCase(),
                };
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Eliminar opción"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...options,
            { value: `opcion-${options.length + 1}`, label: `Opción ${options.length + 1}` },
          ])
        }
      >
        <Plus className="size-3.5" /> Añadir opción
      </Button>
    </div>
  );
}

// ============================================================
// Save indicator
// ============================================================
function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        state === "saving"
          ? "border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300"
          : state === "saved"
            ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
            : state === "error"
              ? "border-destructive/30 bg-destructive/8 text-destructive"
              : "border-border text-muted-foreground",
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3 animate-spin" /> Guardando…
        </>
      ) : state === "saved" ? (
        <>
          <Check className="size-3" /> Guardado
        </>
      ) : state === "error" ? (
        <>
          <X className="size-3" /> Error
        </>
      ) : (
        <>Listo</>
      )}
    </div>
  );
}
