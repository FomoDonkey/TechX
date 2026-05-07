/**
 * Schema MySQL paralelo a `schema.pg.ts` (Tarea 15 — schema completo).
 *
 * **Estado:** 77 tablas portadas (5 originales POC + 72 portadas en Tarea 15).
 *
 * **Reglas de mapeo Postgres → MySQL** (ver `docs/architecture/multi-db-design.md`):
 *
 *  | Postgres                                  | MySQL 8.4+                                  |
 *  |---|---|
 *  | `pgTable(...)`                            | `mysqlTable(...)`                           |
 *  | `pgEnum(...)`                             | `mysqlEnum(...)` (inline en columna)        |
 *  | `text(...)` con default                   | `varchar(...)` (MySQL `text` no permite default) |
 *  | `text(...)` indexado (uniq/idx)           | `varchar(N)` (MySQL TEXT requiere prefix length) |
 *  | `text(...)` libre                         | `text(...)` (OK sin default ni index)       |
 *  | `boolean`                                 | `boolean` (idéntico)                        |
 *  | `timestamp`                               | `timestamp({fsp:3})` con `CURRENT_TIMESTAMP(3)` |
 *  | `uuid("id").primaryKey().defaultRandom()` | `varchar("id", {length:36}).primaryKey()` + `crypto.randomUUID()` app-side |
 *  | `uuid("col")` FK / nullable               | `varchar("col", {length:36})` |
 *  | `jsonb`                                   | `json`                                      |
 *  | `integer`                                 | `int`                                       |
 *  | `bigint({mode:"number"})`                 | `bigint({mode:"number"})` (idéntico)        |
 *  | `text("col").array()`                     | POC: `json("col").$type<string[]>()` (Tarea 18 → tabla aux) |
 *  | `default(sql\`ARRAY[...]\`)`              | `.default([...])` o `.default(sql\`('[...]')\`)`. Para MySQL JSON `default(sql\`(...)\`)` requiere paréntesis. |
 *  | `vector("embedding", { dimensions:1536 })` | `customType` que renderiza `VECTOR(1536)` (MySQL 9+) — con fallback varchar para < 9 documentado. |
 *  | `index("idx").on(t.col)`                  | `index("idx").on(t.col)` idéntico            |
 *  | `uniqueIndex("idx").on(t.cols)`           | `uniqueIndex("idx")` idéntico                |
 *  | `uniqueIndex(...).where(sql\`...\`)` PG-only | MySQL no tiene partial indexes — convertimos a non-unique o forzamos en código. Documentado en cada caso. |
 *
 * **Diferencias semánticas a tener en cuenta:**
 *
 * - **Partial unique indexes**: Postgres permite `UNIQUE WHERE x IS NOT NULL` (multiple NULLs OK,
 *   uniqueness sólo aplica a no-NULL). MySQL ya permite multiple NULLs en UNIQUE INDEX por defecto,
 *   por lo que `UNIQUE WHERE col IS NOT NULL` se traduce naturalmente a `UNIQUE INDEX (col)`.
 *   Sin embargo, `UNIQUE WHERE bool_col = true` (ej. `branches_ws_default_idx`) NO tiene equivalente
 *   directo: lo bajamos a non-unique index y enforce en código (`createBranch` valida que no haya otra
 *   default antes de insertar). Documentado en cada índice.
 *
 * - **Expression indexes**: Postgres soporta `index().on(sql\`...\`)`. MySQL 8.0.13+ también
 *   permite functional indexes pero la sintaxis es `((expr))` con doble paréntesis. Drizzle
 *   acepta `SQL` como column en `.on(...)` y emite la expresión wrap'd.
 *
 * - **`text("col").array()`**: en MySQL POC se guarda como `json` con `$type<string[]>()` para que
 *   los call-sites no necesiten cambiar. Tarea 18 normalizará 11 columnas a tablas auxiliares
 *   (ver ADR-002). Importante: las queries `WHERE locale = ANY(locales)` específicas de Postgres
 *   deberán refactorizarse en Tarea 18.
 *
 * - **Vector type**: MySQL 8.4 NO tiene VECTOR. MySQL 9.0+ sí. Para compilar contra ambos
 *   versiones generamos `VECTOR(1536)` via `customType`; en runtime, el migrador detecta versión
 *   y cae a `VARBINARY(8192)` (fallback storage-only) o delega en Qdrant si está configurado.
 *   Ver `src/search/vector/mysql-vector.ts` (ADR-007).
 *
 * - **UUID primary keys**: ahora se generan app-side con `crypto.randomUUID()` en cada `INSERT`
 *   (ver ADR-003). Lo mismo aplica a Postgres tras refactor mecánico de Tarea 10.
 */

import { sql } from "drizzle-orm";
import {
  type AnyMySqlColumn,
  bigint,
  boolean,
  customType,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// ============================================================
// CUSTOM TYPES
// ============================================================
/**
 * Vector embedding column.
 *
 *  - MySQL 9.0+ → `VECTOR(N)` nativo (default).
 *  - MySQL 8.x  → fallback a `VARBINARY(8192)` activando la env var
 *    `MYSQL_VECTOR_FALLBACK=true`. La búsqueda semántica nativa queda
 *    deshabilitada (la query layer enruta a Qdrant si está configurado;
 *    en otro caso, se deshabilita la feature gracefully).
 *
 * Por qué env var y no detección runtime: `drizzle-kit push` evalúa el
 * schema en build, no tiene conexión a la BD para hacer `SELECT VERSION()`.
 * El operador del despliegue declara explícitamente qué BD tiene.
 *
 * Tipo de dato JS: `number[]` (alineado con pgvector). El driver MySQL
 * recibe y devuelve el vector como string separado por comas; se delega
 * la conversión al adapter porque drizzle no soporta nativamente VECTOR aún.
 */
const VECTOR_FALLBACK = process.env.MYSQL_VECTOR_FALLBACK === "true";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
  configRequired: true;
}>({
  dataType(config) {
    if (VECTOR_FALLBACK) {
      // 8192 bytes = 2048 floats × 4 bytes — cubre 1536d de OpenAI/Voyage.
      // Con dimensiones mayores hay que subirlo (o switchear a Qdrant).
      return "VARBINARY(8192)";
    }
    return `VECTOR(${config.dimensions})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Aceptar tanto "[1,2,3]" como "1,2,3" o Buffer.
    const s = String(value)
      .replace(/^\[|\]$/g, "")
      .trim();
    if (!s) return [];
    return s.split(",").map((n) => Number(n));
  },
});

// ============================================================
// AUTH (Better-Auth tables)
// ============================================================

export const users = mysqlTable(
  "users",
  {
    // Better-Auth usa ids string (no UUIDs estrictos). 255 chars cubre
    // cualquier formato (hash, nanoid, uuid, etc.).
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(), // RFC 5321 max 254 + buffer
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    locale: varchar("locale", { length: 10 }).default("es"),
    timezone: varchar("timezone", { length: 64 }).default("Europe/Madrid"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    onboardedAt: timestamp("onboarded_at", { fsp: 3 }),
    handle: varchar("handle", { length: 60 }),
    bio: text("bio"),
    website: varchar("website", { length: 500 }),
    twitter: varchar("twitter", { length: 100 }),
    /**
     * GDPR derecho al olvido (ver schema.pg.ts para semántica completa).
     * `deletionRequestedAt` arranca grace period; `deletedAt` es tombstone.
     */
    deletionRequestedAt: timestamp("deletion_requested_at", { fsp: 3 }),
    deletedAt: timestamp("deleted_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("users_handle_idx").on(t.handle),
    index("users_deletion_requested_idx").on(t.deletionRequestedAt),
  ],
);

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 100 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const verifications = mysqlTable("verifications", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 320 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: timestamp("updated_at", { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`),
});

