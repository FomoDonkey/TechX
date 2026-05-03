/**
 * Runtime helper para resolver redirects desde Server Components / handlers.
 *
 * Implementa una cache LRU en memoria por workspace con TTL de 60s. NO se usa
 * desde middleware (edge) para evitar cargar drizzle en el bundle edge — los
 * server components (catch-all, blog index, etc.) llaman `runRedirect()` antes
 * de renderizar. La latencia añadida es ~0 cuando hit cache.
 */

import { permanentRedirect, redirect } from "next/navigation";
import { incrementHits, listActiveRedirectsForWorkspace } from "./lib";
import { type RedirectRule, matchRedirect } from "./matcher";

interface CacheEntry {
  rules: RedirectRule[];
  expires: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 100;

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
}

export async function loadRulesForWorkspace(workspaceId: string): Promise<RedirectRule[]> {
  const now = Date.now();
  const cached = cache.get(workspaceId);
  if (cached && cached.expires > now) return cached.rules;
  const rules = await listActiveRedirectsForWorkspace(workspaceId);
  cache.set(workspaceId, { rules, expires: now + TTL_MS });
  evictIfNeeded();
  return rules;
}

export function invalidateRedirectsCache(workspaceId?: string): void {
  if (workspaceId) cache.delete(workspaceId);
  else cache.clear();
}

/**
 * Resuelve workspace por host. Prioridad:
 *   1. workspaces.custom_domain == host
 *   2. workspaces.slug == subdominio
 *   3. primer workspace existente
 *
 * Cacheamos también el resolve host→workspaceId para evitar query por request.
 */
const hostCache = new Map<string, { workspaceId: string | null; expires: number }>();
const HOST_TTL_MS = 5 * 60_000;

export async function resolveWorkspaceIdByHost(host: string): Promise<string | null> {
  const now = Date.now();
  const cached = hostCache.get(host);
  if (cached && cached.expires > now) return cached.workspaceId;
  const id = await queryWorkspaceIdByHost(host);
  hostCache.set(host, { workspaceId: id, expires: now + HOST_TTL_MS });
  return id;
}

async function queryWorkspaceIdByHost(host: string): Promise<string | null> {
  const { db } = await import("@/db/client");
  const { workspaces } = await import("@/db/schema");
  const { eq, or } = await import("drizzle-orm");
  if (!db) return null;
  const cleaned = host.split(":")[0]?.toLowerCase();
  if (!cleaned) return null;
  const subdomain = cleaned.split(".")[0];
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      or(
        eq(workspaces.customDomain, cleaned),
        subdomain ? eq(workspaces.slug, subdomain) : undefined,
      ),
    )
    .limit(1);
  if (row) return row.id;
  // Fallback: primer workspace
  const [first] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  return first?.id ?? null;
}

/**
 * Resuelve el workspace por host (cookie/header) y aplica el redirect si match.
 * Si match, llama `nextRedirect()` que lanza un throw — la función no retorna.
 * Si no match, retorna sin efecto. Llama a `incrementHits` fire-and-forget.
 *
 * El caller pasa la cabecera `host` del request (en server components viene de
 * `headers()`).
 */
export async function runRedirect(opts: {
  host: string;
  path: string;
  query?: string;
}): Promise<void> {
  const workspaceId = await resolveWorkspaceIdByHost(opts.host);
  if (!workspaceId) return;
  const rules = await loadRulesForWorkspace(workspaceId);
  if (rules.length === 0) return;
  const match = matchRedirect(opts.path, rules, opts.query);
  if (!match) return;
  // Fire-and-forget contador de hits. No bloquea el redirect.
  void incrementHits(workspaceId, match.rule.id).catch(() => {
    // intencionalmente silencioso — analítica no debe romper el redirect
  });
  // Next sólo expone redirect (307) y permanentRedirect (308) como Server APIs.
  // Mapeamos: 301/308 → permanentRedirect; 302/307 → redirect.
  if (match.statusCode === 301 || match.statusCode === 308) {
    permanentRedirect(match.destination);
  } else {
    redirect(match.destination);
  }
}
