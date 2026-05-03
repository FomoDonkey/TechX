/**
 * Persisted queries via allowlist.
 *
 * El cliente envía `{ persistedQuery: { sha256: "..." }, variables }`. Si el hash
 * está en el allowlist, ejecutamos esa query. Si no, devolvemos PERSISTED_QUERY_NOT_FOUND
 * y el cliente reintenta enviando el query completo.
 *
 * Cuando `CSM_GRAPHQL_PERSISTED_ONLY=1`, queries no-persistidas son rechazadas
 * (modo producción estricto). Por defecto (dev), aceptamos ambas.
 */

import { createHash } from "node:crypto";

const allowlist = new Map<string, string>();

export function persistQuery(query: string): string {
  const hash = createHash("sha256").update(query).digest("hex");
  allowlist.set(hash, query);
  return hash;
}

export function getPersistedQuery(hash: string): string | null {
  return allowlist.get(hash) ?? null;
}

export function isPersistedOnly(): boolean {
  return process.env.CSM_GRAPHQL_PERSISTED_ONLY === "1";
}

export function listPersistedHashes(): string[] {
  return [...allowlist.keys()];
}

/**
 * Hidrata el allowlist desde una lista pre-built. Útil para CI: el dev exporta
 * sus queries con `csm gen graphql-persist` y commitea el JSON.
 */
export function loadAllowlist(entries: Array<{ hash: string; query: string }>): void {
  for (const e of entries) allowlist.set(e.hash, e.query);
}
