/**
 * Rules engine para segments de newsletter. Definimos un mini-DSL JSON con
 * `all`/`any` (AND/OR) recursivo, y evaluamos en memoria contra subscribers
 * cargados de DB (con membership opcional vía join). Para v1 con catálogos
 * típicos (≤10k subs) esto rinde de sobra; en F8b/F8c podemos compilar a SQL
 * si crece.
 */

import { z } from "zod";

export const SEGMENT_FIELDS = [
  "status",
  "locale",
  "tag",
  "source",
  "email",
  "name",
  "createdAt",
  "confirmedAt",
  "lastOpenAt",
  "lastClickAt",
  "bounceCount",
  "hasMembership",
  "tier",
] as const;
export type SegmentField = (typeof SEGMENT_FIELDS)[number];

export const SEGMENT_OPS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
  "before",
  "after",
  "in_last_days",
  "not_in_last_days",
  "is_set",
  "is_not_set",
  "gt",
  "lt",
  "gte",
  "lte",
] as const;
export type SegmentOp = (typeof SEGMENT_OPS)[number];

const ConditionSchema = z.object({
  field: z.enum(SEGMENT_FIELDS),
  op: z.enum(SEGMENT_OPS),
  value: z.unknown().optional(),
});
export type SegmentCondition = z.infer<typeof ConditionSchema>;

export const SegmentRuleSchema: z.ZodType<SegmentRule> = z.lazy(() =>
  z.union([
    ConditionSchema,
    z.object({ all: z.array(SegmentRuleSchema).max(50) }),
    z.object({ any: z.array(SegmentRuleSchema).max(50) }),
    z.object({ not: SegmentRuleSchema }),
  ]),
);
export type SegmentRule =
  | SegmentCondition
  | { all: SegmentRule[] }
  | { any: SegmentRule[] }
  | { not: SegmentRule };

// Forma serializable que guarda `segments.rules` jsonb.
export type SegmentRulesPayload = SegmentRule | null;

// ============================================================
// Subject de evaluación: el subscriber con extras opcionales.
// ============================================================
export type SegmentSubject = {
  status: string | null;
  locale: string | null;
  tags: string[] | null;
  source: string | null;
  email: string;
  name: string | null;
  createdAt: Date | string | null;
  confirmedAt: Date | string | null;
  lastOpenAt: Date | string | null;
  lastClickAt: Date | string | null;
  bounceCount: number | null;
  hasMembership?: boolean;
  membershipTier?: string | null;
};

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function getSubjectValue(subject: SegmentSubject, field: SegmentField): unknown {
  switch (field) {
    case "status":
      return subject.status;
    case "locale":
      return subject.locale;
    case "tag":
      return subject.tags ?? [];
    case "source":
      return subject.source;
    case "email":
      return subject.email;
    case "name":
      return subject.name;
    case "createdAt":
      return subject.createdAt;
    case "confirmedAt":
      return subject.confirmedAt;
    case "lastOpenAt":
      return subject.lastOpenAt;
    case "lastClickAt":
      return subject.lastClickAt;
    case "bounceCount":
      return subject.bounceCount;
    case "hasMembership":
      return !!subject.hasMembership;
    case "tier":
      return subject.membershipTier;
    default:
      return null;
  }
}

function evalCondition(subject: SegmentSubject, c: SegmentCondition): boolean {
  const left = getSubjectValue(subject, c.field);
  const right = c.value;

  switch (c.op) {
    case "is_set":
      return !(left === null || left === undefined || left === "");
    case "is_not_set":
      return left === null || left === undefined || left === "";
    case "eq":
      return Array.isArray(left) ? left.includes(right) : left === right;
    case "neq":
      return Array.isArray(left) ? !left.includes(right) : left !== right;
    case "in": {
      const arr = Array.isArray(right) ? right : [];
      if (Array.isArray(left)) return left.some((v) => arr.includes(v));
      return arr.includes(left);
    }
    case "not_in": {
      const arr = Array.isArray(right) ? right : [];
      if (Array.isArray(left)) return !left.some((v) => arr.includes(v));
      return !arr.includes(left);
    }
    case "contains":
      return typeof left === "string" && typeof right === "string"
        ? left.toLowerCase().includes(right.toLowerCase())
        : false;
    case "starts_with":
      return typeof left === "string" && typeof right === "string"
        ? left.toLowerCase().startsWith(right.toLowerCase())
        : false;
    case "ends_with":
      return typeof left === "string" && typeof right === "string"
        ? left.toLowerCase().endsWith(right.toLowerCase())
        : false;
    case "before": {
      const ld = asDate(left);
      const rd = asDate(right);
      return !!ld && !!rd && ld.getTime() < rd.getTime();
    }
    case "after": {
      const ld = asDate(left);
      const rd = asDate(right);
      return !!ld && !!rd && ld.getTime() > rd.getTime();
    }
    case "in_last_days": {
      const ld = asDate(left);
      const days = asNumber(right);
      if (!ld || days === null) return false;
      return ld.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
    }
    case "not_in_last_days": {
      const ld = asDate(left);
      const days = asNumber(right);
      if (!ld || days === null) return true; // sin fecha = nunca, así que cumple
      return ld.getTime() < Date.now() - days * 24 * 60 * 60 * 1000;
    }
    case "gt": {
      const a = asNumber(left);
      const b = asNumber(right);
      return a !== null && b !== null && a > b;
    }
    case "lt": {
      const a = asNumber(left);
      const b = asNumber(right);
      return a !== null && b !== null && a < b;
    }
    case "gte": {
      const a = asNumber(left);
      const b = asNumber(right);
      return a !== null && b !== null && a >= b;
    }
    case "lte": {
      const a = asNumber(left);
      const b = asNumber(right);
      return a !== null && b !== null && a <= b;
    }
    default:
      return false;
  }
}

export function matchesRule(subject: SegmentSubject, rule: SegmentRulesPayload): boolean {
  if (!rule) return true; // sin reglas = todos
  if ("field" in rule) return evalCondition(subject, rule);
  if ("all" in rule) return rule.all.every((r) => matchesRule(subject, r));
  if ("any" in rule) return rule.any.some((r) => matchesRule(subject, r));
  if ("not" in rule) return !matchesRule(subject, rule.not);
  return false;
}

export function validateRule(
  input: unknown,
): { ok: true; rule: SegmentRulesPayload } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, rule: null };
  const parsed = SegmentRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Regla inválida" };
  }
  return { ok: true, rule: parsed.data };
}

/**
 * Helper para describir reglas en UI.
 */
export const FIELD_LABELS: Record<SegmentField, string> = {
  status: "Estado",
  locale: "Idioma",
  tag: "Etiqueta",
  source: "Origen",
  email: "Email",
  name: "Nombre",
  createdAt: "Fecha de alta",
  confirmedAt: "Fecha de confirmación",
  lastOpenAt: "Última apertura",
  lastClickAt: "Último click",
  bounceCount: "Rebotes",
  hasMembership: "Tiene membresía",
  tier: "Nivel de membresía",
};

export const OP_LABELS: Record<SegmentOp, string> = {
  eq: "es igual a",
  neq: "no es igual a",
  in: "es uno de",
  not_in: "no es uno de",
  contains: "contiene",
  starts_with: "empieza por",
  ends_with: "termina en",
  before: "antes de",
  after: "después de",
  in_last_days: "en los últimos N días",
  not_in_last_days: "no en los últimos N días",
  is_set: "está definido",
  is_not_set: "no está definido",
  gt: "mayor que",
  lt: "menor que",
  gte: "mayor o igual",
  lte: "menor o igual",
};
