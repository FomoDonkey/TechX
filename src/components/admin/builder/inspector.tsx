"use client";

import { describeAudience } from "@/blocks/audience";
import { type BlockSpec, type PropSpec, getBlockSpec } from "@/blocks/registry";
import type { AudienceRule, BlockNode } from "@/blocks/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  node: BlockNode | null;
  symbols: { id: string; name: string }[];
  recentMedia: { id: string; url: string; alt: string | null; mime: string }[];
  onChange: (patch: Partial<BlockNode>) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const GROUPS: Array<NonNullable<PropSpec["group"]>> = ["Contenido", "Estilo", "Layout", "Avanzado"];

/**
 * Componente envoltorio: si no hay nodo, renderiza el placeholder; si hay nodo,
 * delega en `InspectorBody` que tiene los hooks. Esta separación EVITA violar las
 * Rules of Hooks (no se pueden llamar hooks después de un early-return condicional
 * que cambia entre renders).
 */
export function BuilderInspector(props: Props) {
  if (!props.node) {
    return (
      <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-background/40 p-6 text-center">
        <div className="my-auto">
          <Icons.MousePointer className="mx-auto mb-3 size-8 text-muted-foreground" />
          <div className="text-sm font-medium text-muted-foreground">Sin selección</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pincha en un bloque del lienzo para editar.
          </p>
        </div>
      </aside>
    );
  }
  return <InspectorBody {...props} node={props.node} />;
}

