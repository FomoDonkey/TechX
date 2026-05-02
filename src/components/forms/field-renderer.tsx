"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isVisible } from "@/forms/conditional";
import type { Field } from "@/forms/types";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export type FieldRendererProps = {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  data: Record<string, unknown>;
  error?: string;
  disabled?: boolean;
};

/**
 * Renderiza un Field individual del schema. Honra visibleIf — si invisible,
 * devuelve null (caller puede verlo si quiere). Compartido entre builder
 * preview y renderer público.
 */
export function FieldRenderer(props: FieldRendererProps) {
  const { field, data } = props;
  // Display-only
  if (field.type === "section") {
    return (
      <div className="border-t pt-4 mt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {field.label}
        </p>
      </div>
    );
  }
  if (field.type === "heading") {
    const Tag = `h${field.level ?? 2}` as "h1" | "h2" | "h3";
    return <Tag className="mt-2 text-lg font-semibold">{field.text}</Tag>;
  }
  if (field.type === "divider") {
    return <hr className="my-3 border-border/40" />;
  }
  if (field.type === "hidden") return null;

  // Conditional logic
  const visibleCond = "visibleIf" in field ? field.visibleIf : undefined;
  if (!isVisible(visibleCond, data)) return null;

  return (
    <div className={cn("space-y-1.5", colsClass(("cols" in field && field.cols) || 3))}>
      <Label className="flex items-center gap-1 text-sm">
        {field.label}
        {"required" in field && field.required ? <span className="text-rose-500">*</span> : null}
      </Label>
      <FieldInput {...props} />
      {field.help ? <p className="text-[11px] text-muted-foreground">{field.help}</p> : null}
      {props.error ? <p className="text-[11px] text-rose-500">{props.error}</p> : null}
    </div>
  );
}

function colsClass(cols: 1 | 2 | 3) {
  if (cols === 1) return "col-span-1";
  if (cols === 2) return "col-span-2";
  return "col-span-3";
}

function FieldInput({ field, value, onChange, disabled }: FieldRendererProps) {
  switch (field.type) {
    case "text":
    case "email":
    case "url":
    case "tel": {
      const inputType =
        field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : field.type === "tel"
              ? "tel"
              : "text";
      return (
        <Input
          type={inputType}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          maxLength={"maxLength" in field ? field.maxLength : undefined}
          minLength={"minLength" in field ? field.minLength : undefined}
          disabled={disabled}
        />
      );
    }
    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows ?? 4}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value === undefined || value === null || value === "" ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
    case "select":
      return (
        <select
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        >
          <option value="">{field.placeholder ?? "Selecciona..."}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const selected = (value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value])
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  checked
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 hover:border-border",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    case "radio":
      return (
        <div className="space-y-1">
          {field.options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.key}
                value={o.value}
                checked={value === o.value}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          min={field.min}
          max={field.max}
          disabled={disabled}
        />
      );
    case "rating": {
      const max = field.max ?? 5;
      const current = Number(value) || 0;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => {
            const idx = i + 1;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(idx)}
                disabled={disabled}
                className="text-amber-500 hover:scale-110 transition-transform"
                aria-label={`${idx} de ${max}`}
              >
                <Star
                  className={cn("size-6", idx <= current ? "fill-current" : "fill-transparent")}
                />
              </button>
            );
          })}
        </div>
      );
    }
    case "signature":
      return (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          🖊 Firma — el componente real necesita un canvas. Por ahora pega un PNG base64.
          <Input
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="data:image/png;base64,..."
            className="mt-2 font-mono text-[10px]"
            disabled={disabled}
          />
        </div>
      );
    case "file":
      return (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          📎 Archivo — sube primero a /api/uploads y pasa el mediaId aquí.
          <Input
            value={Array.isArray(value) ? value.join(", ") : ((value as string) ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (field.multiple) {
                onChange(
                  v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                );
              } else onChange(v.trim() || null);
            }}
            placeholder="UUID del media subido"
            className="mt-2 font-mono text-[10px]"
            disabled={disabled}
          />
        </div>
      );
    case "payment":
      return (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          💳 Pago — disponible en Fase 8 (Stripe).
        </div>
      );
    default:
      return null;
  }
}

/** Devuelve los defaultValues iniciales para un FormSchema. */
export function buildDefaultValues(fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!("key" in f) || !f.key) continue;
    if ("defaultValue" in f && f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    else if (f.type === "multiselect") out[f.key] = [];
    else if (f.type === "checkbox") out[f.key] = false;
    else out[f.key] = "";
  }
  return out;
}
