/**
 * Sistema de tipos de campo para colecciones custom (Sanity-style).
 * Define qué campos puede tener una colección, cómo se valida, cómo se renderiza
 * en el form admin y cómo se serializa a JSON. Es la fuente de verdad: tanto el
 * builder UI como el form generator y el render público leen del mismo registry.
 */

import { z } from "zod";

export const FIELD_KIND_VALUES = [
  "text",
  "longtext",
  "rich",
  "number",
  "boolean",
  "date",
  "datetime",
  "image",
  "gallery",
  "ref",
  "repeater",
  "json",
  "select",
  "multiselect",
  "color",
  "geo",
  "url",
  "email",
  "slug",
  "markdown",
] as const;

export type FieldKind = (typeof FIELD_KIND_VALUES)[number];

export type FieldOption = { value: string; label: string };

export type FieldDef = {
  /** ID estable interno; se mantiene aunque se renombre la key. */
  id: string;
  /** Clave usada en `entry.fields[key]`. Slug-style. */
  key: string;
  /** Nombre humano, ES. */
  label: string;
  kind: FieldKind;
  description?: string;
  required?: boolean;
  unique?: boolean;
  /** Para text/longtext */
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /** Para number */
  min?: number;
  max?: number;
  step?: number;
  /** Para select/multiselect */
  options?: FieldOption[];
  /** Para ref → slug de colección referenciada */
  refCollection?: string;
  /** Para repeater → fields anidados */
  itemFields?: FieldDef[];
  /** Default value (acepta cualquier JSON) */
  defaultValue?: unknown;
  /** Mostrar en list view por defecto */
  showInList?: boolean;
};

export type CollectionSchema = {
  fields: FieldDef[];
  /** Campo cuyo valor se muestra como título en el list view (key). */
  titleField?: string;
};

export const EMPTY_COLLECTION_SCHEMA: CollectionSchema = { fields: [] };

// --------------------------------------------------------
// Catálogo de tipos: metadata para el palette del builder
// --------------------------------------------------------
export type FieldKindMeta = {
  kind: FieldKind;
  label: string;
  group: "Texto" | "Número y fecha" | "Multimedia" | "Estructura" | "Selección" | "Especial";
  icon: string; // nombre de lucide-react
  description: string;
};

export const FIELD_KIND_CATALOG: FieldKindMeta[] = [
  {
    kind: "text",
    label: "Texto corto",
    group: "Texto",
    icon: "Type",
    description: "Una línea (título, nombre, etiqueta)",
  },
  {
    kind: "longtext",
    label: "Texto largo",
    group: "Texto",
    icon: "AlignLeft",
    description: "Varias líneas sin formato (descripción, bio)",
  },
  {
    kind: "rich",
    label: "Texto enriquecido",
    group: "Texto",
    icon: "BookText",
    description: "Editor Tiptap completo (cuerpo del post)",
  },
  {
    kind: "markdown",
    label: "Markdown",
    group: "Texto",
    icon: "Code",
    description: "Texto Markdown plano",
  },
  {
    kind: "slug",
    label: "Slug",
    group: "Texto",
    icon: "Link2",
    description: "URL-friendly, único",
  },
  { kind: "url", label: "URL", group: "Texto", icon: "Globe", description: "Enlace externo" },
  {
    kind: "email",
    label: "Email",
    group: "Texto",
    icon: "Mail",
    description: "Dirección de correo",
  },

  {
    kind: "number",
    label: "Número",
    group: "Número y fecha",
    icon: "Hash",
    description: "Entero o decimal",
  },
  {
    kind: "boolean",
    label: "Sí/No",
    group: "Número y fecha",
    icon: "ToggleLeft",
    description: "Booleano (toggle)",
  },
  {
    kind: "date",
    label: "Fecha",
    group: "Número y fecha",
    icon: "Calendar",
    description: "Solo fecha (YYYY-MM-DD)",
  },
  {
    kind: "datetime",
    label: "Fecha y hora",
    group: "Número y fecha",
    icon: "Clock",
    description: "ISO completo con hora",
  },

  {
    kind: "image",
    label: "Imagen",
    group: "Multimedia",
    icon: "Image",
    description: "Una imagen del DAM",
  },
  {
    kind: "gallery",
    label: "Galería",
    group: "Multimedia",
    icon: "Images",
    description: "Varias imágenes",
  },

  {
    kind: "ref",
    label: "Referencia",
    group: "Estructura",
    icon: "Link",
    description: "Apunta a una entry de otra colección",
  },
  {
    kind: "repeater",
    label: "Repetidor",
    group: "Estructura",
    icon: "Repeat",
    description: "Lista de objetos con sub-campos",
  },
  {
    kind: "json",
    label: "JSON crudo",
    group: "Estructura",
    icon: "Braces",
    description: "Cualquier estructura JSON libre",
  },

  {
    kind: "select",
    label: "Lista (1)",
    group: "Selección",
    icon: "List",
    description: "Una opción de varias",
  },
  {
    kind: "multiselect",
    label: "Lista (varias)",
    group: "Selección",
    icon: "ListChecks",
    description: "Múltiples opciones",
  },

  {
    kind: "color",
    label: "Color",
    group: "Especial",
    icon: "Palette",
    description: "Hex (#rrggbb) o OKLCH",
  },
  {
    kind: "geo",
    label: "Geolocalización",
    group: "Especial",
    icon: "MapPin",
    description: "Lat/Lng",
  },
];

