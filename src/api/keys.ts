import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { apiKeyAudit, apiKeys } from "@/db/schema";
import { deleteReturningCount, insertReturning } from "@/db/dialect";
import { env } from "@/env";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

// ============================================================
// Generación / parseo
// ============================================================

const PREFIX_LIVE = "csm_live_";
const PREFIX_TEST = "csm_test_";

export type ApiKeyEnvironment = "live" | "test";

/**
 * Genera una key con formato `csm_{env}_{prefix8}{secret64}`.
 * - Devolvemos `secret` (la única vez que el usuario lo ve), `prefix` (visible en UI)
 *   y `hash` (para guardar en DB).
 */
export function generateKey(environment: ApiKeyEnvironment = "live") {
  const prefix = randomBytes(4).toString("hex"); // 8 chars hex
  const secret = randomBytes(24).toString("base64url"); // ~32 chars
  const fullKey = `${environment === "live" ? PREFIX_LIVE : PREFIX_TEST}${prefix}_${secret}`;
  const hash = hashSecret(fullKey);
  return { fullKey, prefix, hash, environment };
}

function hashSecret(fullKey: string): string {
  return createHmac("sha256", env.API_KEY_PEPPER).update(fullKey).digest("hex");
}

/**
 * Extrae prefix + envFlag + plain de la key recibida.
 * Devuelve null si el formato es inválido (sin tirar excepción para evitar timing leaks).
 */
export function parseKey(
  fullKey: string,
): { environment: ApiKeyEnvironment; prefix: string; hash: string } | null {
  if (typeof fullKey !== "string" || fullKey.length < 16 || fullKey.length > 128) return null;
  let environment: ApiKeyEnvironment;
  let rest: string;
  if (fullKey.startsWith(PREFIX_LIVE)) {
    environment = "live";
    rest = fullKey.slice(PREFIX_LIVE.length);
  } else if (fullKey.startsWith(PREFIX_TEST)) {
    environment = "test";
    rest = fullKey.slice(PREFIX_TEST.length);
  } else {
    return null;
  }
  const underscore = rest.indexOf("_");
  if (underscore !== 8) return null; // 8 chars hex prefix
  const prefix = rest.slice(0, 8);
  if (!/^[a-f0-9]{8}$/.test(prefix)) return null;
  return { environment, prefix, hash: hashSecret(fullKey) };
}

/** Lee la key del header Authorization (Bearer) o X-API-Key. */
export function extractKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1] ?? null;
  }
  const xKey = req.headers.get("x-api-key");
  if (xKey) return xKey.trim();
  return null;
}

// ============================================================
// Cache (in-memory, TTL 60s)
// ============================================================

type CachedKey = {
  id: string;
  workspaceId: string;
  scopes: string[];
  rateLimit: number;
  environment: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  cachedAt: number;
};

const KEY_CACHE = new Map<string, CachedKey>();
const KEY_CACHE_TTL_MS = 60_000;

function clearStaleCache() {
  const now = Date.now();
  for (const [k, v] of KEY_CACHE.entries()) {
    if (now - v.cachedAt > KEY_CACHE_TTL_MS) KEY_CACHE.delete(k);
  }
}

export function invalidateKeyCache(prefix?: string) {
  if (prefix) KEY_CACHE.delete(prefix);
  else KEY_CACHE.clear();
}

// ============================================================
// Verificación
// ============================================================

export type AuthDenyReason =
  | "missing"
  | "malformed"
  | "not-found"
  | "hash-mismatch"
  | "expired"
  | "revoked"
  | "scope-denied"
  | "rate-limited";

export type AuthSuccess = {
  ok: true;
  apiKey: {
    id: string;
    workspaceId: string;
    scopes: string[];
    rateLimit: number;
    environment: ApiKeyEnvironment;
  };
};
export type AuthFailure = { ok: false; reason: AuthDenyReason };
export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Valida una key contra DB con cache TTL 60s.
 * - Verificación timing-safe del hash.
 * - Comprueba expiresAt y revokedAt.
 * - NO chequea scopes ni rate limit (eso es responsabilidad del runtime).
 */
