const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida formato de UUID v4-ish. Útil antes de pasar a queries Drizzle/postgres. */
export function isUuid(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  return UUID_RE.test(value);
}
