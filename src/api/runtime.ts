/**
 * Runtime del REST API público (/api/v1/...).
 *
 * createRoute({ method, path, params, query, body, response, scopes, summary, handler })
 *   - Auto-registra en OpenAPI registry
 *   - Maneja auth con API key
 *   - Aplica rate limit
 *   - Soporta Idempotency-Key (POST/PATCH/PUT/DELETE)
 *   - Soporta ETag/304 para GETs cuando handler devuelve { etag, data }
 *   - Audita cada request en api_key_audit
 *   - Convierte ApiError → JSON estandarizado
 */

import { createHash, randomUUID } from "node:crypto";
import { ApiError, validation } from "@/api/errors";
import { extractKeyFromRequest, hasScope, hashIp, recordAudit, verifyKey } from "@/api/keys";
import { registerRoute } from "@/api/openapi";
import { consume } from "@/api/rate-limit";
import { db } from "@/db/client";
import { idempotencyKeys } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import type { z } from "zod";

const MAX_BODY_BYTES = 1_048_576; // 1 MB cap para body JSON

export type ApiContext = {
  request: Request;
  workspaceId: string;
  apiKey: {
    id: string;
    workspaceId: string;
    scopes: string[];
    rateLimit: number;
    environment: "live" | "test";
  };
  url: URL;
  searchParams: URLSearchParams;
  /** El requestId que se devuelve al cliente. */
  requestId: string;
};

export type RouteHandler<P, Q, B> = (input: {
  params: P;
  query: Q;
  body: B;
  ctx: ApiContext;
}) => Promise<unknown | { etag: string; data: unknown } | Response>;

export type CreateRouteOptions<
  P extends z.ZodTypeAny,
  Q extends z.ZodTypeAny,
  B extends z.ZodTypeAny,
  R extends z.ZodTypeAny,
> = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  tag: string;
  summary: string;
  description?: string;
  scopes?: string[];
  params?: P;
  query?: Q;
  body?: B;
  /** Schema del response — sólo para OpenAPI; no se valida en runtime. */
  response?: R;
  handler: RouteHandler<
    P extends z.ZodTypeAny ? z.infer<P> : undefined,
    Q extends z.ZodTypeAny ? z.infer<Q> : undefined,
    B extends z.ZodTypeAny ? z.infer<B> : undefined
  >;
};

type AnyRoute = CreateRouteOptions<z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny>;

/**
 * Devuelve un Next.js route handler. Este helper se debe asignar a la export
 * correspondiente a su `method` (GET/POST/...).
 */
export function createRoute<
  P extends z.ZodTypeAny,
  Q extends z.ZodTypeAny,
  B extends z.ZodTypeAny,
  R extends z.ZodTypeAny,
>(opts: CreateRouteOptions<P, Q, B, R>) {
  // 1) Registramos para OpenAPI (idempotente con HMR)
  registerRoute({
    method: opts.method,
    path: opts.path,
    tag: opts.tag,
    summary: opts.summary,
    ...(opts.description !== undefined ? { description: opts.description } : {}),
    ...(opts.scopes !== undefined ? { scopes: opts.scopes } : {}),
    ...(opts.params !== undefined ? { params: opts.params } : {}),
    ...(opts.query !== undefined ? { query: opts.query } : {}),
    ...(opts.body !== undefined ? { body: opts.body } : {}),
    ...(opts.response !== undefined ? { response: opts.response } : {}),
  });

  return async function nextHandler(
    request: Request,
    routeCtx: { params: Promise<Record<string, string>> },
  ): Promise<Response> {
    return executeRoute(opts as AnyRoute, request, routeCtx);
  };
}

