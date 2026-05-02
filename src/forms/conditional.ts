/**
 * Evaluador de condiciones visibleIf.
 *
 * Soportado server-side (validación: campos invisibles NO son required) y
 * client-side (renderer: ocultarlos del DOM). Misma función para que ambos
 * coincidan exactamente.
 */

import type { VisibleClause, VisibleCondition } from "./types";

function evalClause(clause: VisibleClause, data: Record<string, unknown>): boolean {
  const v = data[clause.fieldKey];
  switch (clause.op) {
    case "eq":
      return v === clause.value;
    case "neq":
      return v !== clause.value;
    case "in":
      return Array.isArray(clause.value) ? clause.value.includes(v) : false;
    case "not_in":
      return Array.isArray(clause.value) ? !clause.value.includes(v) : true;
    case "contains":
      if (Array.isArray(v)) return v.includes(clause.value);
      if (typeof v === "string" && typeof clause.value === "string")
        return v.includes(clause.value);
      return false;
    case "empty":
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    case "not_empty":
      return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    case "gt":
      return typeof v === "number" && typeof clause.value === "number" && v > clause.value;
    case "lt":
      return typeof v === "number" && typeof clause.value === "number" && v < clause.value;
    default:
      return true;
  }
}

/**
 * Devuelve true si el field debería estar visible/activo según la condición.
 * Sin condición → siempre visible.
 */
export function isVisible(
  condition: VisibleCondition | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  if (condition.all && condition.all.length > 0) {
    if (!condition.all.every((c) => evalClause(c, data))) return false;
  }
  if (condition.any && condition.any.length > 0) {
    if (!condition.any.some((c) => evalClause(c, data))) return false;
  }
  return true;
}