// Passkeys (WebAuthn) — Better-Auth plugin
export const passkeys = mysqlTable("passkeys", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  publicKey: text("public_key").notNull(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialID: varchar("credential_id", { length: 512 }).notNull(),
  counter: int("counter").notNull(),
  deviceType: varchar("device_type", { length: 60 }).notNull(),
  backedUp: boolean("backed_up").notNull(),
  transports: text("transports"),
  createdAt: timestamp("created_at", { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`),
});

// Two-factor (TOTP backup codes) — Better-Auth plugin
export const twoFactors = mysqlTable("two_factors", {
  id: varchar("id", { length: 255 }).primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/**
 * Rate-limit storage usado por Better-Auth (modo `storage: "database"`).
 * Misma semántica que en Postgres: `key = ${ip}:${path}`, `lastRequest` ms epoch
 * en bigint para sobrevivir a 2038. F10a parte 2 bloque 2 (2026-05-04).
 */
export const rateLimits = mysqlTable(
  "rate_limits",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    key: varchar("key", { length: 512 }).notNull(),
    count: int("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("rate_limits_key_idx").on(t.key)],
);

// ============================================================
// WORKSPACES (multi-tenant core)
// ============================================================
export const workspaces = mysqlTable(
  "workspaces",
  {
    // Postgres: uuid().defaultRandom(). MySQL: app-side via crypto.randomUUID() (ADR-003).
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    plan: varchar("plan", { length: 30 }).notNull().default("free"),
    branding: json("branding").$type<{
      logo?: string;
      colors?: { primary?: string; accent?: string };
      font?: string;
      voice?: string;
    }>(),
    aiProvider: varchar("ai_provider", { length: 30 }).default("groq"),
    defaultLocale: varchar("default_locale", { length: 10 }).default("es"),
    // POC interim: locales como JSON. Tarea 18 lo migra a tabla
    // auxiliar `workspace_locales (workspace_id, locale, position)` (ADR-002).
    locales: json("locales").$type<string[]>().default(["es"]),
    customDomain: varchar("custom_domain", { length: 255 }),
    activeThemeSlug: varchar("active_theme_slug", { length: 60 }).default("magazine"),
    ogTemplate: json("og_template"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("workspaces_slug_idx").on(t.slug)],
);

export const members = mysqlTable(
  "members",
  {
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "admin", "editor", "author", "viewer"])
      .notNull()
      .default("editor"),
    invitedBy: varchar("invited_by", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const invitations = mysqlTable("invitations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["owner", "admin", "editor", "author", "viewer"])
    .notNull()
    .default("editor"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  acceptedAt: timestamp("accepted_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

// ============================================================
// CONTENT
// ============================================================
export const collections = mysqlTable(
  "collections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    icon: varchar("icon", { length: 60 }),
    description: text("description"),
    schema: json("schema").$type<unknown>(),
    isSingleton: boolean("is_singleton").notNull().default(false),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    listView: json("list_view"),
    /**
     * Workflow editorial config por colección (F9c). NULL = defaults globales.
     * Ver schema.pg.ts para detalles de cada flag.
     */
    workflowConfig: json("workflow_config").$type<{
      requireReviewer?: boolean;
      requireApprover?: boolean;
      defaultSlaHours?: number;
      defaultPriority?: "low" | "normal" | "high" | "urgent";
      skipReview?: boolean;
      allowSelfApprove?: boolean;
    }>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("collections_ws_slug_idx").on(t.workspaceId, t.slug)],
);

/**
 * Branches de contenido (F9b). Convenciones idénticas a Postgres.
 *
 * NOTA MySQL: `branches_ws_default_idx` en Postgres es `UNIQUE WHERE isDefault=true`
 * para garantizar UNA sola main por workspace. MySQL no soporta partial unique
 * indexes en bool_col=true → bajamos a non-unique index `branches_ws_default_idx`
 * y delegamos enforcement a la lógica de `createBranch()` (validar que no exista
 * otra `isDefault=true` antes de insertar, dentro de transacción).
 */
export const branches = mysqlTable(
  "branches",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    /** true para la branch "main" del workspace. Hay exactamente una con esta marca. */
    isDefault: boolean("is_default").notNull().default(false),
    /** Branch protegida: solo admin puede borrar/mergear. main es protected=true. */
    isProtected: boolean("is_protected").notNull().default(false),
    /** Branch base de la que se forkeó (NULL = forked desde main). */
    baseBranchId: varchar("base_branch_id", { length: 36 }),
    status: mysqlEnum("status", ["draft", "merging", "merged", "abandoned"])
      .notNull()
      .default("draft"),
    /**
     * Reglas avanzadas de protección. NULL = sin reglas adicionales.
     * Ver `mergeBranch` en `src/branching/merge.ts`.
     */
    protectionConfig: json("protection_config").$type<{
      requireReviewers: number;
      requireApprovers: number;
      requireCommentsResolved: boolean;
      requireStatusApproved: boolean;
    }>(),
    /** Color OKLCH para pill (visual differentiation). */
    color: varchar("color", { length: 60 }).default("oklch(0.55 0.22 290)"),
    /** Icono Lucide name. */
    icon: varchar("icon", { length: 60 }).default("git-branch"),
    /** Token rotable para preview público read-only. */
    previewToken: varchar("preview_token", { length: 120 }),
    /** Hash bcrypt-like opcional para preview con contraseña. NULL = público. */
    previewPasswordHash: varchar("preview_password_hash", { length: 255 }),
    /** Si se define, el preview deja de funcionar tras esta fecha. */
    previewExpiresAt: timestamp("preview_expires_at", { fsp: 3 }),
    /** Contador best-effort de hits al preview. */
    previewViews: int("preview_views").notNull().default(0),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    mergedAt: timestamp("merged_at", { fsp: 3 }),
    mergedById: varchar("merged_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    abandonedAt: timestamp("abandoned_at", { fsp: 3 }),
    abandonedById: varchar("abandoned_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("branches_ws_slug_idx").on(t.workspaceId, t.slug),
    // Postgres: UNIQUE partial WHERE isDefault=true. MySQL no soporta partial.
    // Bajado a non-unique index. Enforce de "una sola main" se delega a la app.
    index("branches_ws_default_idx").on(t.workspaceId, t.isDefault),
    // MySQL UNIQUE INDEX permite múltiples NULL — equivale al partial PG WHERE NOT NULL.
    uniqueIndex("branches_preview_token_idx").on(t.previewToken),
    index("branches_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * Timeline rico de eventos por branch. Útil para audit + UI lateral.
 */
export const branchActivity = mysqlTable(
  "branch_activity",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    branchId: varchar("branch_id", { length: 36 })
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    /** UUID de la entry afectada. NO es FK estricta — la entry puede haberse borrado. */
    entryId: varchar("entry_id", { length: 36 }),
    type: mysqlEnum("type", [
      "branch.created",
      "branch.renamed",
      "branch.protected_changed",
      "branch.preview_token_rotated",
      "branch.rebased",
      "branch.merge_attempted",
      "branch.merge_failed",
      "branch.merged",
      "branch.abandoned",
      "branch.restored",
      "entry.forked",
      "entry.edited",
      "entry.created_in_branch",
      "entry.deleted_in_branch",
      "entry.reverted_in_branch",
      "comment.added",
      "comment.resolved",
    ]).notNull(),
    actorId: varchar("actor_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    payload: json("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("branch_activity_branch_created_idx").on(t.branchId, t.createdAt),
    index("branch_activity_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("branch_activity_entry_idx").on(t.entryId),
  ],
);

/**
 * Comentarios anclados a una branch. Niveles: branch / entry / block / range.
 */
export const branchComments = mysqlTable(
  "branch_comments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    branchId: varchar("branch_id", { length: 36 })
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 }),
    blockId: varchar("block_id", { length: 64 }),
    anchorRange: json("anchor_range").$type<{ from: number; to: number }>(),
    parentId: varchar("parent_id", { length: 36 }).references(
      (): AnyMySqlColumn => branchComments.id,
      { onDelete: "cascade" },
    ),
    authorId: varchar("author_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    /** Mentions @user — array de userIds. POC: JSON; Tarea 18 → tabla aux. */
    mentions: json("mentions").$type<string[]>(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["open", "resolved"]).notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
    resolvedById: varchar("resolved_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("branch_comments_branch_created_idx").on(t.branchId, t.createdAt),
    index("branch_comments_branch_status_idx").on(t.branchId, t.status),
    index("branch_comments_entry_idx").on(t.entryId, t.createdAt),
  ],
);

/**
 * Entries — corazón del CMS. Mismas convenciones que Postgres (ver schema.pg.ts).
 *
 * NOTA MySQL: dos índices PG son partial unique (`WHERE NOT NULL` + condiciones).
 * En MySQL, UNIQUE INDEX permite múltiples NULL por defecto, lo cual emula
 * el partial sobre NULLability. Para los compound se mantiene el comportamiento.
 */
export const entries = mysqlTable(
  "entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: varchar("collection_id", { length: 36 })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    branchId: varchar("branch_id", { length: 36 }),
    /**
     * Sólo poblado cuando branch≠main. Apunta a la entry de main de la que
     * esta es copy-on-write. NO es FK estricta.
     */
    originalEntryId: varchar("original_entry_id", { length: 36 }),
    branchState: mysqlEnum("branch_state", ["forked", "new", "deleted"]),
    branchedFromUpdatedAt: timestamp("branched_from_updated_at", { fsp: 3 }),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    excerpt: text("excerpt"),
    body: json("body").$type<unknown>(),
    bodyText: text("body_text"),
    coverId: varchar("cover_id", { length: 36 }),
    status: mysqlEnum("status", [
      "draft",
      "review",
      "approved",
      "scheduled",
      "published",
      "archived",
    ])
      .notNull()
      .default("draft"),
    locale: varchar("locale", { length: 10 }).notNull().default("es"),
    parentTranslationId: varchar("parent_translation_id", { length: 36 }),
    scheduledAt: timestamp("scheduled_at", { fsp: 3 }),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    /** Deadline editorial — SLA-driven (F9c). NULL = sin SLA. */
    dueAt: timestamp("due_at", { fsp: 3 }),
    /** Prioridad editorial (F9c). Default: normal. */
    priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"])
      .notNull()
      .default("normal"),
    /**
     * Aprobación atómica (F9c). UPDATE WHERE lockedForApprovalById IS NULL
     * en una sola query reserva el slot. En MySQL no hay RETURNING, así que
     * el helper `insertReturning` (`src/db/insert-returning.ts`) hace UPDATE
     * + SELECT por id en transacción serializable.
     */
    lockedForApprovalAt: timestamp("locked_for_approval_at", { fsp: 3 }),
    lockedForApprovalById: varchar("locked_for_approval_by_id", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    authorId: varchar("author_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedById: varchar("updated_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    seo: json("seo").$type<{ title?: string; description?: string; ogImage?: string }>(),
    ogImageUrl: varchar("og_image_url", { length: 2048 }),
    /**
     * Vector embedding 1536d (OpenAI text-embedding-3-small / Voyage / similar).
     * MySQL 9.0+ → tipo VECTOR(1536). MySQL 8.4 → fallback storage-only o
     * Qdrant via `src/search/vector/`. Ver ADR-007.
     */
    embedding: vector("embedding", { dimensions: 1536 }),
    fields: json("fields").$type<Record<string, unknown>>(),
    /**
     * `${source}:${kind}:${sourceId}` — set por el importer. Idempotencia
     * inter-lote: re-imports no duplican (UPDATE en lugar de INSERT).
     */
    originRef: varchar("origin_ref", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("entries_ws_coll_slug_locale_idx").on(
      t.workspaceId,
      t.collectionId,
      t.slug,
      t.locale,
    ),
    index("entries_ws_status_pub_idx").on(t.workspaceId, t.status, t.publishedAt),
    index("entries_collection_idx").on(t.collectionId),
    // PG: UNIQUE WHERE originRef IS NOT NULL → MySQL UNIQUE permite múltiples NULL.
    uniqueIndex("entries_ws_origin_ref_idx").on(t.workspaceId, t.originRef),
    // PG: UNIQUE WHERE branchId+originalEntryId NOT NULL → MySQL UNIQUE permite NULL.
    uniqueIndex("entries_branch_original_idx").on(t.branchId, t.originalEntryId),
    index("entries_ws_branch_idx").on(t.workspaceId, t.branchId),
    // F9c: scheduling — calendar query principal (range scan).
    index("entries_ws_scheduled_idx").on(t.workspaceId, t.scheduledAt),
    index("entries_ws_due_idx").on(t.workspaceId, t.dueAt),
  ],
);

export const revisions = mysqlTable("revisions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  entryId: varchar("entry_id", { length: 36 })
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  body: json("body").$type<unknown>(),
  summary: text("summary"),
  authorId: varchar("author_id", { length: 255 }).references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

// ============================================================
// EDITORIAL — F9c (assignments, workflow events, threads, ical tokens)
// ============================================================
/**
 * Asignaciones editoriales por entry. A lo sumo una por (entry, role, NOT completed).
 *
 * NOTA MySQL: Postgres usa UNIQUE WHERE completedAt IS NULL para el constraint
 * de "una asignación activa por (entry, role)". MySQL UNIQUE permite múltiples NULL,
 * por lo que NO podemos forzar el constraint via partial unique. Lo bajamos a
 * non-unique index y enforcement se hace en `createAssignment` (release del slot
 * al setear completedAt; check antes de insert).
 */
export const entryAssignments = mysqlTable(
  "entry_assignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    assigneeId: varchar("assignee_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["writer", "reviewer", "approver"]).notNull(),
    /** Deadline propio de la asignación. */
    dueAt: timestamp("due_at", { fsp: 3 }),
    /** SLA en horas desde createdAt; usado para calcular dueAt si dueAt es NULL. */
    slaHours: int("sla_hours"),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    /** "approved" | "rejected" | "completed" libre. */
    completionKind: varchar("completion_kind", { length: 30 }),
    note: text("note"),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    // PG: UNIQUE WHERE completedAt IS NULL → MySQL no puede. Bajado a index.
    // Enforcement: `createAssignment()` valida absence + completedAt al release.
    index("entry_assignments_entry_role_active_idx").on(t.entryId, t.role, t.completedAt),
    index("entry_assignments_assignee_idx").on(t.assigneeId, t.completedAt),
    index("entry_assignments_ws_entry_idx").on(t.workspaceId, t.entryId),
    index("entry_assignments_ws_due_idx").on(t.workspaceId, t.dueAt),
  ],
);

/**
 * Audit trail del workflow editorial. Una fila por evento del entry.
 */
export const entryWorkflowEvents = mysqlTable(
  "entry_workflow_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", [
      "status.changed",
      "assignment.added",
      "assignment.removed",
      "assignment.completed",
      "due.changed",
      "priority.changed",
      "scheduled.changed",
      "comment.added",
      "comment.resolved",
      "approval.locked",
      "approval.released",
      "sla.breach",
    ]).notNull(),
    fromStatus: mysqlEnum("from_status", [
      "draft",
      "review",
      "approved",
      "scheduled",
      "published",
      "archived",
    ]),
    toStatus: mysqlEnum("to_status", [
      "draft",
      "review",
      "approved",
      "scheduled",
      "published",
      "archived",
    ]),
    actorId: varchar("actor_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    /** Targeted user (ej: assignee añadido/quitado). */
    targetUserId: varchar("target_user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    /** Payload libre. */
    payload: json("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("entry_workflow_events_entry_idx").on(t.entryId, t.createdAt),
    index("entry_workflow_events_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);

/**
 * Hilos de comentarios editoriales (revisión interna).
 */
export const editorialThreads = mysqlTable(
  "editorial_threads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    /** Si NULL, hilo general del entry. Si set, ancla al bloque Tiptap. */
    blockId: varchar("block_id", { length: 64 }),
    status: mysqlEnum("status", ["open", "resolved"]).notNull().default("open"),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedById: varchar("resolved_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("editorial_threads_entry_idx").on(t.entryId, t.createdAt),
    index("editorial_threads_entry_block_idx").on(t.entryId, t.blockId),
    index("editorial_threads_ws_status_idx").on(t.workspaceId, t.status, t.createdAt),
  ],
);

export const editorialMessages = mysqlTable(
  "editorial_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    threadId: varchar("thread_id", { length: 36 })
      .notNull()
      .references(() => editorialThreads.id, { onDelete: "cascade" }),
    authorId: varchar("author_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    /** userIds @-mentioned. POC: JSON. Tarea 18 → tabla aux (ADR-002). */
    mentions: json("mentions").$type<string[]>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("editorial_messages_thread_idx").on(t.threadId, t.createdAt)],
);

/**
 * Tokens secretos para feed iCal personal. Uno por (user, workspace). Rotable.
 */
export const editorialCalendarTokens = mysqlTable(
  "editorial_calendar_tokens",
  {
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 120 }).notNull(),
    /** Filtros embebidos en el feed. */
    filters: json("filters").$type<{
      onlyMine?: boolean;
      collectionIds?: string[];
      includeDue?: boolean;
    }>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    rotatedAt: timestamp("rotated_at", { fsp: 3 }),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    uniqueIndex("editorial_calendar_tokens_token_idx").on(t.token),
  ],
);

// ============================================================
// TAXONOMIES
// ============================================================
export const taxonomies = mysqlTable("taxonomies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  type: mysqlEnum("type", ["category", "tag"]).notNull().default("tag"),
});

export const terms = mysqlTable("terms", {
  id: varchar("id", { length: 36 }).primaryKey(),
  taxonomyId: varchar("taxonomy_id", { length: 36 })
    .notNull()
    .references(() => taxonomies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  parentId: varchar("parent_id", { length: 36 }),
});

export const entryTerms = mysqlTable(
  "entry_terms",
  {
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    termId: varchar("term_id", { length: 36 })
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.termId] })],
);

// ============================================================
// MEDIA
// ============================================================
export const mediaFolders = mysqlTable("media_folders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id", { length: 36 }),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const media = mysqlTable(
  "media",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    folderId: varchar("folder_id", { length: 36 }),
    key: varchar("key", { length: 1024 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    filename: varchar("filename", { length: 500 }),
    mime: varchar("mime", { length: 120 }).notNull(),
    size: int("size").notNull(),
    width: int("width"),
    height: int("height"),
    duration: int("duration"),
    alt: text("alt"),
    caption: text("caption"),
    blurhash: varchar("blurhash", { length: 120 }),
    focalX: int("focal_x").default(50),
    focalY: int("focal_y").default(50),
    dominantColor: varchar("dominant_color", { length: 30 }),
    hasTransparency: boolean("has_transparency").default(false),
    exifStripped: boolean("exif_stripped").default(true),
    variants: json("variants"),
    /** AI tags (sugeridos por modelo de visión). POC: JSON; Tarea 18 → aux table. */
    aiTags: json("ai_tags").$type<string[]>(),
    /** Tags manuales del editor. POC: JSON. */
    tagsManual: json("tags_manual").$type<string[]>(),
    embedding: vector("embedding", { dimensions: 1536 }),
    uploadedById: varchar("uploaded_by_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("media_ws_folder_idx").on(t.workspaceId, t.folderId),
    index("media_ws_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

// ============================================================
// COMMENTS
// ============================================================
export const comments = mysqlTable(
  "comments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    /** Si se elimina el padre, el reply queda root (lo promovemos en el render). */
    parentId: varchar("parent_id", { length: 36 }).references((): AnyMySqlColumn => comments.id, {
      onDelete: "set null",
    }),
    /** Anclado a un bloque concreto del editor (Tiptap nodeId). */
    blockId: varchar("block_id", { length: 64 }),
    authorName: varchar("author_name", { length: 200 }).notNull(),
    authorEmail: varchar("author_email", { length: 320 }).notNull(),
    /** Si el comentario lo dejó un usuario logueado, se enlaza. */
    authorUserId: varchar("author_user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "spam"]).notNull().default("pending"),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    /** 0 = limpio, 100 = spam evidente. */
    aiScore: int("ai_score"),
    aiReason: text("ai_reason"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("comments_ws_status_idx").on(t.workspaceId, t.status, t.createdAt),
    index("comments_entry_idx").on(t.entryId, t.createdAt),
  ],
);

// ============================================================
// SEARCH INDEX JOBS (recompute embeddings en background)
// ============================================================
export const searchIndexJobs = mysqlTable(
  "search_index_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["queued", "processing", "done", "error"])
      .notNull()
      .default("queued"),
    attempts: int("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("search_jobs_entry_idx").on(t.entryId),
    index("search_jobs_status_idx").on(t.status, t.createdAt),
  ],
);

// ============================================================
// GROWTH (newsletter, memberships)
// ============================================================
export const subscribers = mysqlTable(
  "subscribers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 200 }),
    locale: varchar("locale", { length: 10 }).default("es"),
    status: mysqlEnum("status", ["active", "unsubscribed", "bounced"]).notNull().default("active"),
    /** Tags. POC: JSON. Tarea 18 → tabla aux (ADR-002). */
    tags: json("tags").$type<string[]>(),
    source: varchar("source", { length: 60 }),
    preferences: json("preferences"),
    confirmedAt: timestamp("confirmed_at", { fsp: 3 }),
    unsubscribedAt: timestamp("unsubscribed_at", { fsp: 3 }),
    unsubscribeReason: text("unsubscribe_reason"),
    unsubscribeToken: varchar("unsubscribe_token", { length: 120 }),
    lastOpenAt: timestamp("last_open_at", { fsp: 3 }),
    lastClickAt: timestamp("last_click_at", { fsp: 3 }),
    bounceCount: int("bounce_count").default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("subscribers_ws_email_idx").on(t.workspaceId, t.email),
    uniqueIndex("subscribers_unsub_token_idx").on(t.unsubscribeToken),
    index("subscribers_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

export const subscriberConfirmations = mysqlTable(
  "subscriber_confirmations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subscriberId: varchar("subscriber_id", { length: 36 })
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 120 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    confirmedAt: timestamp("confirmed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("subscriber_confirmations_token_idx").on(t.token),
    index("subscriber_confirmations_sub_idx").on(t.subscriberId),
  ],
);

export const segments = mysqlTable("segments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  rules: json("rules"),
});

export const campaigns = mysqlTable(
  "campaigns",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    previewText: varchar("preview_text", { length: 500 }),
    fromName: varchar("from_name", { length: 200 }),
    fromEmail: varchar("from_email", { length: 320 }),
    replyTo: varchar("reply_to", { length: 320 }),
    body: json("body"),
    bodyHtml: text("body_html"),
    templateId: varchar("template_id", { length: 36 }),
    segmentId: varchar("segment_id", { length: 36 }),
    scheduledAt: timestamp("scheduled_at", { fsp: 3 }),
    startedAt: timestamp("started_at", { fsp: 3 }),
    sentAt: timestamp("sent_at", { fsp: 3 }),
    status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "paused", "failed"])
      .notNull()
      .default("draft"),
    totalRecipients: int("total_recipients").default(0),
    sent: int("sent").default(0),
    opens: int("opens").default(0),
    uniqueOpens: int("unique_opens").default(0),
    clicks: int("clicks").default(0),
    uniqueClicks: int("unique_clicks").default(0),
    bounced: int("bounced").default(0),
    complained: int("complained").default(0),
    unsubscribed: int("unsubscribed").default(0),
    failed: int("failed").default(0),
    createdById: varchar("created_by_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("campaigns_ws_status_idx").on(t.workspaceId, t.status)],
);

export const campaignRecipients = mysqlTable(
  "campaign_recipients",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: varchar("campaign_id", { length: 36 })
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    subscriberId: varchar("subscriber_id", { length: 36 })
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "sending",
      "sent",
      "bounced",
      "complained",
      "failed",
      "unsubscribed",
    ])
      .notNull()
      .default("pending"),
    trackingHash: varchar("tracking_hash", { length: 128 }).notNull(),
    queuedAt: timestamp("queued_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    sentAt: timestamp("sent_at", { fsp: 3 }),
    openedAt: timestamp("opened_at", { fsp: 3 }),
    openCount: int("open_count").default(0),
    clickedAt: timestamp("clicked_at", { fsp: 3 }),
    clickCount: int("click_count").default(0),
    bouncedAt: timestamp("bounced_at", { fsp: 3 }),
    failedAt: timestamp("failed_at", { fsp: 3 }),
    failureReason: text("failure_reason"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
  },
  (t) => [
    uniqueIndex("campaign_recipients_unique_idx").on(t.campaignId, t.subscriberId),
    uniqueIndex("campaign_recipients_tracking_idx").on(t.trackingHash),
    index("campaign_recipients_status_idx").on(t.workspaceId, t.status),
  ],
);

export const emailTemplates = mysqlTable(
  "email_templates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    subject: varchar("subject", { length: 500 }),
    previewText: varchar("preview_text", { length: 500 }),
    body: json("body"),
    bodyHtml: text("body_html"),
    variables: json("variables"),
    builtinKey: varchar("builtin_key", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("email_templates_ws_slug_idx").on(t.workspaceId, t.slug)],
);

export const drips = mysqlTable(
  "drips",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    triggerType: mysqlEnum("trigger_type", ["subscribe_confirmed", "tag_added", "manual"])
      .notNull()
      .default("subscribe_confirmed"),
    triggerConfig: json("trigger_config"),
    steps: json("steps"),
    status: mysqlEnum("status", ["draft", "active", "paused"]).notNull().default("draft"),
    enrolledTotal: int("enrolled_total").default(0),
    completedTotal: int("completed_total").default(0),
    createdById: varchar("created_by_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("drips_ws_status_idx").on(t.workspaceId, t.status)],
);

export const dripEnrollments = mysqlTable(
  "drip_enrollments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dripId: varchar("drip_id", { length: 36 })
      .notNull()
      .references(() => drips.id, { onDelete: "cascade" }),
    subscriberId: varchar("subscriber_id", { length: 36 })
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    currentStep: int("current_step").notNull().default(0),
    nextRunAt: timestamp("next_run_at", { fsp: 3 }),
    status: mysqlEnum("status", ["active", "completed", "cancelled", "paused"])
      .notNull()
      .default("active"),
    enrolledAt: timestamp("enrolled_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    cancelledAt: timestamp("cancelled_at", { fsp: 3 }),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    uniqueIndex("drip_enrollments_unique_idx").on(t.dripId, t.subscriberId),
    index("drip_enrollments_next_run_idx").on(t.status, t.nextRunAt),
  ],
);

export const emailEvents = mysqlTable(
  "email_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", [
      "queued",
      "sent",
      "delivered",
      "open",
      "click",
      "bounce",
      "complaint",
      "unsubscribe",
      "failed",
    ]).notNull(),
    subscriberId: varchar("subscriber_id", { length: 36 }).references(() => subscribers.id, {
      onDelete: "set null",
    }),
    campaignId: varchar("campaign_id", { length: 36 }).references(() => campaigns.id, {
      onDelete: "set null",
    }),
    recipientId: varchar("recipient_id", { length: 36 }).references(() => campaignRecipients.id, {
      onDelete: "set null",
    }),
    dripId: varchar("drip_id", { length: 36 }).references(() => drips.id, {
      onDelete: "set null",
    }),
    dripEnrollmentId: varchar("drip_enrollment_id", { length: 36 }).references(
      () => dripEnrollments.id,
      { onDelete: "set null" },
    ),
    url: varchar("url", { length: 2048 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("email_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("email_events_campaign_idx").on(t.campaignId, t.type),
    index("email_events_subscriber_idx").on(t.subscriberId, t.createdAt),
  ],
);

export const tiers = mysqlTable(
  "tiers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    priceCents: int("price_cents").notNull().default(0),
    currency: varchar("currency", { length: 10 }).notNull().default("eur"),
    interval: mysqlEnum("interval", ["month", "year", "lifetime"]).notNull().default("month"),
    /** Días de prueba antes del primer cargo (0 = sin trial). */
    trialDays: int("trial_days").notNull().default(0),
    /** Lista de strings (features visibles en checkout/portal). */
    features: json("features").$type<string[]>().notNull().default([]),
    /** Si false, no se muestra en /miembros. */
    isActive: boolean("is_active").notNull().default(true),
    /** Tier "free" (precio 0): se concede sin Stripe. */
    isFree: boolean("is_free").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    /** IDs en Stripe — se rellenan con "Sincronizar con Stripe". */
    stripeProductId: varchar("stripe_product_id", { length: 255 }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("tiers_ws_slug_idx").on(t.workspaceId, t.slug),
    index("tiers_ws_active_idx").on(t.workspaceId, t.isActive, t.sortOrder),
    index("tiers_stripe_price_idx").on(t.stripePriceId),
  ],
);

export const memberships = mysqlTable(
  "memberships",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 200 }),
    tierId: varchar("tier_id", { length: 36 }).references(() => tiers.id, {
      onDelete: "set null",
    }),
    status: mysqlEnum("status", [
      "incomplete",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ])
      .notNull()
      .default("active"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    currentPeriodStart: timestamp("current_period_start", { fsp: 3 }),
    currentPeriodEnd: timestamp("current_period_end", { fsp: 3 }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { fsp: 3 }),
    trialEnd: timestamp("trial_end", { fsp: 3 }),
    startedAt: timestamp("started_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    /** Origen del registro. */
    source: varchar("source", { length: 30 }),
    metadata: json("metadata").$type<unknown>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("memberships_ws_email_idx").on(t.workspaceId, t.email),
    index("memberships_ws_status_idx").on(t.workspaceId, t.status),
    index("memberships_stripe_sub_idx").on(t.stripeSubscriptionId),
    index("memberships_stripe_cust_idx").on(t.stripeCustomerId),
  ],
);

/**
 * Sesiones del MIEMBRO (separado del admin Better-Auth).
 */
export const memberSessions = mysqlTable(
  "member_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    userAgent: text("user_agent"),
    ipHash: varchar("ip_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("member_sessions_token_idx").on(t.tokenHash),
    index("member_sessions_ws_email_idx").on(t.workspaceId, t.email),
    index("member_sessions_expires_idx").on(t.expiresAt),
  ],
);

/** Magic links one-shot para login de miembro vía email. */
export const memberMagicLinks = mysqlTable(
  "member_magic_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    redirectTo: varchar("redirect_to", { length: 2048 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    usedAt: timestamp("used_at", { fsp: 3 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("member_magic_links_token_idx").on(t.tokenHash),
    index("member_magic_links_ws_email_idx").on(t.workspaceId, t.email),
  ],
);

/** Audit log de eventos de membresía (Stripe webhooks + acciones manuales). */
export const memberEvents = mysqlTable(
  "member_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    membershipId: varchar("membership_id", { length: 36 }).references(() => memberships.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 320 }),
    type: mysqlEnum("type", [
      "membership_created",
      "membership_updated",
      "membership_canceled",
      "membership_resumed",
      "tier_changed",
      "payment_succeeded",
      "payment_failed",
      "trial_started",
      "trial_ended",
      "magic_link_sent",
      "session_started",
      "session_ended",
    ]).notNull(),
    /** event.id de Stripe para idempotencia. */
    stripeEventId: varchar("stripe_event_id", { length: 255 }),
    data: json("data").$type<unknown>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("member_events_stripe_evt_idx").on(t.stripeEventId),
    index("member_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("member_events_membership_idx").on(t.membershipId, t.createdAt),
  ],
);

/**
 * Reglas de personalización con nombre (reusables).
 */
export const personalizationRules = mysqlTable(
  "personalization_rules",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    rule: json("rule").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("personalization_rules_ws_name_idx").on(t.workspaceId, t.name)],
);

// ============================================================
// FORMS
// ============================================================
export const forms = mysqlTable(
  "forms",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    /** Snapshot del schema activo. Para histórico, ver formVersions. */
    schema: json("schema").$type<unknown>(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
    /** Versión incremental — sube en cada save publicado. */
    version: int("version").notNull().default(1),
    /** Mensaje de éxito por defecto. */
    successMessage: text("success_message"),
    /** Si se define, redirige tras submit. */
    redirectUrl: varchar("redirect_url", { length: 2048 }),
    /** Webhook URL legacy. Para webhooks dinámicos usar webhooks/automations. */
    webhookUrl: varchar("webhook_url", { length: 2048 }),
    /** Lista de emails para notificación. POC: JSON. Tarea 18 → tabla aux. */
    notificationEmails: json("notification_emails").$type<string[]>().notNull().default([]),
    /** Settings: doubleOptIn, captcha, antiSpam, storeIp, allowedOrigins, etc. */
    settings: json("settings").$type<unknown>(),
    submissionsCount: int("submissions_count").notNull().default(0),
    spamCount: int("spam_count").notNull().default(0),
    lastSubmissionAt: timestamp("last_submission_at", { fsp: 3 }),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("forms_ws_slug_idx").on(t.workspaceId, t.slug),
    index("forms_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/** Histórico inmutable de schemas publicados. */
export const formVersions = mysqlTable(
  "form_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    formId: varchar("form_id", { length: 36 })
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    version: int("version").notNull(),
    schema: json("schema").$type<unknown>().notNull(),
    publishedById: varchar("published_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("form_versions_form_version_idx").on(t.formId, t.version)],
);

export const submissions = mysqlTable(
  "submissions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: varchar("form_id", { length: 36 })
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    /** Versión del schema con la que se envió. */
    formVersion: int("form_version").notNull().default(1),
    data: json("data").$type<Record<string, unknown>>().notNull(),
    /** Lista de mediaIds adjuntos. POC: JSON. Tarea 18 → tabla aux. */
    attachments: json("attachments").$type<string[]>().notNull().default([]),
    status: mysqlEnum("status", ["received", "spam", "processed", "archived"])
      .notNull()
      .default("received"),
    /** 0..100 — score anti-spam. */
    spamScore: int("spam_score").notNull().default(0),
    /** Razones de spam. POC: JSON. Tarea 18 → tabla aux. */
    spamReasons: json("spam_reasons").$type<string[]>(),
    /** sha-256(formId + data canonical) — dedupe + idempotency. */
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    ua: text("ua"),
    referer: varchar("referer", { length: 2048 }),
    country: varchar("country", { length: 4 }),
    /** UTM source/medium/campaign serializados. */
    source: json("source").$type<{ utm?: Record<string, string>; ref?: string }>(),
    /** Si requiere doble opt-in: pendiente de confirmar. */
    confirmedAt: timestamp("confirmed_at", { fsp: 3 }),
    confirmationToken: varchar("confirmation_token", { length: 120 }),
    processedAt: timestamp("processed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("submissions_form_created_idx").on(t.formId, t.createdAt),
    index("submissions_ws_status_idx").on(t.workspaceId, t.status, t.createdAt),
    uniqueIndex("submissions_form_hash_idx").on(t.formId, t.contentHash),
    uniqueIndex("submissions_confirmation_token_idx").on(t.confirmationToken),
  ],
);

// ============================================================
// PLATFORM
// ============================================================
export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    /** Identificador legible: csm_live_XXXX o csm_test_XXXX. */
    prefix: varchar("prefix", { length: 60 }).notNull(),
    /** sha-256(secret + KEY_PEPPER). */
    hash: varchar("hash", { length: 128 }).notNull(),
    /** "live" o "test"; las test keys no disparan webhooks ni mutan datos públicos. */
    environment: varchar("environment", { length: 10 }).notNull().default("live"),
    /** Scopes glob. POC: JSON. Tarea 18 → tabla aux (ADR-002). */
    scopes: json("scopes").$type<string[]>().notNull().default(["*:read"]),
    /** Requests por hora. */
    rateLimit: int("rate_limit").notNull().default(1000),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    revokedAt: timestamp("revoked_at", { fsp: 3 }),
    /** Si esta key reemplaza a otra (rotación). */
    rotatedFromId: varchar("rotated_from_id", { length: 36 }),
    lastUsedAt: timestamp("last_used_at", { fsp: 3 }),
    /** Contador denormalizado. */
    requestsToday: int("requests_today").notNull().default(0),
    requestsTotal: int("requests_total").notNull().default(0),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("api_keys_prefix_idx").on(t.prefix),
    index("api_keys_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const apiKeyAudit = mysqlTable(
  "api_key_audit",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    apiKeyId: varchar("api_key_id", { length: 36 })
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 1024 }).notNull(),
    statusCode: int("status_code").notNull(),
    durationMs: int("duration_ms").notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    /** Reason si bloqueado. */
    denyReason: varchar("deny_reason", { length: 60 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("api_key_audit_key_idx").on(t.apiKeyId, t.createdAt)],
);

export const webhooks = mysqlTable(
  "webhooks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull().default("Webhook"),
    description: text("description"),
    /** Lista de eventos. POC: JSON. Tarea 18 → tabla aux (ADR-002). */
    events: json("events").$type<string[]>().notNull().default(["*"]),
    url: varchar("url", { length: 2048 }).notNull(),
    secret: varchar("secret", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
    /** Número máximo de reintentos (1 + N retries). */
    maxAttempts: int("max_attempts").notNull().default(5),
    lastSuccessAt: timestamp("last_success_at", { fsp: 3 }),
    lastFailureAt: timestamp("last_failure_at", { fsp: 3 }),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("webhooks_ws_active_idx").on(t.workspaceId, t.active)],
);

export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    webhookId: varchar("webhook_id", { length: 36 })
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 120 }).notNull(),
    /**
     * Identificador único por evento — usable como header X-CSM-Event-Id.
     * En Postgres `defaultRandom()`. En MySQL se genera app-side con
     * `crypto.randomUUID()` antes del INSERT (ver `enqueueWebhookDelivery`).
     */
    eventId: varchar("event_id", { length: 36 }).notNull(),
    payload: json("payload").notNull(),
    status: mysqlEnum("status", ["pending", "success", "failed", "retrying", "dropped"])
      .notNull()
      .default("pending"),
    attempt: int("attempt").notNull().default(0),
    maxAttempts: int("max_attempts").notNull().default(5),
    statusCode: int("status_code"),
    responseSnippet: text("response_snippet"),
    durationMs: int("duration_ms"),
    error: text("error"),
    /** Próxima ventana en la que el cron debe intentar entregarla. */
    nextAttemptAt: timestamp("next_attempt_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    sentAt: timestamp("sent_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("webhook_deliveries_pending_idx").on(t.status, t.nextAttemptAt),
    index("webhook_deliveries_webhook_idx").on(t.webhookId, t.createdAt),
  ],
);

export const automations = mysqlTable(
  "automations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    /** Tipo discriminado de trigger. */
    triggerType: mysqlEnum("trigger_type", ["event", "form_submit", "cron", "webhook_in", "manual"])
      .notNull()
      .default("event"),
    /** Config del trigger según triggerType. */
    trigger: json("trigger").notNull().$type<unknown>(),
    conditions: json("conditions").$type<unknown>(),
    /** Lista ordenada de steps (acciones + control flow). */
    actions: json("actions").notNull().$type<unknown>(),
    active: boolean("active").notNull().default(true),
    /** Debounce en ms para evitar bursts (0 = sin debounce). */
    debounceMs: int("debounce_ms").notNull().default(0),
    /** Para trigger "webhook_in": secret HMAC. */
    webhookSecret: varchar("webhook_secret", { length: 255 }),
    lastRunAt: timestamp("last_run_at", { fsp: 3 }),
    runsTotal: int("runs_total").notNull().default(0),
    runsFailed: int("runs_failed").notNull().default(0),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("automations_ws_active_idx").on(t.workspaceId, t.active),
    uniqueIndex("automations_ws_slug_idx").on(t.workspaceId, t.slug),
    index("automations_trigger_idx").on(t.workspaceId, t.triggerType, t.active),
  ],
);

export const automationRuns = mysqlTable(
  "automation_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    automationId: varchar("automation_id", { length: 36 })
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    triggerEvent: varchar("trigger_event", { length: 120 }).notNull(),
    triggerPayload: json("trigger_payload"),
    status: mysqlEnum("status", ["pending", "running", "success", "failed", "skipped"])
      .notNull()
      .default("pending"),
    /** Snapshot del contexto compartido al final del run. */
    output: json("output"),
    error: text("error"),
    /** Timestamp para ejecución diferida. NULL = inmediato. */
    nextStepAt: timestamp("next_step_at", { fsp: 3 }),
    /** Index del próximo step (resume tras delay). */
    nextStepIndex: int("next_step_index").notNull().default(0),
    /** Contexto compartido. */
    context: json("context"),
    durationMs: int("duration_ms"),
    startedAt: timestamp("started_at", { fsp: 3 }),
    finishedAt: timestamp("finished_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("automation_runs_automation_idx").on(t.automationId, t.createdAt),
    index("automation_runs_pending_idx").on(t.status, t.nextStepAt),
  ],
);

/** Log granular por step ejecutado dentro de un run. */
export const automationSteps = mysqlTable(
  "automation_steps",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    runId: varchar("run_id", { length: 36 })
      .notNull()
      .references(() => automationRuns.id, { onDelete: "cascade" }),
    stepIndex: int("step_index").notNull(),
    /** Tipo del step (webhook | email | slack | ai | http | db.create | sleep | branch | ...). */
    type: varchar("type", { length: 60 }).notNull(),
    name: varchar("name", { length: 200 }),
    status: mysqlEnum("status", ["pending", "running", "success", "failed", "skipped"])
      .notNull()
      .default("pending"),
    input: json("input"),
    output: json("output"),
    error: text("error"),
    durationMs: int("duration_ms"),
    startedAt: timestamp("started_at", { fsp: 3 }),
    finishedAt: timestamp("finished_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("automation_steps_run_idx").on(t.runId, t.stepIndex)],
);

/**
 * Idempotency keys para POST/PATCH del REST API.
 */
export const idempotencyKeys = mysqlTable(
  "idempotency_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    apiKeyId: varchar("api_key_id", { length: 36 })
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 200 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 1024 }).notNull(),
    /** sha-256 del body para detectar reuso de key con cuerpo distinto. */
    requestHash: varchar("request_hash", { length: 128 }).notNull(),
    statusCode: int("status_code").notNull(),
    response: json("response").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("idempotency_keys_unique_idx").on(t.apiKeyId, t.key),
    index("idempotency_keys_expires_idx").on(t.expiresAt),
  ],
);

// ============================================================
// PAGES & SYMBOLS (visual builder)
// ============================================================
export const pages = mysqlTable(
  "pages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 1024 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    layout: json("layout").$type<unknown>(),
    themeId: varchar("theme_id", { length: 36 }),
    abTestId: varchar("ab_test_id", { length: 36 }),
    locale: varchar("locale", { length: 10 }).notNull().default("es"),
    status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
    seo: json("seo").$type<{ title?: string; description?: string; ogImage?: string }>(),
    isHome: boolean("is_home").notNull().default(false),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    authorId: varchar("author_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedById: varchar("updated_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("pages_ws_path_locale_idx").on(t.workspaceId, t.path, t.locale),
    index("pages_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

export const symbols = mysqlTable(
  "symbols",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    layout: json("layout").$type<unknown>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("symbols_ws_slug_idx").on(t.workspaceId, t.slug)],
);

// ============================================================
// SITE
// ============================================================
export const themes = mysqlTable(
  "themes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    basedOn: varchar("based_on", { length: 120 }),
    tokens: json("tokens"),
    fonts: json("fonts"),
    layouts: json("layouts"),
    blockOverrides: json("block_overrides"),
    ogTemplate: json("og_template"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("themes_ws_slug_idx").on(t.workspaceId, t.slug)],
);

export const menus = mysqlTable(
  "menus",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    location: mysqlEnum("location", ["header", "footer", "sidebar", "custom"])
      .notNull()
      .default("header"),
    /** Lista jerárquica de items. */
    items: json("items").$type<unknown>().notNull().default([]),
    /** Versión incremental — sube en cada save. */
    version: int("version").notNull().default(1),
    /** Default por location (un solo "true" por workspace+location). */
    isDefault: boolean("is_default").notNull().default(false),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("menus_ws_slug_idx").on(t.workspaceId, t.slug),
    index("menus_ws_location_idx").on(t.workspaceId, t.location),
  ],
);

export const redirects = mysqlTable(
  "redirects",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Patrón de match: path absoluto, prefix o regex JS. */
    source: varchar("source", { length: 2048 }).notNull(),
    /** Destino absoluto o relativo. */
    destination: varchar("destination", { length: 2048 }).notNull(),
    /** 301 | 302 | 307 | 308. */
    statusCode: int("status_code").notNull().default(301),
    matchType: mysqlEnum("match_type", ["exact", "prefix", "regex"]).notNull().default("exact"),
    /** Si prefix/regex, conserva la query string. */
    preserveQuery: boolean("preserve_query").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    description: text("description"),
    /** Counter de hits — incrementado async desde middleware. */
    hits: int("hits").notNull().default(0),
    lastHitAt: timestamp("last_hit_at", { fsp: 3 }),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("redirects_ws_source_idx").on(t.workspaceId, t.source),
    index("redirects_ws_enabled_idx").on(t.workspaceId, t.enabled),
  ],
);

export const settings = mysqlTable(
  "settings",
  {
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 120 }).notNull(),
    value: json("value"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

// ============================================================
// OBSERVABILITY
// ============================================================
export const activityLog = mysqlTable("activity_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }),
  actorId: varchar("actor_id", { length: 255 }),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("target_type", { length: 60 }),
  targetId: varchar("target_id", { length: 255 }),
  meta: json("meta"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  workspaceId: varchar("workspace_id", { length: 36 }),
  type: varchar("type", { length: 120 }).notNull(),
  payload: json("payload"),
  readAt: timestamp("read_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }),
    path: varchar("path", { length: 1024 }),
    anonId: varchar("anon_id", { length: 64 }),
    country: varchar("country", { length: 4 }),
    device: varchar("device", { length: 30 }),
    referrer: varchar("referrer", { length: 2048 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("analytics_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

// ============================================================
// A/B TESTING (F8c)
// ============================================================
/**
 * Tests A/B con allocation determinista. Variants viven en `variants` jsonb.
 * Ver `schema.pg.ts` para la documentación completa de semántica.
 */
export const abTests = mysqlTable(
  "ab_tests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Slug estable usado en el bloque `ab` y en window.csm.ab.* */
    key: varchar("key", { length: 120 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "running", "paused", "completed"])
      .notNull()
      .default("draft"),
    target: mysqlEnum("target", ["block", "page"]).notNull().default("block"),
    /** Si target=page, página host del test. */
    pageId: varchar("page_id", { length: 36 }),
    /** Variants JSON: array `{id,label,weight,isControl,pageId?}`. */
    variants: json("variants").$type<unknown>().notNull().default([]),
    /** Goal JSON. */
    goal: json("goal").$type<unknown>(),
    minSampleSize: int("min_sample_size").notNull().default(100),
    /** Variant id ganadora si el test cerró. */
    winnerVariantId: varchar("winner_variant_id", { length: 60 }),
    startedAt: timestamp("started_at", { fsp: 3 }),
    endedAt: timestamp("ended_at", { fsp: 3 }),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("ab_tests_ws_key_idx").on(t.workspaceId, t.key),
    index("ab_tests_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * Sticky assignment por (testId, anonId). PK compuesto evita duplicados.
 */
export const abAssignments = mysqlTable(
  "ab_assignments",
  {
    testId: varchar("test_id", { length: 36 })
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    anonId: varchar("anon_id", { length: 64 }).notNull(),
    variantId: varchar("variant_id", { length: 60 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    primaryKey({ columns: [t.testId, t.anonId] }),
    index("ab_assignments_ws_idx").on(t.workspaceId, t.testId),
  ],
);

/**
 * Eventos crudos de A/B testing.
 */
export const abEvents = mysqlTable(
  "ab_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    testId: varchar("test_id", { length: 36 })
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 60 }).notNull(),
    anonId: varchar("anon_id", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["impression", "conversion"]).notNull(),
    /** Valor numérico opcional (revenue, cantidad…). */
    value: int("value"),
    /** Metadata opcional. */
    meta: json("meta").$type<unknown>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("ab_events_test_kind_idx").on(t.testId, t.kind),
    index("ab_events_test_variant_kind_idx").on(t.testId, t.variantId, t.kind),
    index("ab_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("ab_events_test_anon_kind_idx").on(t.testId, t.anonId, t.kind),
  ],
);

// ============================================================
// IMPORTS (F9a) — wizard universal: WP/Notion/MD/Ghost/RSS/CSV
// ============================================================
/**
 * Una import es un "lote" iniciado al subir un archivo. Ver schema.pg.ts
 * para detalle completo de mapping/stats/error_log.
 */
export const imports = mysqlTable(
  "imports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: mysqlEnum("source", [
      "wordpress",
      "notion",
      "markdown",
      "ghost",
      "rss",
      "csv",
    ]).notNull(),
    status: mysqlEnum("status", ["uploaded", "ready", "running", "completed", "failed", "reverted"])
      .notNull()
      .default("uploaded"),
    /** Storage key del archivo subido. */
    fileKey: varchar("file_key", { length: 1024 }),
    fileName: varchar("file_name", { length: 500 }),
    fileSize: int("file_size"),
    mediaPolicy: mysqlEnum("media_policy", ["download", "link", "skip"]).notNull().default("link"),
    /** Mapping source field → CSM target. */
    mapping: json("mapping").$type<unknown>(),
    /** Stats agregadas. */
    stats: json("stats").$type<unknown>(),
    /** Hasta 100 errores recientes. */
    errorLog: json("error_log").$type<unknown>(),
    dryRun: boolean("dry_run").notNull().default(false),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    revertedAt: timestamp("reverted_at", { fsp: 3 }),
  },
  (t) => [
    index("imports_ws_status_idx").on(t.workspaceId, t.status),
    index("imports_ws_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

/**
 * Log per-item de una import. Ver schema.pg.ts para semántica de revert/re-run.
 */
export const importItems = mysqlTable(
  "import_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    importId: varchar("import_id", { length: 36 })
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["entry", "term", "media", "comment"]).notNull(),
    /** Id del sistema de origen (post_id WP, page_id Notion, slug MD, guid RSS…). */
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    /** URL original (cuando aplica) — usada para crear redirects auto post-import. */
    sourceUrl: varchar("source_url", { length: 2048 }),
    status: mysqlEnum("status", ["pending", "imported", "skipped", "failed", "reverted"])
      .notNull()
      .default("pending"),
    /** Id en CSM tras importar. */
    targetId: varchar("target_id", { length: 36 }),
    /** Mensaje de error si status=failed. */
    error: text("error"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    importedAt: timestamp("imported_at", { fsp: 3 }),
  },
  (t) => [
    uniqueIndex("import_items_lot_kind_source_idx").on(t.importId, t.kind, t.sourceId),
    index("import_items_import_status_idx").on(t.importId, t.status),
    index("import_items_ws_kind_idx").on(t.workspaceId, t.kind),
  ],
);

// ============================================================
// CONTENT HEALTH — snapshot por entry + issues detallados (F10c)
// ============================================================
/**
 * Snapshot del último escaneo por entry (1:1 con `entries`).
 */
export const entryHealth = mysqlTable(
  "entry_health",
  {
    entryId: varchar("entry_id", { length: 36 })
      .primaryKey()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** 0-100. Calculado server-side. */
    score: int("score").notNull().default(100),
    /** Conteo agrupado por severidad. */
    counts: json("counts")
      .$type<{ low: number; medium: number; high: number; critical: number }>()
      .notNull()
      .default({ low: 0, medium: 0, high: 0, critical: 0 }),
    scannedAt: timestamp("scanned_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    /** Hash determinista del input del scan. */
    inputHash: varchar("input_hash", { length: 128 }),
  },
  (t) => [
    index("entry_health_ws_score_idx").on(t.workspaceId, t.score),
    index("entry_health_ws_scanned_idx").on(t.workspaceId, t.scannedAt),
  ],
);

/**
 * Issues individuales detectados. 1 entry → N issues. Reemplazo en bloque al re-escanear.
 */
export const entryHealthIssues = mysqlTable(
  "entry_health_issues",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", [
      "broken_link",
      "outdated_date",
      "missing_alt",
      "seo_title_length",
      "seo_meta_missing",
      "heading_hierarchy",
      "thin_content",
      "duplicate_slug",
      "orphan_entry",
    ]).notNull(),
    severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
    /** Mensaje legible en español. */
    message: text("message").notNull(),
    /** Sugerencia accionable. */
    suggestion: text("suggestion"),
    /** Localización opcional dentro del entry. */
    location: json("location").$type<Record<string, unknown>>(),
    detectedAt: timestamp("detected_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    /** Si user marca como "ignorar", se setea sin borrar. */
    dismissedAt: timestamp("dismissed_at", { fsp: 3 }),
    dismissedById: varchar("dismissed_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("entry_health_issues_entry_idx").on(t.entryId),
    index("entry_health_issues_ws_type_idx").on(t.workspaceId, t.type),
    index("entry_health_issues_ws_severity_idx").on(t.workspaceId, t.severity),
  ],
);

/**
 * Uso diario de IA por workspace + user + feature.
 *
 * NOTA MySQL: Postgres usa expression unique con COALESCE para tratar userId=NULL
 * como key estable. MySQL 8.0.13+ soporta functional indexes pero la sintaxis
 * difiere. Aquí mantenemos el unique compuesto sin COALESCE; el caller debe
 * normalizar `userId = ''` (empty string) en lugar de NULL antes del UPSERT.
 * Ver `recordAiUsage()` en `src/ai/usage.ts`.
 */
export const aiUsageDaily = mysqlTable(
  "ai_usage_daily",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** En MySQL: '' (empty) en lugar de NULL para que el UNIQUE compuesto funcione. */
    userId: varchar("user_id", { length: 255 }),
    /** 'YYYY-MM-DD' UTC. */
    day: varchar("day", { length: 10 }).notNull(),
    feature: varchar("feature", { length: 60 }).notNull(),
    callsCount: int("calls_count").notNull().default(0),
    /** Microudólares (1 USD = 1_000_000). Integer atómico SQL. */
    costMicrosUsd: int("cost_micros_usd").notNull().default(0),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    // PG usa COALESCE(userId, '') para que NULL no rompa UNIQUE. En MySQL exigimos
    // que el caller siempre setee '' (no NULL); el unique funciona directamente.
    uniqueIndex("ai_usage_daily_unique_idx").on(t.workspaceId, t.userId, t.day, t.feature),
    index("ai_usage_daily_ws_day_idx").on(t.workspaceId, t.day),
  ],
);

/**
 * Reportes CSP agregados — un row por (directiva + recurso bloqueado + origen).
 *
 * NOTA MySQL: PG tiene `csp_reports_unresolved_idx` partial (WHERE resolvedAt IS NULL)
 * para listing rápido de unresolved. MySQL no tiene partial → bajamos a non-unique
 * regular index sobre lastSeenAt; queries filtran a nivel app.
 */
export const cspReports = mysqlTable(
  "csp_reports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    /** Hash determinista sobre directive+blockedUri+sourceFile+lineNumber. UNIQUE. */
    dedupKey: varchar("dedup_key", { length: 128 }).notNull(),
    blockedUri: varchar("blocked_uri", { length: 2048 }),
    violatedDirective: varchar("violated_directive", { length: 60 }).notNull(),
    effectiveDirective: varchar("effective_directive", { length: 60 }),
    documentUri: varchar("document_uri", { length: 2048 }),
    sourceFile: varchar("source_file", { length: 2048 }),
    lineNumber: int("line_number"),
    columnNumber: int("column_number"),
    /** Snippet ofensivo (cap 500 chars). */
    sample: varchar("sample", { length: 500 }),
    userAgentHash: varchar("user_agent_hash", { length: 64 }),
    /** "enforce" o "report". */
    disposition: varchar("disposition", { length: 30 }),
    occurrences: int("occurrences").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    lastSeenAt: timestamp("last_seen_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
    resolvedById: varchar("resolved_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("csp_reports_dedup_idx").on(t.dedupKey),
    index("csp_reports_directive_last_seen_idx").on(t.violatedDirective, t.lastSeenAt),
    // PG: partial WHERE resolvedAt IS NULL. MySQL: regular index, filtrar app-side.
    index("csp_reports_unresolved_idx").on(t.lastSeenAt, t.resolvedAt),
  ],
);

// ============================================================
// COLLAB realtime (F10b — Y.js + LISTEN/NOTIFY)
// ============================================================
/**
 * Snapshot consolidado del Y.Doc por entry. Una fila por entry.
 */
export const collabSnapshots = mysqlTable("collab_snapshots", {
  entryId: varchar("entry_id", { length: 36 })
    .primaryKey()
    .references(() => entries.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  /** base64 de Uint8Array — Y.encodeStateAsUpdate(doc) */
  state: text("state").notNull(),
  /** Tamaño en bytes del binary state. */
  bytes: int("bytes").notNull().default(0),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

/**
 * Log de updates incrementales del Y.Doc.
 */
export const collabUpdates = mysqlTable(
  "collab_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    entryId: varchar("entry_id", { length: 36 })
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** base64 de Uint8Array (Y.js update binary). */
    update: text("update").notNull(),
    clientId: varchar("client_id", { length: 64 }),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("collab_updates_entry_created_idx").on(t.entryId, t.createdAt)],
);

/**
 * Sesiones de presencia activa en el admin (F10b — global presence).
 *
 * NOTA MySQL: PG tiene `presence_ws_entry_idx` partial (WHERE entryId NOT NULL).
 * Bajado a non-unique sin partial; queries filtran app-side.
 */
export const presenceSessions = mysqlTable(
  "presence_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Generado por el cliente, único por pestaña. */
    clientId: varchar("client_id", { length: 64 }).notNull(),
    route: varchar("route", { length: 1024 }).notNull(),
    /** Extraído de `route` server-side. */
    entryId: varchar("entry_id", { length: 36 }),
    lastSeenAt: timestamp("last_seen_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("presence_ws_client_idx").on(t.workspaceId, t.clientId),
    index("presence_ws_lastseen_idx").on(t.workspaceId, t.lastSeenAt),
    index("presence_ws_entry_idx").on(t.workspaceId, t.entryId),
  ],
);

/**
 * Reactions emoji sobre mensajes editorial F9c (F10b — realtime reactions live).
 */
export const editorialReactions = mysqlTable(
  "editorial_reactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: varchar("message_id", { length: 36 })
      .notNull()
      .references(() => editorialMessages.id, { onDelete: "cascade" }),
    threadId: varchar("thread_id", { length: 36 })
      .notNull()
      .references(() => editorialThreads.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Caracter unicode (cap 8 chars). */
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("editorial_reactions_unique_idx").on(t.messageId, t.userId, t.emoji),
    index("editorial_reactions_thread_idx").on(t.threadId, t.createdAt),
  ],
);

// ============================================================
// AI Provider configs — keys encriptadas + modelo por workspace
// ============================================================
// Las API keys se guardan ENCRIPTADAS via `encryptKey()` (AES-256-GCM
// derivado de AUTH_SECRET). Una fila por (workspace, provider).
export const aiProviderConfigs = mysqlTable(
  "ai_provider_configs",
  {
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    // base64(iv|ciphertext|tag) o "" si no se ha guardado key (ej. ollama).
    apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
    model: varchar("model", { length: 120 }).notNull().default(""),
    baseUrl: varchar("base_url", { length: 500 }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.provider] })],
);

// ============================================================
// F11a — Slug history (redirects 301 al renombrar el subdominio)
// ============================================================
export const workspaceSlugHistory = mysqlTable(
  "workspace_slug_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    oldSlug: varchar("old_slug", { length: 100 }).notNull(),
    changedAt: timestamp("changed_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("workspace_slug_history_old_slug_idx").on(t.oldSlug),
    index("workspace_slug_history_ws_idx").on(t.workspaceId),
    index("workspace_slug_history_expires_idx").on(t.expiresAt),
  ],
);

// ============================================================
// F11a — Custom domain verification state
// ============================================================
export const workspaceDomains = mysqlTable(
  "workspace_domains",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    verifyToken: varchar("verify_token", { length: 64 }).notNull(),
    verifiedAt: timestamp("verified_at", { fsp: 3 }),
    lastCheckedAt: timestamp("last_checked_at", { fsp: 3 }),
    lastCheckError: varchar("last_check_error", { length: 500 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("workspace_domains_domain_idx").on(t.domain),
    index("workspace_domains_ws_idx").on(t.workspaceId),
  ],
);

// ============================================================
// Type exports — IDÉNTICOS lógicamente a schema.pg.ts.
// El barrel `src/db/schema.ts` siempre re-exporta de schema.pg.ts; estos
// exports se cargan en runtime cuando dialect=mysql.
// ============================================================

// Auth
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

// Workspaces
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

// Content
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type SearchIndexJob = typeof searchIndexJobs.$inferSelect;

// Pages & symbols
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Symbol = typeof symbols.$inferSelect;
export type NewSymbol = typeof symbols.$inferInsert;

// Site
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;

// Platform
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyAuditRow = typeof apiKeyAudit.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;
export type AutomationStep = typeof automationSteps.$inferSelect;
export type NewAutomationStep = typeof automationSteps.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

// Forms
export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type FormVersion = typeof formVersions.$inferSelect;
export type NewFormVersion = typeof formVersions.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

// Growth
export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type NewCampaignRecipient = typeof campaignRecipients.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type Drip = typeof drips.$inferSelect;
export type NewDrip = typeof drips.$inferInsert;
export type DripEnrollment = typeof dripEnrollments.$inferSelect;
export type NewDripEnrollment = typeof dripEnrollments.$inferInsert;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
export type SubscriberConfirmation = typeof subscriberConfirmations.$inferSelect;
export type NewSubscriberConfirmation = typeof subscriberConfirmations.$inferInsert;
export type NewSubscriber = typeof subscribers.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Tier = typeof tiers.$inferSelect;
export type NewTier = typeof tiers.$inferInsert;
export type MemberSession = typeof memberSessions.$inferSelect;
export type NewMemberSession = typeof memberSessions.$inferInsert;
export type MemberMagicLink = typeof memberMagicLinks.$inferSelect;
export type NewMemberMagicLink = typeof memberMagicLinks.$inferInsert;
export type MemberEvent = typeof memberEvents.$inferSelect;
export type NewMemberEvent = typeof memberEvents.$inferInsert;
export type PersonalizationRule = typeof personalizationRules.$inferSelect;
export type NewPersonalizationRule = typeof personalizationRules.$inferInsert;

// A/B testing
export type AbTest = typeof abTests.$inferSelect;
export type NewAbTest = typeof abTests.$inferInsert;
export type AbAssignment = typeof abAssignments.$inferSelect;
export type NewAbAssignment = typeof abAssignments.$inferInsert;
export type AbEvent = typeof abEvents.$inferSelect;
export type NewAbEvent = typeof abEvents.$inferInsert;

// Imports
export type ImportRow = typeof imports.$inferSelect;
export type NewImportRow = typeof imports.$inferInsert;
export type ImportItem = typeof importItems.$inferSelect;
export type NewImportItem = typeof importItems.$inferInsert;

// Branching
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type BranchActivity = typeof branchActivity.$inferSelect;
export type NewBranchActivity = typeof branchActivity.$inferInsert;
export type BranchComment = typeof branchComments.$inferSelect;
export type NewBranchComment = typeof branchComments.$inferInsert;
/** Literal union type — mismo set que el enum Postgres. */
export type EntryBranchState = "forked" | "new" | "deleted";
/** Literal union type — mismo set que el enum Postgres. */
export type BranchActivityType =
  | "branch.created"
  | "branch.renamed"
  | "branch.protected_changed"
  | "branch.preview_token_rotated"
  | "branch.rebased"
  | "branch.merge_attempted"
  | "branch.merge_failed"
  | "branch.merged"
  | "branch.abandoned"
  | "branch.restored"
  | "entry.forked"
  | "entry.edited"
  | "entry.created_in_branch"
  | "entry.deleted_in_branch"
  | "entry.reverted_in_branch"
  | "comment.added"
  | "comment.resolved";

// Notifications
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// F9c — Editorial
export type EntryStatus = "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
export type EntryPriority = "low" | "normal" | "high" | "urgent";
export type EditorialAssignmentRole = "writer" | "reviewer" | "approver";
export type EditorialThreadStatus = "open" | "resolved";
export type EditorialEventType =
  | "status.changed"
  | "assignment.added"
  | "assignment.removed"
  | "assignment.completed"
  | "due.changed"
  | "priority.changed"
  | "scheduled.changed"
  | "comment.added"
  | "comment.resolved"
  | "approval.locked"
  | "approval.released"
  | "sla.breach";
export type EntryAssignment = typeof entryAssignments.$inferSelect;
export type NewEntryAssignment = typeof entryAssignments.$inferInsert;
export type EntryWorkflowEvent = typeof entryWorkflowEvents.$inferSelect;
export type NewEntryWorkflowEvent = typeof entryWorkflowEvents.$inferInsert;
export type EditorialThread = typeof editorialThreads.$inferSelect;
export type NewEditorialThread = typeof editorialThreads.$inferInsert;
export type EditorialMessage = typeof editorialMessages.$inferSelect;
export type NewEditorialMessage = typeof editorialMessages.$inferInsert;
export type EditorialCalendarToken = typeof editorialCalendarTokens.$inferSelect;
export type NewEditorialCalendarToken = typeof editorialCalendarTokens.$inferInsert;

// F10c — Content Health
export type HealthSeverity = "low" | "medium" | "high" | "critical";
export type HealthIssueType =
  | "broken_link"
  | "outdated_date"
  | "missing_alt"
  | "seo_title_length"
  | "seo_meta_missing"
  | "heading_hierarchy"
  | "thin_content"
  | "duplicate_slug"
  | "orphan_entry";
export type EntryHealth = typeof entryHealth.$inferSelect;
export type NewEntryHealth = typeof entryHealth.$inferInsert;
export type EntryHealthIssue = typeof entryHealthIssues.$inferSelect;
export type NewEntryHealthIssue = typeof entryHealthIssues.$inferInsert;

// AI usage / observability
export type AiUsageDaily = typeof aiUsageDaily.$inferSelect;
export type CspReport = typeof cspReports.$inferSelect;
export type NewCspReport = typeof cspReports.$inferInsert;

// Collab realtime (F10b)
export type CollabSnapshot = typeof collabSnapshots.$inferSelect;
export type NewCollabSnapshot = typeof collabSnapshots.$inferInsert;
export type CollabUpdate = typeof collabUpdates.$inferSelect;
export type NewCollabUpdate = typeof collabUpdates.$inferInsert;
export type PresenceSession = typeof presenceSessions.$inferSelect;
export type NewPresenceSession = typeof presenceSessions.$inferInsert;
export type EditorialReaction = typeof editorialReactions.$inferSelect;
export type NewEditorialReaction = typeof editorialReactions.$inferInsert;

// AI provider config
export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type NewAiProviderConfig = typeof aiProviderConfigs.$inferInsert;

// F11a — Domain & slug history
export type WorkspaceSlugHistory = typeof workspaceSlugHistory.$inferSelect;
export type NewWorkspaceSlugHistory = typeof workspaceSlugHistory.$inferInsert;
export type WorkspaceDomain = typeof workspaceDomains.$inferSelect;
export type NewWorkspaceDomain = typeof workspaceDomains.$inferInsert;