function InspectorBody({
  node,
  symbols,
  recentMedia,
  onChange,
  onClose,
  onDuplicate,
  onDelete,
}: Omit<Props, "node"> & { node: BlockNode }) {
  const spec = getBlockSpec(node.kind);
  const grouped = useMemo(() => {
    const out: Record<string, PropSpec[]> = {};
    if (!spec) return out;
    for (const p of spec.propsSpec) {
      const g = p.group ?? "Contenido";
      if (!out[g]) out[g] = [];
      out[g]!.push(p);
    }
    return out;
  }, [spec]);

  if (!spec) return null;

  const Icon = lucide(spec.icon);

  function setProp(key: string, value: unknown) {
    onChange({ props: { ...node.props, [key]: value } });
  }

  function setHidden(bp: "mobile" | "tablet" | "desktop", v: boolean) {
    onChange({ hidden: { ...(node.hidden ?? {}), [bp]: v } });
  }

  function setAudience(rule: AudienceRule | undefined) {
    onChange({ audience: rule });
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-background/40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{spec.label}</div>
            <div className="truncate text-[11px] text-muted-foreground">{spec.kind}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Duplicar"
            title="Duplicar (⌘D)"
          >
            <Icons.Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Eliminar"
            title="Eliminar (Supr)"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-col">
        {GROUPS.map((g) =>
          grouped[g] ? (
            <Section key={g} title={g} defaultOpen={g === "Contenido"}>
              <div className="space-y-3 px-3 py-3">
                {grouped[g].map((p) => (
                  <PropEditor
                    key={p.key}
                    spec={spec}
                    prop={p}
                    value={node.props[p.key]}
                    setValue={(v) => setProp(p.key, v)}
                    symbols={symbols}
                    recentMedia={recentMedia}
                  />
                ))}
              </div>
            </Section>
          ) : null,
        )}

        <Section title="Visibilidad" defaultOpen={false}>
          <div className="space-y-2 px-3 py-3">
            {(["desktop", "tablet", "mobile"] as const).map((bp) => (
              <div
                key={bp}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm capitalize">{bp}</span>
                <Switch checked={!node.hidden?.[bp]} onCheckedChange={(v) => setHidden(bp, !v)} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Audiencia" defaultOpen={false}>
          <AudienceEditor value={node.audience} onChange={setAudience} />
        </Section>
      </div>
    </aside>
  );
}

function AudienceEditor({
  value,
  onChange,
}: {
  value: AudienceRule | undefined;
  onChange: (rule: AudienceRule | undefined) => void;
}) {
  const enabled = !!value;
  const rule: AudienceRule = value ?? {};

  function patch(p: Partial<AudienceRule>) {
    onChange({ ...rule, ...p });
  }

  function csvToList(s: string): string[] {
    return s
      .split(/[,\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return (
    <div className="space-y-3 px-3 py-3 text-sm">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
        <div>
          <div className="font-medium">Personalización</div>
          <p className="text-[11px] text-muted-foreground">
            {enabled ? describeAudience(rule) : "Visible para todos los visitantes"}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange(v ? { mode: "show" } : undefined)}
        />
      </div>

      {enabled ? (
        <>
          <div>
            <Label>Modo</Label>
            <select
              value={rule.mode ?? "show"}
              onChange={(e) => patch({ mode: e.target.value as "show" | "hide" })}
              className="mt-1 h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="show">Mostrar si matchea</option>
              <option value="hide">Ocultar si matchea</option>
            </select>
          </div>

          <div>
            <Label>Países (códigos ISO ES,US,MX…)</Label>
            <Input
              value={(rule.countries ?? []).join(",")}
              onChange={(e) =>
                patch({
                  countries: csvToList(e.target.value).map((c) => c.toUpperCase()),
                })
              }
              placeholder="ES,MX,US"
              className="mt-1 h-9"
            />
          </div>

          <div>
            <Label>Dispositivos</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["mobile", "tablet", "desktop", "bot"] as const).map((d) => (
                <label
                  key={d}
                  className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={(rule.devices ?? []).includes(d)}
                    onChange={(e) => {
                      const cur = new Set(rule.devices ?? []);
                      if (e.target.checked) cur.add(d);
                      else cur.delete(d);
                      patch({ devices: Array.from(cur) });
                    }}
                  />
                  <span className="capitalize">{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Estado del miembro</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["guest", "member", "active"] as const).map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={(rule.memberState ?? []).includes(s)}
                    onChange={(e) => {
                      const cur = new Set(rule.memberState ?? []);
                      if (e.target.checked) cur.add(s);
                      else cur.delete(s);
                      patch({ memberState: Array.from(cur) });
                    }}
                  />
                  <span>{s === "guest" ? "Invitado" : s === "member" ? "Loguead@" : "Activo"}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>UTM source (separados por coma)</Label>
            <Input
              value={(rule.utmSource ?? []).join(",")}
              onChange={(e) => patch({ utmSource: csvToList(e.target.value) })}
              className="mt-1 h-9"
              placeholder="newsletter,twitter"
            />
          </div>
          <div>
            <Label>UTM medium</Label>
            <Input
              value={(rule.utmMedium ?? []).join(",")}
              onChange={(e) => patch({ utmMedium: csvToList(e.target.value) })}
              className="mt-1 h-9"
              placeholder="email,social"
            />
          </div>
          <div>
            <Label>UTM campaign</Label>
            <Input
              value={(rule.utmCampaign ?? []).join(",")}
              onChange={(e) => patch({ utmCampaign: csvToList(e.target.value) })}
              className="mt-1 h-9"
              placeholder="black-friday"
            />
          </div>

          <div>
            <Label>IDs de tier (separados por coma)</Label>
            <Textarea
              value={(rule.memberTierIds ?? []).join(",")}
              onChange={(e) => patch({ memberTierIds: csvToList(e.target.value) })}
              className="mt-1 text-xs font-mono"
              rows={2}
              placeholder="uuid-tier-1,uuid-tier-2"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:bg-muted/30"
      >
        {title}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div>{children}</div> : null}
    </div>
  );
}

function PropEditor({
  spec,
  prop,
  value,
  setValue,
  symbols,
  recentMedia,
}: {
  spec: BlockSpec;
  prop: PropSpec;
  value: unknown;
  setValue: (v: unknown) => void;
  symbols: { id: string; name: string }[];
  recentMedia: { id: string; url: string; alt: string | null; mime: string }[];
}) {
  switch (prop.kind) {
    case "text":
      return (
        <Field label={prop.label} description={prop.description}>
          <Input
            value={asString(value)}
            onChange={(e) => setValue(e.target.value)}
            placeholder={prop.label}
            className="h-9"
          />
        </Field>
      );
    case "longtext":
    case "rich":
      return (
        <Field label={prop.label} description={prop.description}>
          <Textarea
            value={asString(value)}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            className="text-sm"
          />
        </Field>
      );
    case "url":
      return (
        <Field label={prop.label} description={prop.description}>
          <Input
            value={asString(value)}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…"
            className="h-9"
          />
        </Field>
      );
    case "number":
      return (
        <Field label={prop.label} description={prop.description}>
          <Input
            type="number"
            value={typeof value === "number" ? value : Number(value) || 0}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-9"
          />
        </Field>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm">{prop.label}</span>
          <Switch checked={Boolean(value)} onCheckedChange={setValue} />
        </div>
      );
    case "color":
      return (
        <Field label={prop.label} description={prop.description}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hexFromAny(value) ?? "#000000"}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={asString(value)}
              onChange={(e) => setValue(e.target.value)}
              placeholder="#000 / oklch(...) / transparent"
              className="h-9 flex-1 text-xs"
            />
          </div>
        </Field>
      );
    case "align":
      return (
        <Field label={prop.label}>
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            {(["left", "center", "right"] as const).map((a) => {
              const active = value === a;
              const Icon =
                a === "left"
                  ? Icons.AlignLeft
                  : a === "center"
                    ? Icons.AlignCenter
                    : Icons.AlignRight;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setValue(a)}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-md py-1.5",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        </Field>
      );
    case "select":
      return (
        <Field label={prop.label} description={prop.description}>
          {prop.key === "symbolId" && spec.kind === "symbol" ? (
            <Select value={asString(value)} onChange={(e) => setValue(e.target.value)}>
              <option value="">— elige símbolo —</option>
              {symbols.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <Select value={asString(value)} onChange={(e) => setValue(e.target.value)}>
              {(prop.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );
    case "spacing":
      return (
        <Field label={prop.label}>
          <Input
            value={asString(value)}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 text-xs"
          />
        </Field>
      );
    case "icon":
      return (
        <Field
          label={prop.label}
          description="Nombre de un icono lucide-react (Sparkles, Zap, Shield…)"
        >
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md border bg-muted/40 text-foreground/70">
              {(() => {
                const Cmp = lucide(asString(value));
                return <Cmp className="size-4" />;
              })()}
            </div>
            <Input
              value={asString(value)}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 flex-1"
            />
          </div>
        </Field>
      );
    case "image":
      return (
        <Field label={prop.label}>
          <ImagePicker selected={asString(value)} onChange={setValue} recentMedia={recentMedia} />
        </Field>
      );
    case "items": {
      const arr = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
      return (
        <ItemsEditor
          label={prop.label}
          items={arr}
          itemSpec={prop.itemSpec ?? []}
          itemDefault={prop.itemDefault ?? {}}
          onChange={setValue}
          symbols={symbols}
          recentMedia={recentMedia}
        />
      );
    }
    default:
      return null;
  }
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {description ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function ImagePicker({
  selected,
  onChange,
  recentMedia,
}: {
  selected: string;
  onChange: (id: string | null) => void;
  recentMedia: { id: string; url: string; alt: string | null; mime: string }[];
}) {
  const [open, setOpen] = useState(false);
  const current = recentMedia.find((m) => m.id === selected);
  const images = recentMedia.filter((m) => m.mime.startsWith("image/"));
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/30 transition-colors",
          current && "border-solid border-border bg-transparent",
        )}
      >
        {current ? (
          <img src={current.url} alt={current.alt ?? ""} className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <Icons.Image className="size-4" />
            Elegir imagen
          </div>
        )}
      </button>
      {selected ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[11px] text-destructive underline-offset-2 hover:underline"
        >
          Quitar imagen
        </button>
      ) : null}
      {open ? (
        <div className="rounded-lg border bg-background p-2">
          {images.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
              No hay imágenes en el DAM. Sube alguna desde Medios.
            </p>
          ) : (
            <div className="grid max-h-60 grid-cols-3 gap-1.5 overflow-y-auto">
              {images.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "aspect-square overflow-hidden rounded-md border-2 transition-all",
                    m.id === selected
                      ? "border-primary"
                      : "border-transparent hover:border-foreground/20",
                  )}
                >
                  <img src={m.url} alt={m.alt ?? ""} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ItemsEditor({
  label,
  items,
  itemSpec,
  itemDefault,
  onChange,
  symbols,
  recentMedia,
}: {
  label: string;
  items: Array<Record<string, unknown>>;
  itemSpec: PropSpec[];
  itemDefault: Record<string, unknown>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  symbols: { id: string; name: string }[];
  recentMedia: { id: string; url: string; alt: string | null; mime: string }[];
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  function setItem(i: number, patch: Record<string, unknown>) {
    const next = [...items];
    next[i] = { ...(next[i] ?? {}), ...patch };
    onChange(next);
  }
  function move(from: number, to: number) {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <ul className="space-y-1.5">
        {items.map((it, i) => {
          const titleField = itemSpec.find((s) => s.kind === "text") ?? itemSpec[0];
          const title = titleField ? String(it[titleField.key] ?? "") : "";
          const open = openIdx === i;
          return (
            <li key={`item-${i}-${title.slice(0, 8)}`} className="rounded-lg border bg-muted/20">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  className="cursor-grab text-muted-foreground"
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Reordenar"
                >
                  <GripVertical className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex-1 truncate text-left text-xs"
                >
                  {title || `Elemento ${i + 1}`}
                </button>
                <div className="flex items-center gap-0.5">
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icons.ChevronUp className="size-3" />
                    </button>
                  ) : null}
                  {i < items.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icons.ChevronDown className="size-3" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
              {open ? (
                <div className="space-y-2 border-t bg-background/50 px-3 py-3">
                  {itemSpec.map((sp) => (
                    <PropEditor
                      key={sp.key}
                      spec={{ kind: "" } as BlockSpec}
                      prop={{ ...sp, group: undefined }}
                      value={it[sp.key]}
                      setValue={(v) => setItem(i, { [sp.key]: v })}
                      symbols={symbols}
                      recentMedia={recentMedia}
                    />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { ...itemDefault }])}
      >
        <Plus className="size-3.5" /> Añadir
      </Button>
    </div>
  );
}

function lucide(name: string) {
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[name];
  return Cmp ?? Icons.Square;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function hexFromAny(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^#([0-9a-fA-F]{6})$/);
  if (m) return v;
  const m3 = v.match(/^#([0-9a-fA-F]{3})$/);
  if (m3) {
    const r = m3[1]!;
    return `#${r[0]}${r[0]}${r[1]}${r[1]}${r[2]}${r[2]}`;
  }
  return null;
}
