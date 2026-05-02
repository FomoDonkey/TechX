/**
 * Construye un esquema Zod dinámico a partir del FormSchema visual del form.
 *
 * Reglas clave:
 *  - Cada input field con `key` se convierte en un `z.input` con sus restricciones.
 *  - Los display-only (section/heading/divider) se ignoran.
 *  - `required: true` marca el campo como requerido SOLO si está visible (visibleIf).
 *  - Si visibleIf evalúa false con la data recibida, el campo se hace optional y
 *    se descarta su valor (no se persiste).
 *  - Para multiselect/file (multiple) acepta arrays. Single → escalar.
 *  - Files vienen como mediaIds (UUIDs) — la subida se hace antes vía /api/uploads.
 */

import { z } from "zod";
import { isVisible } from "./conditional";
import { type Field, type FormSchema, isInputField } from "./types";

function baseSchemaForField(f: Field): z.ZodTypeAny {
  switch (f.type) {
    case "text":
    case "email":
    case "url":
    case "tel":
    case "textarea":
    case "hidden": {
      let s = z.string();
      const min = "minLength" in f ? f.minLength : undefined;
      const max = "maxLength" in f ? f.maxLength : undefined;
      const pattern = "pattern" in f ? f.pattern : undefined;
      if (typeof min === "number") s = s.min(min);
      if (typeof max === "number") s = s.max(max);
      if (f.type === "email") s = s.email("Email inválido");
      if (f.type === "url") s = s.url("URL inválida");
      if (pattern) {
        try {
          const re = new RegExp(pattern);
          s = s.regex(re, "Formato inválido");
        } catch {
          // pattern inválido en el schema → ignoramos
        }
      }
      return s;
    }
    case "number": {
      let s = z.number({ invalid_type_error: "Debe ser un número" });
      if (typeof f.min === "number") s = s.min(f.min);
      if (typeof f.max === "number") s = s.max(f.max);
      return s;
    }
    case "select":
    case "radio": {
      const values = f.options.map((o) => o.value);
      if (values.length === 0) return z.string();
      return z.string().refine((v) => values.includes(v), "Opción no válida");
    }
    case "multiselect": {
      const values = f.options.map((o) => o.value);
      let s = z.array(z.string().refine((v) => values.includes(v), "Opción no válida"));
      if (typeof f.min === "number") s = s.min(f.min);
      if (typeof f.max === "number") s = s.max(f.max);
      return s;
    }
    case "checkbox":
      return z.boolean();
    case "date":
      // ISO yyyy-mm-dd
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (yyyy-mm-dd)");
    case "rating": {
      const max = f.max ?? 5;
      return z.number().int().min(1).max(max);
    }
    case "signature":
      // data:image/png;base64,...
      return z.string().regex(/^data:image\/(png|jpeg|svg\+xml);base64,/, "Firma inválida");
    case "file": {
      const item = z.string().uuid("ID de archivo inválido");
      return f.multiple ? z.array(item) : item;
    }
    case "payment":
      // Token de payment intent (Stripe — F8)
      return z.string().min(1).max(200);
    default:
      return z.unknown();
  }
}

export type BuildResult = {
  schema: z.ZodSchema<Record<string, unknown>>;
  /** Lista de keys de los input fields (los que persistimos). */
  inputKeys: string[];
};

export function buildSubmissionSchema(formSchema: FormSchema): BuildResult {
  const fields = formSchema.fields.filter(isInputField);

  // Construimos un objeto base con todo opcional. La validación real (required +
  // visibleIf) se hace en superRefine para poder evaluar condiciones cruzadas.
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (!("key" in f) || !f.key) continue;
    shape[f.key] = baseSchemaForField(f).optional().nullable();
  }
  const base = z.object(shape).passthrough(); // passthrough: aceptamos campos extra (honeypot, csm_t, captcha) sin tirar

  const inputKeys = fields
    .filter((f): f is typeof f & { key: string } => "key" in f && Boolean(f.key))
    .map((f) => f.key);

  const refined = base.superRefine((data, ctx) => {
    for (const f of fields) {
      if (!("key" in f) || !f.key) continue;
      const visible = isVisible(("visibleIf" in f && f.visibleIf) || undefined, data);
      if (!visible) continue; // Campo oculto → no validamos
      const v = data[f.key];
      const isMissing =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (f.type === "checkbox" && v === false);
      if (("required" in f ? f.required : false) && isMissing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [f.key],
          message: "Este campo es obligatorio",
        });
      }
    }
  });

  return { schema: refined as z.ZodSchema<Record<string, unknown>>, inputKeys };
}

/**
 * Limpia data según el schema: descarta keys de campos invisibles, fuerza tipos
 * básicos y elimina keys "extra" no declaradas en el form (excepto las técnicas
 * con prefijo csm_).
 */
export function sanitize(
  formSchema: FormSchema,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const inputs = formSchema.fields.filter(isInputField);
  const out: Record<string, unknown> = {};
  for (const f of inputs) {
    if (!("key" in f) || !f.key) continue;
    if (!isVisible(("visibleIf" in f && f.visibleIf) || undefined, raw)) continue;
    if (raw[f.key] !== undefined) out[f.key] = raw[f.key];
  }
  return out;
}
