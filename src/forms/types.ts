/**
 * Tipos del schema visual de un formulario.
 *
 * Un FormSchema es un JSON serializable que describe la estructura completa de
 * un formulario: paleta de campos, organización en steps, lógica condicional y
 * configuración. La UI del builder lo edita; el renderer público y el validador
 * lo consumen. Las plantillas se importan/exportan como FormSchema serializado.
 */

export type FieldKind =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "date"
  | "file"
  | "rating"
  | "signature"
  | "hidden"
  | "section"
  | "heading"
  | "divider"
  | "payment";

/** Operadores soportados por la lógica condicional (mostrar campo X si Y op Z). */
export type VisibleOp =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "contains"
  | "empty"
  | "not_empty"
  | "gt"
  | "lt";

export type VisibleClause = {
  fieldKey: string;
  op: VisibleOp;
  value?: unknown;
};

/** ALL = AND, ANY = OR. Puede combinarse: ALL aplicado sobre clauses, además ANY de grupos. */
export type VisibleCondition = {
  all?: VisibleClause[];
  any?: VisibleClause[];
};

export type SelectOption = { value: string; label: string };

type BaseField = {
  id: string;
  /** Identificador único del field dentro del form. Se usa como nombre del input y key del payload. */
  key: string;
  label: string;
  help?: string;
  required?: boolean;
  visibleIf?: VisibleCondition;
  /** Ancho en grid (1-3). Default 3 (full width). */
  cols?: 1 | 2 | 3;
};

export type TextField = BaseField & {
  type: "text" | "email" | "url" | "tel";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  defaultValue?: string;
};

export type TextAreaField = BaseField & {
  type: "textarea";
  placeholder?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
};

export type NumberField = BaseField & {
  type: "number";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
};

export type SelectField = BaseField & {
  type: "select";
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
};

export type MultiSelectField = BaseField & {
  type: "multiselect";
  options: SelectOption[];
  min?: number;
  max?: number;
  defaultValue?: string[];
};

export type CheckboxField = BaseField & {
  type: "checkbox";
  defaultValue?: boolean;
};

export type RadioField = BaseField & {
  type: "radio";
  options: SelectOption[];
  defaultValue?: string;
};

export type DateField = BaseField & {
  type: "date";
  /** ISO yyyy-mm-dd. */
  min?: string;
  max?: string;
};

export type FileField = BaseField & {
  type: "file";
  /** Lista de mime types. ["image/*", "application/pdf"]. */
  accept?: string[];
  /** En bytes. Default 5 MB. */
  maxSize?: number;
  multiple?: boolean;
};

export type RatingField = BaseField & {
  type: "rating";
  /** 1..max. Default 5. */
  max?: number;
  defaultValue?: number;
};

export type SignatureField = BaseField & {
  type: "signature";
};

export type HiddenField = BaseField & {
  type: "hidden";
  /** Valor literal o ${queryParam:utm_source} para tomar de URL. */
  value: string;
};

export type PaymentField = BaseField & {
  type: "payment";
  amountCents: number;
  currency?: string;
  /** Stub para F8 — render placeholder por ahora. */
};

export type SectionField = {
  id: string;
  type: "section";
  label: string;
};

export type HeadingField = {
  id: string;
  type: "heading";
  level?: 1 | 2 | 3;
  text: string;
};

export type DividerField = {
  id: string;
  type: "divider";
};

export type Field =
  | TextField
  | TextAreaField
  | NumberField
  | SelectField
  | MultiSelectField
  | CheckboxField
  | RadioField
  | DateField
  | FileField
  | RatingField
  | SignatureField
  | HiddenField
  | PaymentField
  | SectionField
  | HeadingField
  | DividerField;

export type FormStep = {
  id: string;
  title?: string;
  description?: string;
  fieldIds: string[];
};

export type FormSchema = {
  fields: Field[];
  /** Si vacío, todo el form es un solo step. */
  steps: FormStep[];
  successMessage?: string;
  redirectUrl?: string;
  submitLabel?: string;
};

export type FormSettings = {
  doubleOptIn?: boolean;
  /** Nombre del field honeypot — generado y estable por form (no visible en UI). */
  honeypotFieldName?: string;
  /** Tiempo mínimo (ms) entre carga del form y submit; bajo eso → spam. Default 1500. */
  minSubmitTimeMs?: number;
  captcha?: {
    provider: "hcaptcha" | "turnstile";
    siteKey: string;
  };
  storeIp?: boolean;
  /** CORS — origins permitidos para hacer POST cross-origin. ["*"] = público. */
  allowedOrigins?: string[];
  /** Rate limit por IP — defaults: 20/h, 100/24h. */
  perIpHourly?: number;
  perIpDaily?: number;
  /** Email opcional al submitter (si hay un field email detectado). */
  notifySubmitter?: { subject?: string; body?: string };
};

/** Helpers de runtime — guard de tipo discriminado. */
export function isInputField(
  f: Field,
): f is Exclude<Field, SectionField | HeadingField | DividerField> {
  return f.type !== "section" && f.type !== "heading" && f.type !== "divider";
}

export const DEFAULT_HONEYPOT_NAME = "csm_company"; // sólo usado si form no tiene uno propio
export const DEFAULT_MIN_SUBMIT_TIME_MS = 1500;
export const DEFAULT_FILE_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_PER_IP_HOURLY = 20;
export const DEFAULT_PER_IP_DAILY = 100;