// --------------------------------------------------------
// Default value por tipo
// --------------------------------------------------------
export function defaultValueFor(field: FieldDef): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.kind) {
    case "text":
    case "longtext":
    case "markdown":
    case "slug":
    case "url":
    case "email":
    case "color":
      return "";
    case "rich":
      return { type: "doc", content: [{ type: "paragraph" }] };
    case "number":
      return null;
    case "boolean":
      return false;
    case "date":
    case "datetime":
      return null;
    case "image":
      return null;
    case "gallery":
      return [];
    case "ref":
      return null;
    case "repeater":
      return [];
    case "json":
      return {};
    case "select":
      return field.options?.[0]?.value ?? "";
    case "multiselect":
      return [];
    case "geo":
      return null;
    default:
      return null;
  }
}

// --------------------------------------------------------
// Build Zod schema desde definición runtime
// --------------------------------------------------------
function colorRegex() {
  return /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|oklch\(.+\))$/;
}

export function buildFieldZod(field: FieldDef): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  switch (field.kind) {
    case "text":
    case "longtext":
    case "markdown": {
      let str = z.string();
      if (field.minLength) str = str.min(field.minLength, `Mínimo ${field.minLength}`);
      if (field.maxLength) str = str.max(field.maxLength, `Máximo ${field.maxLength}`);
      s = str;
      break;
    }
    case "slug":
      s = z
        .string()
        .min(1, "Requerido")
        .max(96)
        .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones");
      break;
    case "url":
      s = z.string().url("URL inválida");
      break;
    case "email":
      s = z.string().email("Email inválido");
      break;
    case "rich":
      s = z
        .object({ type: z.literal("doc"), content: z.array(z.unknown()).default([]) })
        .passthrough();
      break;
    case "number": {
      let n: z.ZodTypeAny = z.number({ invalid_type_error: "Número requerido" });
      if (typeof field.min === "number") n = (n as z.ZodNumber).min(field.min);
      if (typeof field.max === "number") n = (n as z.ZodNumber).max(field.max);
      s = n;
      break;
    }
    case "boolean":
      s = z.boolean();
      break;
    case "date":
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");
      break;
    case "datetime":
      s = z.string().datetime({ message: "Fecha-hora ISO inválida" });
      break;
    case "image":
      s = z.string().uuid("Selecciona una imagen del DAM");
      break;
    case "gallery":
      s = z.array(z.string().uuid()).max(50);
      break;
    case "ref":
      s = z.string().uuid();
      break;
    case "repeater": {
      const itemSchema = field.itemFields?.length
        ? buildEntryFieldsZod({ fields: field.itemFields })
        : z.record(z.unknown());
      s = z.array(itemSchema).max(200);
      break;
    }
    case "json":
      s = z.unknown();
      break;
    case "select": {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length === 0) {
        s = z.string();
      } else {
        const head = values[0];
        if (!head) {
          s = z.string();
        } else {
          // z.enum requiere tupla no vacía
          s = z.enum([head, ...values.slice(1)] as [string, ...string[]]);
        }
      }
      break;
    }
    case "multiselect": {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length === 0) {
        s = z.array(z.string());
      } else {
        const head = values[0];
        if (!head) {
          s = z.array(z.string());
        } else {
          s = z.array(z.enum([head, ...values.slice(1)] as [string, ...string[]]));
        }
      }
      break;
    }
    case "color":
      s = z.string().regex(colorRegex(), "Color hex (#rrggbb) u OKLCH(...)");
      break;
    case "geo":
      s = z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      });
      break;
    default:
      s = z.unknown();
  }
  return field.required ? s : s.nullable().optional();
}

