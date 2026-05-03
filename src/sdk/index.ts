/**
 * CSM SDK — cliente HTTP tipado para REST v1.
 *
 * Diseño:
 *   - Cero deps (`fetch` nativo).
 *   - Idempotency-Key automática en POST (UUIDv4).
 *   - Retries 3x con backoff exponencial en 5xx + 429 (respeta Retry-After).
 *   - Async iterators sobre cursor para paginación lazy.
 *   - Helper `gql<T>()` para GraphQL.
 *
 * Uso:
 *   const csm = createCsmClient({ baseUrl: "https://csm.example/api/v1", apiKey: "csm_live_..." });
 *   const list = await csm.entries.list({ limit: 10 });
 *   for await (const e of csm.entries.iterAll()) { ... }
 *   const r = await csm.gql<{ entries: { nodes: { id: string }[] } }>(`{ entries { nodes { id } } }`);
 */

import { randomUUID } from "node:crypto";

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Permite inyectar fetch (para Node 18, Bun, edge, tests). */
  fetch?: typeof fetch;
  /** Reintentos máximos para 5xx/429. Default 3. */
  retries?: number;
  /** Timeout por request en ms. Default 30000. */
  timeoutMs?: number;
  /** Headers extra que se mergan en cada request. */
  headers?: Record<string, string>;
}

export class CsmError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(opts: { status: number; code: string; message: string; details?: unknown }) {
    super(opts.message);
    this.name = "CsmError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { nextCursor: string | null; hasMore: boolean; count: number };
}

interface SingleResponse<T> {
  data: T;
}

// ============================================================
// Resource types (subset — ampliable con codegen vía openapi en F8+)
// ============================================================
export interface Entry {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  collectionId: string;
  locale: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  body?: unknown;
  fields?: Record<string, unknown>;
  seo?: { title?: string; description?: string; ogImage?: string };
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  isSingleton: boolean;
  isBuiltin: boolean;
  schema?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  url: string;
  filename: string | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  blurhash: string | null;
  createdAt: string;
}

export interface Page {
  id: string;
  title: string;
  path: string;
  locale: string;
  status: string;
  isHome: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  entryId: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  body: string;
  status: "pending" | "approved" | "spam";
  createdAt: string;
}

