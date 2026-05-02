/**
 * Interpolación de templates `{{path}}` en strings.
 *
 * Soporta:
 *   {{trigger.payload.foo.bar}}
 *   {{steps.0.output.id}}
 *   {{steps[0].output.id}}    (igual)
 *   {{env.NOW}}               (timestamp ISO)
 *
 * Es defensivo: si el path no existe, devuelve "" (no rompe el step).
 * NO ejecuta JS — solo lookup de paths. Sin acceso a globalThis.
 */

export type RenderContext = {
  trigger: { event: string; payload: unknown };
  steps: Array<{ output?: unknown }>;
  env?: Record<string, string>;
};

const TPL_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    // Bloqueamos prototype pollution: __proto__, constructor, prototype.
    if (p === "__proto__" || p === "constructor" || p === "prototype") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function renderTemplate(input: string, ctx: RenderContext): string {
  if (!input) return "";
  return input.replace(TPL_RE, (_match, expr: string) => {
    const root = expr.split(/[.[]/, 1)[0];
    let value: unknown;
    switch (root) {
      case "trigger":
      case "steps":
      case "env":
        value = getByPath(ctx, expr);
        break;
      default:
        value = "";
    }
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  });
}

export function renderObject<T>(obj: T, ctx: RenderContext): T {
  if (typeof obj === "string") return renderTemplate(obj, ctx) as unknown as T;
  if (Array.isArray(obj)) return obj.map((x) => renderObject(x, ctx)) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = renderObject(v, ctx);
    }
    return out as T;
  }
  return obj;
}

/** Evalúa una condition contra el contexto. */
export function evalCondition(
  cond: { path: string; op: string; value?: unknown },
  ctx: RenderContext,
): boolean {
  const v = getByPath(ctx, cond.path);
  switch (cond.op) {
    case "eq":
      return v === cond.value;
    case "neq":
      return v !== cond.value;
    case "gt":
      return typeof v === "number" && typeof cond.value === "number" && v > cond.value;
    case "lt":
      return typeof v === "number" && typeof cond.value === "number" && v < cond.value;
    case "contains":
      if (Array.isArray(v)) return v.includes(cond.value);
      if (typeof v === "string" && typeof cond.value === "string") return v.includes(cond.value);
      return false;
    case "empty":
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    case "not_empty":
      return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    case "in":
      return Array.isArray(cond.value) ? cond.value.includes(v) : false;
    default:
      return false;
  }
}

export function evalConditions(
  group:
    | {
        all?: Array<{ path: string; op: string; value?: unknown }>;
        any?: Array<{ path: string; op: string; value?: unknown }>;
      }
    | undefined,
  ctx: RenderContext,
): boolean {
  if (!group) return true;
  if (group.all && group.all.length > 0) {
    if (!group.all.every((c) => evalCondition(c, ctx))) return false;
  }
  if (group.any && group.any.length > 0) {
    if (!group.any.some((c) => evalCondition(c, ctx))) return false;
  }
  return true;
}