export async function verifyKey(fullKey: string): Promise<AuthResult> {
  if (!db) return { ok: false, reason: "not-found" };
  const parsed = parseKey(fullKey);
  if (!parsed) return { ok: false, reason: "malformed" };

  // Cache lookup primero
  clearStaleCache();
  const cached = KEY_CACHE.get(parsed.prefix);
  let row: CachedKey | null = cached ?? null;

  if (!row) {
    const [dbRow] = await db
      .select({
        id: apiKeys.id,
        workspaceId: apiKeys.workspaceId,
        hash: apiKeys.hash,
        scopes: apiKeys.scopes,
        rateLimit: apiKeys.rateLimit,
        environment: apiKeys.environment,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.prefix, parsed.prefix))
      .limit(1);

    if (!dbRow) return { ok: false, reason: "not-found" };

    // Timing-safe comparison del hash
    const expected = Buffer.from(dbRow.hash, "hex");
    const got = Buffer.from(parsed.hash, "hex");
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
      return { ok: false, reason: "hash-mismatch" };
    }

    row = {
      id: dbRow.id,
      workspaceId: dbRow.workspaceId,
      scopes: dbRow.scopes ?? [],
      rateLimit: dbRow.rateLimit ?? 1000,
      environment: dbRow.environment,
      expiresAt: dbRow.expiresAt,
      revokedAt: dbRow.revokedAt,
      cachedAt: Date.now(),
    };
    KEY_CACHE.set(parsed.prefix, row);
  }

  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  // Sanity: la env del fullKey debe coincidir con la guardada
  if (row.environment !== parsed.environment) {
    return { ok: false, reason: "hash-mismatch" };
  }

  return {
    ok: true,
    apiKey: {
      id: row.id,
      workspaceId: row.workspaceId,
      scopes: row.scopes,
      rateLimit: row.rateLimit,
      environment: parsed.environment,
    },
  };
}

// ============================================================
// Scopes (glob simple)
// ============================================================

/**
 * Comprueba si una scope-list permite la action requerida.
 * Patrones soportados:
 *   - exact: "entries:read"
 *   - resource wildcard: "entries:*"
 *   - action wildcard: "*:read"
 *   - full: "*"
 */
export function hasScope(grantedScopes: string[], required: string): boolean {
  if (!required.includes(":")) return false; // formato inválido del required
  const [reqResource, reqAction] = required.split(":");
  for (const granted of grantedScopes) {
    if (granted === "*") return true;
    if (granted === required) return true;
    const [gRes, gAct] = granted.split(":");
    if ((gRes === "*" || gRes === reqResource) && (gAct === "*" || gAct === reqAction)) {
      return true;
    }
  }
  return false;
}

// ============================================================
// Audit
// ============================================================

export async function recordAudit(input: {
  apiKeyId: string;
  workspaceId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipHash?: string | null;
  userAgent?: string | null;
  denyReason?: AuthDenyReason | null;
}): Promise<void> {
  if (!db) return;
  try {
    await db.insert(apiKeyAudit).values({
      apiKeyId: input.apiKeyId,
      workspaceId: input.workspaceId,
      method: input.method,
      path: input.path.slice(0, 500),
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      denyReason: input.denyReason ?? null,
    });
    // Incremento contadores denormalizados
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        requestsToday: sql`${apiKeys.requestsToday} + 1`,
        requestsTotal: sql`${apiKeys.requestsTotal} + 1`,
      })
      .where(eq(apiKeys.id, input.apiKeyId));
  } catch {
    // Audit es best-effort, no rompemos requests por esto.
  }
}