/**
 * Compone un Zod schema para `entry.fields` desde una CollectionSchema.
 * Se usa al guardar entries: valida server-side antes del UPDATE.
 */
export function buildEntryFieldsZod(schema: CollectionSchema): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const f of schema.fields) {
    shape[f.key] = buildFieldZod(f);
  }
  return z.object(shape).passthrough();
}

/** Valor inicial para un entry nuevo de la colección */
export function initialFieldsValues(schema: CollectionSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    out[f.key] = defaultValueFor(f);
  }
  return out;
}

// --------------------------------------------------------
// Validación de la propia definición (al guardar el schema desde el builder)
// --------------------------------------------------------
const fieldDefBaseSchema = z.object({
  id: z.string().min(1),
  key: z
    .string()
    .min(1, "Requerido")
    .max(48)
    .regex(/^[a-z][a-z0-9_]*$/i, "Solo letras, números y _ (empieza con letra)"),
  label: z.string().min(1, "Requerido").max(80),
  kind: z.enum(FIELD_KIND_VALUES),
  description: z.string().max(240).optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  placeholder: z.string().max(120).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  options: z
    .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
    .max(64)
    .optional(),
  refCollection: z.string().min(1).max(64).optional(),
  defaultValue: z.unknown().optional(),
  showInList: z.boolean().optional(),
});

// Recursivo: itemFields de repeater referencia el mismo schema (sin nesting infinito).
type FieldDefSchemaType = z.ZodType<FieldDef>;
export const fieldDefSchema: FieldDefSchemaType = fieldDefBaseSchema.extend({
  itemFields: z.lazy(() => z.array(fieldDefSchema).max(40).optional()),
}) as unknown as FieldDefSchemaType;

export const collectionSchemaSchema = z
  .object({
    fields: z.array(fieldDefSchema).max(80),
    titleField: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const [i, f] of val.fields.entries()) {
      const k = f.key.toLowerCase();
      if (seen.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", i, "key"],
          message: `Clave duplicada "${f.key}"`,
        });
      }
      seen.add(k);
    }
  });

export function isCollectionSchema(input: unknown): input is CollectionSchema {
  return collectionSchemaSchema.safeParse(input).success;
}

export function readCollectionSchema(raw: unknown): CollectionSchema {
  if (!raw) return EMPTY_COLLECTION_SCHEMA;
  const parsed = collectionSchemaSchema.safeParse(raw);
  if (parsed.success) {
    // strip superRefine extras
    return { fields: parsed.data.fields, titleField: parsed.data.titleField };
  }
  return EMPTY_COLLECTION_SCHEMA;
}