async function executeRoute(
  opts: AnyRoute,
  request: Request,
  routeCtx:
    | { params: Promise<Record<string, string>> }
    | { params?: Promise<Record<string, string>> },
): Promise<Response> {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const requestId = randomUUID();
  const ip = getIp(request);
  const ipHashed = hashIp(ip);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  // 1) Auth
  const fullKey = extractKeyFromRequest(request);
  if (!fullKey) {
    return errorResponse(
      new ApiError("unauthorized", "Falta header Authorization: Bearer ... o X-API-Key"),
      requestId,
    );
  }
  const auth = await verifyKey(fullKey);
  if (!auth.ok) {
    return errorResponse(new ApiError("unauthorized", denyReasonToMessage(auth.reason)), requestId);
  }
  const apiKey = auth.apiKey;

  // 2) Rate limit
  const rl = consume(apiKey.id, apiKey.rateLimit);
  const rlHeaders = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
  };
  if (!rl.ok) {
    const headers = {
      ...rlHeaders,
      "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
    };
    await recordAudit({
      apiKeyId: apiKey.id,
      workspaceId: apiKey.workspaceId,
      method: opts.method,
      path: url.pathname,
      statusCode: 429,
      durationMs: Date.now() - startedAt,
      ipHash: ipHashed,
      userAgent,
      denyReason: "rate-limited",
    });
    return errorResponse(
      new ApiError("rate_limited", "Has excedido el rate limit"),
      requestId,
      headers,
    );
  }

  // 3) Scopes
  const requiredScopes = opts.scopes ?? [];
  for (const scope of requiredScopes) {
    if (!hasScope(apiKey.scopes, scope)) {
      await recordAudit({
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspaceId,
        method: opts.method,
        path: url.pathname,
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        ipHash: ipHashed,
        userAgent,
        denyReason: "scope-denied",
      });
      return errorResponse(
        new ApiError("forbidden", `Tu API key no tiene el scope requerido: ${scope}`),
        requestId,
        rlHeaders,
      );
    }
  }

  // 4) Parse params/query/body
  let parsedParams: unknown;
  let parsedQuery: unknown;
  let parsedBody: unknown;

  try {
    if (opts.params) {
      const raw = (await routeCtx.params) ?? {};
      parsedParams = opts.params.parse(raw);
    }
    if (opts.query) {
      const raw = Object.fromEntries(url.searchParams.entries());
      parsedQuery = opts.query.parse(raw);
    } else {
      parsedQuery = url.searchParams;
    }
    if (opts.body && opts.method !== "GET") {
      // Cap de payload: 1 MB. Más que esto rara vez tiene sentido en JSON.
      const lenHeader = request.headers.get("content-length");
      if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
        throw validation(`Body demasiado grande (máx ${MAX_BODY_BYTES} bytes)`);
      }
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) {
        throw validation(`Body demasiado grande (máx ${MAX_BODY_BYTES} bytes)`);
      }
      const raw = text.length > 0 ? safeJsonParse(text) : {};
      parsedBody = opts.body.parse(raw);
    }
  } catch (err) {
    const e =
      err instanceof ApiError
        ? err
        : validation(
            "Datos inválidos",
            err instanceof Error
              ? "issues" in err && Array.isArray((err as { issues: unknown }).issues)
                ? (err as { issues: unknown }).issues
                : err.message
              : err,
          );
    await recordAudit({
      apiKeyId: apiKey.id,
      workspaceId: apiKey.workspaceId,
      method: opts.method,
      path: url.pathname,
      statusCode: e.status,
      durationMs: Date.now() - startedAt,
      ipHash: ipHashed,
      userAgent,
    });
    return errorResponse(e, requestId, rlHeaders);
  }

  // 5) Idempotency (POST/PATCH/PUT/DELETE)
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey && opts.method !== "GET" && db) {
    const existing = await checkIdempotency(
      apiKey.id,
      idempotencyKey,
      opts.method,
      url.pathname,
      parsedBody,
    );
    if (existing.kind === "conflict") {
      return errorResponse(
        new ApiError("idempotency_conflict", "Idempotency-Key reutilizada con un body distinto"),
        requestId,
        rlHeaders,
      );
    }
    if (existing.kind === "hit") {
      return new Response(JSON.stringify(existing.response), {
        status: existing.statusCode,
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-csm-idempotent-replay": "1",
          ...rlHeaders,
        },
      });
    }
  }

  // 6) Handler
  const ctx: ApiContext = {
    request,
    workspaceId: apiKey.workspaceId,
    apiKey,
    url,
    searchParams: url.searchParams,
    requestId,
  };

  let result: unknown;
  const statusCode = opts.method === "POST" ? 201 : 200;
  let etag: string | null = null;

  try {
    const handlerInput = {
      params: parsedParams as never,
      query: parsedQuery as never,
      body: parsedBody as never,
      ctx,
    };
    const out = (await (opts.handler as (i: unknown) => Promise<unknown>)(handlerInput)) as
      | unknown
      | { etag: string; data: unknown }
      | Response;
    if (out instanceof Response) {
      // Handler devolvió respuesta custom
      out.headers.set("x-request-id", requestId);
      for (const [k, v] of Object.entries(rlHeaders)) out.headers.set(k, v);
      await recordAudit({
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspaceId,
        method: opts.method,
        path: url.pathname,
        statusCode: out.status,
        durationMs: Date.now() - startedAt,
        ipHash: ipHashed,
        userAgent,
      });
      return out;
    }
    if (out && typeof out === "object" && "etag" in out && "data" in out) {
      etag = (out as { etag: string }).etag;
      result = (out as { data: unknown }).data;
    } else {
      result = out;
    }
  } catch (err) {
    const e =
      err instanceof ApiError
        ? err
        : new ApiError("internal_error", err instanceof Error ? err.message : "Error inesperado");
    await recordAudit({
      apiKeyId: apiKey.id,
      workspaceId: apiKey.workspaceId,
      method: opts.method,
      path: url.pathname,
      statusCode: e.status,
      durationMs: Date.now() - startedAt,
      ipHash: ipHashed,
      userAgent,
    });
    if (e.code === "internal_error") {
      console.error(`[api ${requestId}]`, err);
    }
    return errorResponse(e, requestId, rlHeaders);
  }

  // 7) ETag/304 para GETs
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": requestId,
    ...rlHeaders,
  };
  if (etag && opts.method === "GET") {
    headers.ETag = `"${etag}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.replace(/"/g, "") === etag) {
      await recordAudit({
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspaceId,
        method: opts.method,
        path: url.pathname,
        statusCode: 304,
        durationMs: Date.now() - startedAt,
        ipHash: ipHashed,
        userAgent,
      });
      return new Response(null, { status: 304, headers });
    }
  }

  // 8) Persist idempotency response
  if (idempotencyKey && opts.method !== "GET" && db) {
    await persistIdempotency(
      apiKey.id,
      idempotencyKey,
      opts.method,
      url.pathname,
      parsedBody,
      statusCode,
      result,
    );
  }

  // 9) Audit OK
  await recordAudit({
    apiKeyId: apiKey.id,
    workspaceId: apiKey.workspaceId,
    method: opts.method,
    path: url.pathname,
    statusCode,
    durationMs: Date.now() - startedAt,
    ipHash: ipHashed,
    userAgent,
  });

  // JSON.stringify(undefined) === undefined → body vacío con content-type JSON.
  // Defensivo: convertimos undefined a null para mantener un cuerpo válido.
  return new Response(JSON.stringify(result ?? null), { status: statusCode, headers });
}

// ============================================================
// Helpers
// ============================================================

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw validation("JSON inválido en el body");
  }
}

function denyReasonToMessage(reason: string): string {
  switch (reason) {
    case "missing":
      return "Falta API key";
    case "malformed":
      return "API key con formato inválido";
    case "not-found":
      return "API key no encontrada";
    case "hash-mismatch":
      return "API key inválida";
    case "expired":
      return "API key expirada";
    case "revoked":
      return "API key revocada";
    default:
      return "API key no válida";
  }
}

export function errorResponse(
  err: ApiError,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const body = {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
    requestId,
  };
  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...extraHeaders,
    },
  });
}

// ============================================================
// Idempotency helpers
// ============================================================

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function hashRequestBody(body: unknown): string {
  const canonical = JSON.stringify(body ?? null);
  return createHash("sha256").update(canonical).digest("hex");
}

async function checkIdempotency(
  apiKeyId: string,
  key: string,
  method: string,
  path: string,
  body: unknown,
): Promise<
  { kind: "miss" } | { kind: "hit"; statusCode: number; response: unknown } | { kind: "conflict" }
> {
  if (!db) return { kind: "miss" };
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.apiKeyId, apiKeyId),
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return { kind: "miss" };
  const requestHash = hashRequestBody(body);
  if (row.method !== method || row.path !== path || row.requestHash !== requestHash) {
    return { kind: "conflict" };
  }
  return { kind: "hit", statusCode: row.statusCode, response: row.response };
}

async function persistIdempotency(
  apiKeyId: string,
  key: string,
  method: string,
  path: string,
  body: unknown,
  statusCode: number,
  response: unknown,
) {
  if (!db) return;
  try {
    await db
      .insert(idempotencyKeys)
      .values({
        apiKeyId,
        key,
        method,
        path,
        requestHash: hashRequestBody(body),
        statusCode,
        response: response as object,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      })
      .onConflictDoNothing();
  } catch {
    // best-effort
  }
}

// ============================================================
// ETag util
// ============================================================

export function computeEtag(...inputs: unknown[]): string {
  const hash = createHash("sha256");
  for (const input of inputs) hash.update(JSON.stringify(input));
  return hash.digest("hex").slice(0, 24);
}