/** Hash determinista de una IP para almacenamiento (no PII directa). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).update(env.API_KEY_PEPPER).digest("hex").slice(0, 16);
}

// ============================================================
// CRUD helpers (server-only, llamados por server actions UI)
// ============================================================

export async function listKeysForWorkspace(workspaceId: string) {
  if (!db) return [];
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      description: apiKeys.description,
      prefix: apiKeys.prefix,
      environment: apiKeys.environment,
      scopes: apiKeys.scopes,
      rateLimit: apiKeys.rateLimit,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
      requestsToday: apiKeys.requestsToday,
      requestsTotal: apiKeys.requestsTotal,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId));
}

export async function getKeyForWorkspace(workspaceId: string, id: string) {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function createApiKey(input: {
  workspaceId: string;
  name: string;
  description?: string;
  scopes: string[];
  rateLimit?: number;
  environment?: ApiKeyEnvironment;
  expiresAt?: Date | null;
  createdById?: string | null;
}) {
  if (!db) throw new Error("DB no disponible");
  const { fullKey, prefix, hash, environment } = generateKey(input.environment ?? "live");
  const id = crypto.randomUUID();
  const inserted = (await insertReturning(apiKeys, {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description ?? null,
    prefix,
    hash,
    environment,
    scopes: input.scopes.length > 0 ? input.scopes : ["*:read"],
    rateLimit: input.rateLimit ?? 1000,
    expiresAt: input.expiresAt ?? null,
    createdById: input.createdById ?? null,
  })) as typeof apiKeys.$inferSelect;
  if (!inserted) throw new Error("No se pudo crear la API key");
  return { id: inserted.id, prefix, fullKey };
}

export async function rotateApiKey(workspaceId: string, id: string) {
  if (!db) throw new Error("DB no disponible");
  const existing = await getKeyForWorkspace(workspaceId, id);
  if (!existing) throw new Error("Key no encontrada");
  const { fullKey, prefix, hash, environment } = generateKey(
    existing.environment as ApiKeyEnvironment,
  );
  // Revocamos la vieja con grace de 24h
  const grace = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .update(apiKeys)
    .set({ expiresAt: grace })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)));

  const newId = crypto.randomUUID();
  const created = (await insertReturning(apiKeys, {
    id: newId,
    workspaceId,
    name: `${existing.name} (rotada)`,
    description: existing.description,
    prefix,
    hash,
    environment,
    scopes: existing.scopes ?? ["*:read"],
    rateLimit: existing.rateLimit,
    expiresAt: existing.expiresAt,
    createdById: existing.createdById,
    rotatedFromId: existing.id,
  })) as typeof apiKeys.$inferSelect;

  invalidateKeyCache(existing.prefix);
  if (!created) throw new Error("No se pudo rotar la API key");
  return { id: created.id, prefix, fullKey };
}

export async function revokeApiKey(workspaceId: string, id: string) {
  if (!db) throw new Error("DB no disponible");
  const existing = await getKeyForWorkspace(workspaceId, id);
  if (!existing) throw new Error("Key no encontrada");
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)));
  invalidateKeyCache(existing.prefix);
}

export async function deleteApiKey(workspaceId: string, id: string) {
  if (!db) throw new Error("DB no disponible");
  const existing = await getKeyForWorkspace(workspaceId, id);
  if (!existing) return;
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)));
  invalidateKeyCache(existing.prefix);
}

/** Listado del audit log de una key (últimas N requests). */
export async function listKeyAudit(workspaceId: string, id: string, limit = 50) {
  if (!db) return [];
  const key = await getKeyForWorkspace(workspaceId, id);
  if (!key) return [];
  return db
    .select()
    .from(apiKeyAudit)
    .where(eq(apiKeyAudit.apiKeyId, id))
    .orderBy(sql`${apiKeyAudit.createdAt} DESC`)
    .limit(limit);
}

// ============================================================
// Reset diario de requestsToday (llamable por cron)
// ============================================================

export async function resetDailyCounters() {
  if (!db) return;
  await db.update(apiKeys).set({ requestsToday: 0 });
}

// ============================================================
// Limpieza de keys expiradas hace > 90d (housekeeping)
// ============================================================

export async function pruneExpiredKeys() {
  if (!db) return 0;
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return await deleteReturningCount(
    apiKeys,
    and(lt(apiKeys.expiresAt, cutoff), isNull(apiKeys.revokedAt))!,
  );
}

// Re-export para evitar warnings de "imports no usados"
void gt;