export interface Form {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  version: number;
  submissionsCount: number;
  spamCount: number;
  lastSubmissionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  formVersion: number;
  status: string;
  spamScore: number;
  data: Record<string, unknown>;
  country: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface Automation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  triggerType: string;
  active: boolean;
  runsTotal: number;
  runsFailed: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: string;
  triggerEvent: string;
  error: string | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

export interface Menu {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: "header" | "footer" | "sidebar" | "custom";
  version: number;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuDetail extends Menu {
  items: Array<{
    id: string;
    label: string;
    type: string;
    href: string | null;
    children?: MenuDetail["items"];
    [k: string]: unknown;
  }>;
}

export interface RedirectRule {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  matchType: "exact" | "prefix" | "regex";
  preserveQuery: boolean;
  enabled: boolean;
  description: string | null;
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
  type: string;
  terms: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
}

export interface MeInfo {
  apiKeyId: string;
  workspaceId: string;
  scopes: string[];
  environment: string;
}

// ============================================================
// Helpers
// ============================================================

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

type InternalFetch = (
  path: string,
  init?: RequestInit & { idempotency?: boolean },
) => Promise<Response>;

function makeFetcher(
  opts: Required<Omit<ClientOptions, "fetch" | "headers">> & {
    baseUrl: string;
    apiKey: string;
    fetchImpl: typeof fetch;
    headers: Record<string, string>;
  },
): InternalFetch {
  return async function call(
    path: string,
    init: RequestInit & { idempotency?: boolean } = {},
  ): Promise<Response> {
    const url = `${opts.baseUrl}${path}`;
    const baseHeaders: Record<string, string> = {
      authorization: `Bearer ${opts.apiKey}`,
      "user-agent": "csm-sdk/0.1",
      ...opts.headers,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    const method = (init.method ?? "GET").toUpperCase();
    if (init.body && !baseHeaders["content-type"]) {
      baseHeaders["content-type"] = "application/json";
    }
    const isWrite = method !== "GET" && method !== "HEAD";
    if (isWrite && (init.idempotency ?? true) && !baseHeaders["idempotency-key"]) {
      baseHeaders["idempotency-key"] = randomUUID();
    }

    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= opts.retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const res = await opts.fetchImpl(url, {
          ...init,
          method,
          headers: baseHeaders,
          signal: init.signal ?? controller.signal,
        });
        clearTimeout(timer);
        if (RETRYABLE_STATUS.has(res.status) && attempt < opts.retries) {
          attempt++;
          const retryAfter = res.headers.get("retry-after");
          const delay = retryAfter
            ? Math.min(60_000, Number(retryAfter) * 1000 || 0)
            : Math.min(2 ** attempt * 250, 8000);
          await sleep(delay);
          continue;
        }
        return res;
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        if (attempt < opts.retries) {
          attempt++;
          await sleep(Math.min(2 ** attempt * 250, 8000));
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error("Unknown error");
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { error: { code: "non_json", message: text || res.statusText } };
    }
    const err = (body as { error?: { code?: string; message?: string } }).error ?? {};
    throw new CsmError({
      status: res.status,
      code: err.code ?? "unknown",
      message: err.message ?? `HTTP ${res.status}`,
      details: body,
    });
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ============================================================
// Client
// ============================================================

export interface CsmClient {
  health(): Promise<{ ok: boolean; version?: string }>;
  me(): Promise<MeInfo>;
  entries: ResourceWithCursor<Entry, ListEntriesQuery>;
  collections: SimpleResource<Collection>;
  media: ResourceWithCursor<Media, BasicQuery>;
  pages: SimpleResource<Page>;
  comments: ResourceWithCursor<Comment, ListCommentsQuery>;
  taxonomies: { list(): Promise<Taxonomy[]> };
  forms: SimpleResource<Form> & {
    submissions(
      formId: string,
      opts?: ListSubmissionsQuery,
    ): Promise<PaginatedResponse<Submission>>;
  };
  automations: SimpleResource<Automation> & {
    runs(
      automationId: string,
      opts?: { cursor?: string; limit?: number },
    ): Promise<PaginatedResponse<AutomationRun>>;
  };
  webhooks: SimpleResource<Webhook>;
  menus: SimpleResource<Menu> & { get(slug: string): Promise<MenuDetail> };
  redirects: { list(opts?: ListRedirectsQuery): Promise<PaginatedResponse<RedirectRule>> };
  /** Raw GraphQL request. */
  gql<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<{ data?: T; errors?: unknown[] }>;
}

interface ResourceWithCursor<T, Q> {
  list(opts?: Q): Promise<PaginatedResponse<T>>;
  get(id: string): Promise<T>;
  iterAll(opts?: Q): AsyncGenerator<T, void, unknown>;
}

interface SimpleResource<T> {
  list(opts?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResponse<T>>;
  get(id: string): Promise<T>;
}

type QueryParam = string | number | boolean | undefined;

interface BasicQuery {
  cursor?: string;
  limit?: number;
  [key: string]: QueryParam;
}

interface ListEntriesQuery {
  status?: string;
  collectionId?: string;
  locale?: string;
  cursor?: string;
  limit?: number;
  [key: string]: QueryParam;
}

interface ListCommentsQuery {
  status?: string;
  entryId?: string;
  cursor?: string;
  limit?: number;
  [key: string]: QueryParam;
}

interface ListSubmissionsQuery {
  status?: string;
  cursor?: string;
  limit?: number;
  [key: string]: QueryParam;
}

interface ListRedirectsQuery {
  enabled?: boolean;
  matchType?: "exact" | "prefix" | "regex";
  q?: string;
  [key: string]: QueryParam;
}

export function createCsmClient(opts: ClientOptions): CsmClient {
  if (!opts.baseUrl) throw new Error("baseUrl es obligatorio");
  if (!opts.apiKey) throw new Error("apiKey es obligatorio");

  const fetchImpl = opts.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch no disponible — instala node-fetch o usa Node 18+");

  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const call = makeFetcher({
    baseUrl,
    apiKey: opts.apiKey,
    retries: opts.retries ?? 3,
    timeoutMs: opts.timeoutMs ?? 30_000,
    fetchImpl,
    headers: opts.headers ?? {},
  });

  function listResource<T, Q extends Record<string, string | number | boolean | undefined>>(
    path: string,
  ) {
    return async (q?: Q): Promise<PaginatedResponse<T>> => {
      const res = await call(`${path}${q ? qs(q) : ""}`);
      return parseResponse<PaginatedResponse<T>>(res);
    };
  }

  function getResource<T>(path: string) {
    return async (id: string): Promise<T> => {
      const res = await call(`${path}/${encodeURIComponent(id)}`);
      const json = await parseResponse<SingleResponse<T> | T>(res);
      return (json as SingleResponse<T>).data !== undefined
        ? (json as SingleResponse<T>).data
        : (json as T);
    };
  }

  async function* iterCursor<T, Q extends BasicQuery>(
    listFn: (q: Q) => Promise<PaginatedResponse<T>>,
    initial?: Q,
  ): AsyncGenerator<T, void, unknown> {
    let cursor: string | null = initial?.cursor ?? null;
    while (true) {
      const q = { ...(initial ?? ({} as Q)), ...(cursor ? { cursor } : {}) } as Q;
      const page = await listFn(q);
      for (const item of page.data) yield item;
      if (!page.meta.hasMore || !page.meta.nextCursor) return;
      cursor = page.meta.nextCursor;
    }
  }

  const entries: ResourceWithCursor<Entry, ListEntriesQuery> = {
    list: listResource<Entry, ListEntriesQuery>("/entries"),
    get: getResource<Entry>("/entries"),
    iterAll(q) {
      return iterCursor<Entry, ListEntriesQuery>(entries.list, q);
    },
  };

  const mediaR: ResourceWithCursor<Media, BasicQuery> = {
    list: listResource<Media, BasicQuery>("/media"),
    get: getResource<Media>("/media"),
    iterAll(q) {
      return iterCursor<Media, BasicQuery>(mediaR.list, q);
    },
  };

  const commentsR: ResourceWithCursor<Comment, ListCommentsQuery> = {
    list: listResource<Comment, ListCommentsQuery>("/comments"),
    get: getResource<Comment>("/comments"),
    iterAll(q) {
      return iterCursor<Comment, ListCommentsQuery>(commentsR.list, q);
    },
  };

  return {
    async health() {
      const res = await call("/health");
      const j = await parseResponse<{ ok?: boolean; version?: string }>(res);
      return { ok: j.ok ?? true, ...(j.version ? { version: j.version } : {}) };
    },
    async me() {
      const res = await call("/me");
      const j = await parseResponse<SingleResponse<MeInfo> | MeInfo>(res);
      return ((j as SingleResponse<MeInfo>).data ?? j) as MeInfo;
    },
    entries,
    collections: {
      list: listResource<Collection, Record<string, string | number | boolean | undefined>>(
        "/collections",
      ),
      get: getResource<Collection>("/collections"),
    },
    media: mediaR,
    pages: {
      list: listResource<Page, Record<string, string | number | boolean | undefined>>("/pages"),
      get: getResource<Page>("/pages"),
    },
    comments: commentsR,
    taxonomies: {
      async list() {
        const res = await call("/taxonomies");
        const j = await parseResponse<PaginatedResponse<Taxonomy>>(res);
        return j.data;
      },
    },
    forms: {
      list: listResource<Form, Record<string, string | number | boolean | undefined>>("/forms"),
      get: getResource<Form>("/forms"),
      async submissions(formId, q) {
        const res = await call(`/forms/${encodeURIComponent(formId)}/submissions${q ? qs(q) : ""}`);
        return parseResponse<PaginatedResponse<Submission>>(res);
      },
    },
    automations: {
      list: listResource<Automation, Record<string, string | number | boolean | undefined>>(
        "/automations",
      ),
      get: getResource<Automation>("/automations"),
      async runs(automationId, q) {
        const res = await call(
          `/automations/${encodeURIComponent(automationId)}/runs${q ? qs(q) : ""}`,
        );
        return parseResponse<PaginatedResponse<AutomationRun>>(res);
      },
    },
    webhooks: {
      list: listResource<Webhook, Record<string, string | number | boolean | undefined>>(
        "/webhooks",
      ),
      get: getResource<Webhook>("/webhooks"),
    },
    menus: {
      list: listResource<Menu, Record<string, string | number | boolean | undefined>>("/menus"),
      get: getResource<MenuDetail>("/menus"),
    },
    redirects: {
      async list(q) {
        const res = await call(
          `/redirects${q ? qs(q as Record<string, string | number | boolean | undefined>) : ""}`,
        );
        return parseResponse<PaginatedResponse<RedirectRule>>(res);
      },
    },
    async gql<T = unknown>(query: string, variables?: Record<string, unknown>) {
      // baseUrl viene como /api/v1; el endpoint GraphQL vive en /api/graphql.
      // Resolvemos sustituyendo /api/v1 → /api/graphql cuando aplica.
      const gqlUrl = baseUrl.endsWith("/api/v1")
        ? `${baseUrl.slice(0, -7)}/graphql`
        : `${baseUrl}/graphql`;
      const res = await fetchImpl(gqlUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
      });
      const j = await parseResponse<{ data?: T; errors?: unknown[] }>(res);
      return j;
    },
  };
}
