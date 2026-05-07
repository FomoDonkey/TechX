import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS
// ============================================================
export const roleEnum = pgEnum("role", ["owner", "admin", "editor", "author", "viewer"]);
export const entryStatusEnum = pgEnum("entry_status", [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
]);
export const entryPriorityEnum = pgEnum("entry_priority", ["low", "normal", "high", "urgent"]);
/**
 * Rol de un assignee dentro del workflow editorial. Un entry puede tener múltiples assignees,
 * pero **a lo sumo uno por rol** (`writer | reviewer | approver`). El claim atómico de la
 * aprobación se hace contra `entries.lockedForApprovalById` (no aquí), ver workflow.ts.
 */
export const editorialAssignmentRoleEnum = pgEnum("editorial_assignment_role", [
  "writer",
  "reviewer",
  "approver",
]);
export const editorialThreadStatusEnum = pgEnum("editorial_thread_status", ["open", "resolved"]);
/**
 * Tipos de evento auditables del workflow editorial. Sirven tanto para el timeline
 * por entry como para la generación de notifications.
 */
export const editorialEventTypeEnum = pgEnum("editorial_event_type", [
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
]);
export const commentStatusEnum = pgEnum("comment_status", ["pending", "approved", "spam"]);
export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
  "bounced",
]);
export const taxonomyTypeEnum = pgEnum("taxonomy_type", ["category", "tag"]);
export const branchStatusEnum = pgEnum("branch_status", [
  "draft",
  "merging",
  "merged",
  "abandoned",
]);
/**
 * Estado de una entry dentro de una branch ≠ main.
 * Sólo persistido cuando `entries.branchId IS NOT NULL`. En main la columna es NULL.
 * - `forked`: copy-on-write de una entry de main (originalEntryId apunta a la entry origen).
 * - `new`: entry creada dentro de la branch, no existe en main todavía.
 * - `deleted`: tombstone — la entry de main correspondiente debe borrarse al merge.
 */
export const entryBranchStateEnum = pgEnum("entry_branch_state", ["forked", "new", "deleted"]);
export const branchActivityTypeEnum = pgEnum("branch_activity_type", [
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
]);
export const branchCommentStatusEnum = pgEnum("branch_comment_status", ["open", "resolved"]);
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
  "retrying",
  "dropped",
]);
export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
]);
export const formStatusEnum = pgEnum("form_status", ["draft", "published", "archived"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "received",
  "spam",
  "processed",
  "archived",
]);
export const automationTriggerTypeEnum = pgEnum("automation_trigger_type", [
  "event",
  "form_submit",
  "cron",
  "webhook_in",
  "manual",
]);
export const automationStepStatusEnum = pgEnum("automation_step_status", [
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
]);
export const menuLocationEnum = pgEnum("menu_location", ["header", "footer", "sidebar", "custom"]);
export const redirectMatchTypeEnum = pgEnum("redirect_match_type", ["exact", "prefix", "regex"]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "failed",
]);
export const campaignRecipientStatusEnum = pgEnum("campaign_recipient_status", [
  "pending",
  "sending",
  "sent",
  "bounced",
  "complained",
  "failed",
  "unsubscribed",
]);
export const dripStatusEnum = pgEnum("drip_status", ["draft", "active", "paused"]);
export const dripEnrollmentStatusEnum = pgEnum("drip_enrollment_status", [
  "active",
  "completed",
  "cancelled",
  "paused",
]);
export const dripTriggerTypeEnum = pgEnum("drip_trigger_type", [
  "subscribe_confirmed",
  "tag_added",
  "manual",
]);
export const emailEventTypeEnum = pgEnum("email_event_type", [
  "queued",
  "sent",
  "delivered",
  "open",
  "click",
  "bounce",
  "complaint",
  "unsubscribe",
  "failed",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export const tierIntervalEnum = pgEnum("tier_interval", ["month", "year", "lifetime"]);
export const memberEventTypeEnum = pgEnum("member_event_type", [
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
]);
export const abTestStatusEnum = pgEnum("ab_test_status", [
  "draft",
  "running",
  "paused",
  "completed",
]);
export const abTestTargetEnum = pgEnum("ab_test_target", ["block", "page"]);
export const abEventKindEnum = pgEnum("ab_event_kind", ["impression", "conversion"]);

export const importSourceEnum = pgEnum("import_source", [
  "wordpress",
  "notion",
  "markdown",
  "ghost",
  "rss",
  "csv",
]);
export const importStatusEnum = pgEnum("import_status", [
  "uploaded",
  "ready",
  "running",
  "completed",
  "failed",
  "reverted",
]);
export const importItemKindEnum = pgEnum("import_item_kind", ["entry", "term", "media", "comment"]);
export const importItemStatusEnum = pgEnum("import_item_status", [
  "pending",
  "imported",
  "skipped",
  "failed",
  "reverted",
]);
export const importMediaPolicyEnum = pgEnum("import_media_policy", ["download", "link", "skip"]);

// ============================================================
// CONTENT HEALTH (F10c · diario, único en CMS open-source 2026)
// ============================================================
/**
 * Severidad de un issue detectado por el motor de Content Health Scan.
 * Pesa en el score: critical=20, high=10, medium=5, low=2 (sumadas y restadas a 100).
 */
export const healthSeverityEnum = pgEnum("health_severity", ["low", "medium", "high", "critical"]);

/**
 * Tipos de issue detectables. Si añades uno nuevo, recuerda exportarlo en
 * `src/health/types.ts` y mapear su weight en `severity → score`.
 */
export const healthIssueTypeEnum = pgEnum("health_issue_type", [
  "broken_link",
  "outdated_date",
  "missing_alt",
  "seo_title_length",
  "seo_meta_missing",
  "heading_hierarchy",
  "thin_content",
  "duplicate_slug",
  "orphan_entry",
]);

// ============================================================
// AUTH (Better-Auth tables)
// ============================================================
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    locale: text("locale").default("es"),
    timezone: text("timezone").default("Europe/Madrid"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    onboardedAt: timestamp("onboarded_at"),
    handle: text("handle"),
    bio: text("bio"),
    website: text("website"),
    twitter: text("twitter"),
    /**
     * GDPR derecho al olvido. Cuando el user solicita eliminación:
     *  - `deletionRequestedAt = now()` → cuenta queda en "grace period" (30 días).
     *  - El user puede cancelar antes de que expire para revertir.
     *  - Tras 30 días, cron `daily` ejecuta hard-delete (FK cascade limpia el resto).
     * `deletedAt` queda como tombstone si ejecutamos soft-delete antes (UI puede mostrar
     * "cuenta cerrada" sin perder integridad referencial inmediata).
     */
    deletionRequestedAt: timestamp("deletion_requested_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_handle_idx").on(t.handle),
    index("users_deletion_requested_idx").on(t.deletionRequestedAt),
  ],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Passkeys (WebAuthn) — Better-Auth plugin
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  transports: text("transports"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Two-factor (TOTP backup codes) — Better-Auth plugin
export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/**
 * Rate-limit storage usado por Better-Auth (modo `storage: "database"`).
 * `key` = `${ip}:${normalizedPath}` (formato interno de Better-Auth).
 * `lastRequest` es ms epoch en bigint para sobrevivir a 2038 sin sustos.
 *
 * F10a parte 2 bloque 2 (2026-05-04): único almacén persistente cross-instancia
 * para serverless (Vercel Fluid Compute). Memory storage no funciona porque
 * cada instancia tiene su propio contador y el atacante rota.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("last_request").notNull(),
  },
  (t) => [uniqueIndex("rate_limits_key_idx").on(t.key)],
);

// ============================================================
// WORKSPACES (multi-tenant core)
// ============================================================
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    branding: jsonb("branding").$type<{
      logo?: string;
      colors?: { primary?: string; accent?: string };
      font?: string;
      voice?: string;
    }>(),
    aiProvider: text("ai_provider").default("groq"),
    defaultLocale: text("default_locale").default("es"),
    locales: text("locales").array().default(sql`ARRAY['es']::text[]`),
    customDomain: text("custom_domain"),
    activeThemeSlug: text("active_theme_slug").default("magazine"),
    ogTemplate: jsonb("og_template"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspaces_slug_idx").on(t.slug)],
);

export const members = pgTable(
  "members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("editor"),
    invitedBy: text("invited_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("editor"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  invitedBy: text("invited_by").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// CONTENT
// ============================================================
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    icon: text("icon"),
    description: text("description"),
    schema: jsonb("schema").$type<unknown>(),
    isSingleton: boolean("is_singleton").notNull().default(false),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    listView: jsonb("list_view"),
    /**
     * Configuración del workflow editorial por colección (F9c). NULL = defaults
     * globales (review opcional, sin SLA, sin asignaciones obligatorias).
     *
     *   {
     *     requireReviewer?: boolean,        // bloquea draft→review→approved sin reviewer
     *     requireApprover?: boolean,        // bloquea approved sin approver distinto del writer
     *     defaultSlaHours?: number,         // SLA default al asignar reviewer/approver
     *     defaultPriority?: "low|normal|high|urgent",
     *     skipReview?: boolean,             // permite draft→scheduled directo (newsletters)
     *     allowSelfApprove?: boolean,       // si false, el writer no puede ser approver
     *   }
     */
    workflowConfig: jsonb("workflow_config").$type<{
      requireReviewer?: boolean;
      requireApprover?: boolean;
      defaultSlaHours?: number;
      defaultPriority?: "low" | "normal" | "high" | "urgent";
      skipReview?: boolean;
      allowSelfApprove?: boolean;
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collections_ws_slug_idx").on(t.workspaceId, t.slug)],
);

/**
 * Branches de contenido. Una rama `isDefault=true` por workspace representa "main"
 * (creada en backfill F9b). Las entries con `branchId IS NULL` siguen siendo "en main"
 * por compatibilidad con el data legacy (F0-F9a) — `branches.isDefault` se usa para
 * metadata, permisos y activity log de main, no como FK obligatoria.
 *
 * Convenciones:
 * - `slug` único por workspace, lowercase, kebab-case (`feat/v3-redesign`, `hotfix-typo`).
 * - `isProtected=true` → no se puede borrar ni mergear sin role>=admin (always true para main).
 * - `previewToken`: read-only token público para `/preview/branch/[token]/...` (rotable).
 * - `status='merging'` claim atómico durante merge (evita race entre dos clicks).
 */
export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** true para la branch "main" del workspace. Hay exactamente una con esta marca. */
    isDefault: boolean("is_default").notNull().default(false),
    /** Branch protegida: solo admin puede borrar/mergear. main es protected=true. */
    isProtected: boolean("is_protected").notNull().default(false),
    /** Branch base de la que se forkeó (NULL = forked desde main). */
    baseBranchId: uuid("base_branch_id"),
    status: branchStatusEnum("status").notNull().default("draft"),
    /**
     * Reglas avanzadas de protección que deben cumplirse antes de mergear.
     * `null` = sin reglas adicionales (sólo el flag `isProtected` controla borrado/merge).
     * Cuando está presente, `mergeBranch` valida cada regla y devuelve
     * `protectionBlocked` con el listado de blockers si no se cumplen.
     */
    protectionConfig: jsonb("protection_config").$type<{
      requireReviewers: number;
      requireApprovers: number;
      requireCommentsResolved: boolean;
      requireStatusApproved: boolean;
    }>(),
    /** Color OKLCH para pill (visual differentiation en topbar/listing). */
    color: text("color").default("oklch(0.55 0.22 290)"),
    /** Icono Lucide name. */
    icon: text("icon").default("git-branch"),
    /** Token rotable, sirve preview público read-only en `/preview/branch/[token]/...`. */
    previewToken: text("preview_token"),
    /** Hash bcrypt-like opcional (sha256 ok) para preview con contraseña. NULL = público. */
    previewPasswordHash: text("preview_password_hash"),
    /** Si se define, el preview deja de funcionar tras esta fecha. */
    previewExpiresAt: timestamp("preview_expires_at"),
    /** Contador best-effort de hits al preview (visible en activity). */
    previewViews: integer("preview_views").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    mergedAt: timestamp("merged_at"),
    mergedById: text("merged_by_id").references(() => users.id, { onDelete: "set null" }),
    abandonedAt: timestamp("abandoned_at"),
    abandonedById: text("abandoned_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("branches_ws_slug_idx").on(t.workspaceId, t.slug),
    // Una sola main por workspace.
    uniqueIndex("branches_ws_default_idx")
      .on(t.workspaceId)
      .where(sql`${t.isDefault} = true`),
    // Lookup rápido por preview token (público).
    uniqueIndex("branches_preview_token_idx")
      .on(t.previewToken)
      .where(sql`${t.previewToken} IS NOT NULL`),
    index("branches_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * Timeline rico de eventos por branch. Útil para audit + UI lateral.
 * Eventos versioned (ver `branchActivityTypeEnum`); `payload` documentado por tipo.
 */
export const branchActivity = pgTable(
  "branch_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    /** UUID de la entry afectada (si aplica). NO es FK estricta — la entry puede haberse borrado. */
    entryId: uuid("entry_id"),
    type: branchActivityTypeEnum("type").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("branch_activity_branch_created_idx").on(t.branchId, t.createdAt),
    index("branch_activity_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("branch_activity_entry_idx").on(t.entryId),
  ],
);

/**
 * Comentarios anclados a una branch. Pueden estar a 4 niveles:
 * 1. branch (entryId, blockId, anchorRange = NULL): comentario sobre la branch en general
 * 2. entry-level (entryId, blockId=NULL, anchorRange=NULL): comentario sobre una entry
 * 3. block-level (entryId, blockId, anchorRange=NULL): comentario sobre un bloque
 * 4. range-level (entryId, blockId, anchorRange={from,to}): comentario sobre selección
 */
export const branchComments = pgTable(
  "branch_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id"),
    blockId: text("block_id"),
    anchorRange: jsonb("anchor_range").$type<{ from: number; to: number }>(),
    parentId: uuid("parent_id").references((): AnyPgColumn => branchComments.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Mentions @user — array de userIds para envío de notificaciones. */
    mentions: text("mentions").array(),
    body: text("body").notNull(),
    status: branchCommentStatusEnum("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("branch_comments_branch_created_idx").on(t.branchId, t.createdAt),
    index("branch_comments_branch_status_idx").on(t.branchId, t.status),
    index("branch_comments_entry_idx").on(t.entryId, t.createdAt),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    /**
     * Sólo poblado cuando `branchId IS NOT NULL` y `branchState='forked'|'deleted'`.
     * Apunta a la entry de main de la que esta fila es copy-on-write.
     * NO es FK estricta (set NULL on delete) — si la entry de main se borra,
     * la fork se convierte en huérfana hasta que el merge la promueva o se descarte.
     */
    originalEntryId: uuid("original_entry_id"),
    /**
     * Sólo poblado cuando `branchId IS NOT NULL`. NULL para entries en main.
     * Ver `entryBranchStateEnum` para semántica.
     */
    branchState: entryBranchStateEnum("branch_state"),
    /**
     * `entries.updatedAt` de la entry main al momento de hacer COW. Sirve para
     * detectar conflictos: si la entry main fue editada después de este snapshot,
     * el merge requiere resolución manual.
     */
    branchedFromUpdatedAt: timestamp("branched_from_updated_at"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    body: jsonb("body").$type<unknown>(),
    bodyText: text("body_text"),
    coverId: uuid("cover_id"),
    status: entryStatusEnum("status").notNull().default("draft"),
    locale: text("locale").notNull().default("es"),
    parentTranslationId: uuid("parent_translation_id"),
    scheduledAt: timestamp("scheduled_at"),
    publishedAt: timestamp("published_at"),
    /**
     * Deadline editorial — SLA-driven (F9c). Cuando NULL, no hay SLA.
     * Distinto de `scheduledAt`: due es objetivo interno, scheduledAt es momento de publicación.
     */
    dueAt: timestamp("due_at"),
    /** Prioridad editorial (F9c). Default: normal. */
    priority: entryPriorityEnum("priority").notNull().default("normal"),
    /**
     * Aprobación atómica (F9c). Cuando un approver ejecuta `approve`,
     * `UPDATE WHERE lockedForApprovalById IS NULL RETURNING` reserva el slot
     * y hace la transición a `approved` en una sola query. Anti-race.
     */
    lockedForApprovalAt: timestamp("locked_for_approval_at"),
    lockedForApprovalById: text("locked_for_approval_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    seo: jsonb("seo").$type<{ title?: string; description?: string; ogImage?: string }>(),
    ogImageUrl: text("og_image_url"),
    embedding: vector("embedding", { dimensions: 1536 }),
    fields: jsonb("fields").$type<Record<string, unknown>>(),
    /**
     * `${source}:${kind}:${sourceId}` — set por el importer cuando una entry
     * proviene de un sistema externo. Usado para idempotencia en re-imports
     * (re-run del mismo archivo no duplica, hace UPDATE).
     */
    originRef: text("origin_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    uniqueIndex("entries_ws_origin_ref_idx")
      .on(t.workspaceId, t.originRef)
      .where(sql`${t.originRef} IS NOT NULL`),
    // Una entry main sólo puede tener una fork por branch (COW idempotente).
    uniqueIndex("entries_branch_original_idx")
      .on(t.branchId, t.originalEntryId)
      .where(sql`${t.branchId} IS NOT NULL AND ${t.originalEntryId} IS NOT NULL`),
    index("entries_ws_branch_idx").on(t.workspaceId, t.branchId),
    // F9c: scheduling — calendar query principal (range scan por scheduledAt o dueAt).
    index("entries_ws_scheduled_idx").on(t.workspaceId, t.scheduledAt),
    index("entries_ws_due_idx").on(t.workspaceId, t.dueAt),
  ],
);

export const revisions = pgTable("revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  body: jsonb("body").$type<unknown>(),
  summary: text("summary"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// EDITORIAL — F9c (assignments, workflow events, threads, ical tokens)
// ============================================================
/**
 * Asignaciones editoriales por entry. Una entry puede tener varias asignaciones,
 * a lo sumo una por (entry, role, NOT completed). Cuando completas, `completedAt`
 * pasa a NOT NULL y la unique parcial libera el slot para el siguiente assignee
 * del mismo rol. El SLA se calcula sobre `createdAt + slaHours` (o `dueAt` propio).
 */
export const entryAssignments = pgTable(
  "entry_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    assigneeId: text("assignee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: editorialAssignmentRoleEnum("role").notNull(),
    /** Deadline propio de la asignación (sobreescribe slaHours si se define). */
    dueAt: timestamp("due_at"),
    /** SLA en horas desde createdAt; usado para calcular dueAt si dueAt es NULL. */
    slaHours: integer("sla_hours"),
    completedAt: timestamp("completed_at"),
    /** "approved" | "rejected" | "completed" libre — strings para evolución. */
    completionKind: text("completion_kind"),
    note: text("note"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Una asignación activa por (entry, role). Liberar al completar.
    uniqueIndex("entry_assignments_entry_role_active_idx")
      .on(t.entryId, t.role)
      .where(sql`${t.completedAt} IS NULL`),
    index("entry_assignments_assignee_idx").on(t.assigneeId, t.completedAt),
    index("entry_assignments_ws_entry_idx").on(t.workspaceId, t.entryId),
    index("entry_assignments_ws_due_idx").on(t.workspaceId, t.dueAt),
  ],
);

/**
 * Audit trail del workflow editorial. Una fila por evento del entry.
 * Render como timeline en /admin/contenido/[id] y en /admin/workflows.
 */
export const entryWorkflowEvents = pgTable(
  "entry_workflow_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    type: editorialEventTypeEnum("type").notNull(),
    fromStatus: entryStatusEnum("from_status"),
    toStatus: entryStatusEnum("to_status"),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Targeted user (ej: assignee añadido/quitado). */
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Payload libre — contexto adicional (note del transition, mention list, etc.) */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("entry_workflow_events_entry_idx").on(t.entryId, t.createdAt),
    index("entry_workflow_events_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);

/**
 * Hilos de comentarios editoriales (revisión interna). Anclados a un entry,
 * opcionalmente a un blockId del Tiptap (comentario de bloque). NO confundir con
 * `comments` (públicos del sitio) ni con `branch_comments` (revisión de branch).
 */
export const editorialThreads = pgTable(
  "editorial_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    /** Si NULL, el hilo es general del entry. Si set, ancla al bloque Tiptap. */
    blockId: text("block_id"),
    status: editorialThreadStatusEnum("status").notNull().default("open"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("editorial_threads_entry_idx").on(t.entryId, t.createdAt),
    index("editorial_threads_entry_block_idx").on(t.entryId, t.blockId),
    index("editorial_threads_ws_status_idx").on(t.workspaceId, t.status, t.createdAt),
  ],
);

export const editorialMessages = pgTable(
  "editorial_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => editorialThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    /** userIds @-mentioned (validados contra members del workspace antes de persistir). */
    mentions: text("mentions").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("editorial_messages_thread_idx").on(t.threadId, t.createdAt)],
);

/**
 * Tokens secretos para feed iCal personal (`/api/admin/calendar.ics?token=...`).
 * Uno por usuario y workspace. Rotable. NO admite preview público sin auth.
 */
export const editorialCalendarTokens = pgTable(
  "editorial_calendar_tokens",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    /** Filtros embebidos en el feed (ej: solo asignados a mí). NULL = todo el ws. */
    filters: jsonb("filters").$type<{
      onlyMine?: boolean;
      collectionIds?: string[];
      includeDue?: boolean;
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    uniqueIndex("editorial_calendar_tokens_token_idx").on(t.token),
  ],
);

// ============================================================
// TAXONOMIES
// ============================================================
export const taxonomies = pgTable("taxonomies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: taxonomyTypeEnum("type").notNull().default("tag"),
});

export const terms = pgTable("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxonomyId: uuid("taxonomy_id")
    .notNull()
    .references(() => taxonomies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: uuid("parent_id"),
});

export const entryTerms = pgTable(
  "entry_terms",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.termId] })],
);

// ============================================================
// MEDIA
// ============================================================
export const mediaFolders = pgTable("media_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id"),
    key: text("key").notNull(),
    url: text("url").notNull(),
    filename: text("filename"),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    duration: integer("duration"),
    alt: text("alt"),
    caption: text("caption"),
    blurhash: text("blurhash"),
    focalX: integer("focal_x").default(50),
    focalY: integer("focal_y").default(50),
    dominantColor: text("dominant_color"),
    hasTransparency: boolean("has_transparency").default(false),
    exifStripped: boolean("exif_stripped").default(true),
    variants: jsonb("variants"),
    aiTags: text("ai_tags").array(),
    tagsManual: text("tags_manual").array(),
    embedding: vector("embedding", { dimensions: 1536 }),
    uploadedById: text("uploaded_by_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("media_ws_folder_idx").on(t.workspaceId, t.folderId),
    index("media_ws_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

// ============================================================
// COMMENTS
// ============================================================
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    // FK self-ref con set null: si se elimina el padre, el reply queda como root (lo promovemos en el render).
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "set null",
    }),
    /** Si está anclado a un bloque concreto del editor (Tiptap nodeId). */
    blockId: text("block_id"),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email").notNull(),
    /** Si el comentario lo dejó un usuario logueado, se enlaza. */
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    status: commentStatusEnum("status").notNull().default("pending"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    /** 0 = limpio, 100 = spam evidente. */
    aiScore: integer("ai_score"),
    aiReason: text("ai_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("comments_ws_status_idx").on(t.workspaceId, t.status, t.createdAt),
    index("comments_entry_idx").on(t.entryId, t.createdAt),
  ],
);

// ============================================================
// SEARCH INDEX JOBS (recompute embeddings en background)
// ============================================================
export const searchJobStatusEnum = pgEnum("search_job_status", [
  "queued",
  "processing",
  "done",
  "error",
]);

export const searchIndexJobs = pgTable(
  "search_index_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    status: searchJobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("search_jobs_entry_idx").on(t.entryId),
    index("search_jobs_status_idx").on(t.status, t.createdAt),
  ],
);

// ============================================================
// GROWTH (newsletter, memberships)
// ============================================================
export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    locale: text("locale").default("es"),
    status: subscriberStatusEnum("status").notNull().default("active"),
    tags: text("tags").array(),
    source: text("source"),
    preferences: jsonb("preferences"),
    confirmedAt: timestamp("confirmed_at"),
    unsubscribedAt: timestamp("unsubscribed_at"),
    unsubscribeReason: text("unsubscribe_reason"),
    unsubscribeToken: text("unsubscribe_token"),
    lastOpenAt: timestamp("last_open_at"),
    lastClickAt: timestamp("last_click_at"),
    bounceCount: integer("bounce_count").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscribers_ws_email_idx").on(t.workspaceId, t.email),
    uniqueIndex("subscribers_unsub_token_idx").on(t.unsubscribeToken),
    index("subscribers_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

export const subscriberConfirmations = pgTable(
  "subscriber_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriber_confirmations_token_idx").on(t.token),
    index("subscriber_confirmations_sub_idx").on(t.subscriberId),
  ],
);

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rules: jsonb("rules"),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    previewText: text("preview_text"),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    replyTo: text("reply_to"),
    body: jsonb("body"),
    bodyHtml: text("body_html"),
    templateId: uuid("template_id"),
    segmentId: uuid("segment_id"),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    sentAt: timestamp("sent_at"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    totalRecipients: integer("total_recipients").default(0),
    sent: integer("sent").default(0),
    opens: integer("opens").default(0),
    uniqueOpens: integer("unique_opens").default(0),
    clicks: integer("clicks").default(0),
    uniqueClicks: integer("unique_clicks").default(0),
    bounced: integer("bounced").default(0),
    complained: integer("complained").default(0),
    unsubscribed: integer("unsubscribed").default(0),
    failed: integer("failed").default(0),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("campaigns_ws_status_idx").on(t.workspaceId, t.status)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: campaignRecipientStatusEnum("status").notNull().default("pending"),
    trackingHash: text("tracking_hash").notNull(),
    queuedAt: timestamp("queued_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    openCount: integer("open_count").default(0),
    clickedAt: timestamp("clicked_at"),
    clickCount: integer("click_count").default(0),
    bouncedAt: timestamp("bounced_at"),
    failedAt: timestamp("failed_at"),
    failureReason: text("failure_reason"),
    providerMessageId: text("provider_message_id"),
  },
  (t) => [
    uniqueIndex("campaign_recipients_unique_idx").on(t.campaignId, t.subscriberId),
    uniqueIndex("campaign_recipients_tracking_idx").on(t.trackingHash),
    index("campaign_recipients_status_idx").on(t.workspaceId, t.status),
  ],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    subject: text("subject"),
    previewText: text("preview_text"),
    body: jsonb("body"),
    bodyHtml: text("body_html"),
    variables: jsonb("variables"),
    builtinKey: text("builtin_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_templates_ws_slug_idx").on(t.workspaceId, t.slug)],
);

export const drips = pgTable(
  "drips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    triggerType: dripTriggerTypeEnum("trigger_type").notNull().default("subscribe_confirmed"),
    triggerConfig: jsonb("trigger_config"),
    steps: jsonb("steps"),
    status: dripStatusEnum("status").notNull().default("draft"),
    enrolledTotal: integer("enrolled_total").default(0),
    completedTotal: integer("completed_total").default(0),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("drips_ws_status_idx").on(t.workspaceId, t.status)],
);

export const dripEnrollments = pgTable(
  "drip_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dripId: uuid("drip_id")
      .notNull()
      .references(() => drips.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    currentStep: integer("current_step").notNull().default(0),
    nextRunAt: timestamp("next_run_at"),
    status: dripEnrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    uniqueIndex("drip_enrollments_unique_idx").on(t.dripId, t.subscriberId),
    index("drip_enrollments_next_run_idx").on(t.status, t.nextRunAt),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: emailEventTypeEnum("type").notNull(),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    recipientId: uuid("recipient_id").references(() => campaignRecipients.id, {
      onDelete: "set null",
    }),
    dripId: uuid("drip_id").references(() => drips.id, { onDelete: "set null" }),
    dripEnrollmentId: uuid("drip_enrollment_id").references(() => dripEnrollments.id, {
      onDelete: "set null",
    }),
    url: text("url"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("email_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("email_events_campaign_idx").on(t.campaignId, t.type),
    index("email_events_subscriber_idx").on(t.subscriberId, t.createdAt),
  ],
);

export const tiers = pgTable(
  "tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("eur"),
    interval: tierIntervalEnum("interval").notNull().default("month"),
    /** Días de prueba antes del primer cargo (0 = sin trial). */
    trialDays: integer("trial_days").notNull().default(0),
    /** Lista de strings (features visibles en checkout/portal). */
    features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Si es false, no se muestra en /miembros (oculto pero las membresías activas siguen). */
    isActive: boolean("is_active").notNull().default(true),
    /** Tier "free" (precio 0): se concede sin Stripe. */
    isFree: boolean("is_free").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** IDs en Stripe — se rellenan con "Sincronizar con Stripe". */
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tiers_ws_slug_idx").on(t.workspaceId, t.slug),
    index("tiers_ws_active_idx").on(t.workspaceId, t.isActive, t.sortOrder),
    index("tiers_stripe_price_idx").on(t.stripePriceId),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    tierId: uuid("tier_id").references(() => tiers.id, { onDelete: "set null" }),
    status: membershipStatusEnum("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    trialEnd: timestamp("trial_end"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    /** Origen del registro: "checkout" | "manual" | "import" | "demo" | "free". */
    source: text("source"),
    metadata: jsonb("metadata").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
 * El token de cookie es un secreto random; aquí guardamos su sha256 para verify.
 */
export const memberSessions = pgTable(
  "member_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    expiresAt: timestamp("expires_at").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_sessions_token_idx").on(t.tokenHash),
    index("member_sessions_ws_email_idx").on(t.workspaceId, t.email),
    index("member_sessions_expires_idx").on(t.expiresAt),
  ],
);

/** Magic links one-shot para login de miembro vía email. */
export const memberMagicLinks = pgTable(
  "member_magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_magic_links_token_idx").on(t.tokenHash),
    index("member_magic_links_ws_email_idx").on(t.workspaceId, t.email),
  ],
);

/** Audit log de eventos de membresía (Stripe webhooks + acciones manuales). */
export const memberEvents = pgTable(
  "member_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    type: memberEventTypeEnum("type").notNull(),
    /** event.id de Stripe para idempotencia (NULL para eventos manuales). */
    stripeEventId: text("stripe_event_id"),
    data: jsonb("data").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_events_stripe_evt_idx").on(t.stripeEventId),
    index("member_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("member_events_membership_idx").on(t.membershipId, t.createdAt),
  ],
);

/**
 * Reglas de personalización con nombre (reusables).
 * En F8b la audiencia se persiste embebida en cada bloque (`block.audience`),
 * esta tabla queda preparada para reglas-named en F8c.
 */
export const personalizationRules = pgTable(
  "personalization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    rule: jsonb("rule").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("personalization_rules_ws_name_idx").on(t.workspaceId, t.name)],
);

// ============================================================
// FORMS
// ============================================================
export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Snapshot del schema activo (paleta de campos serializada). Para histórico, ver formVersions. */
    schema: jsonb("schema").$type<unknown>(),
    status: formStatusEnum("status").notNull().default("draft"),
    /** Versión incremental — sube en cada save publicado. */
    version: integer("version").notNull().default(1),
    /** Mensaje de éxito por defecto (puede sobrescribirse en settings). */
    successMessage: text("success_message"),
    /** Si se define, redirige al usuario tras submit en vez de mostrar mensaje. */
    redirectUrl: text("redirect_url"),
    /** Webhook URL legacy. Para webhooks dinámicos usar webhooks/automations. */
    webhookUrl: text("webhook_url"),
    /** Lista de emails que reciben notificación cuando entra una submission. */
    notificationEmails: text("notification_emails").array().notNull().default(sql`ARRAY[]::text[]`),
    /** Settings: doubleOptIn, captcha, antiSpam, storeIp, allowedOrigins, etc. */
    settings: jsonb("settings").$type<unknown>(),
    submissionsCount: integer("submissions_count").notNull().default(0),
    spamCount: integer("spam_count").notNull().default(0),
    lastSubmissionAt: timestamp("last_submission_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forms_ws_slug_idx").on(t.workspaceId, t.slug),
    index("forms_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/** Histórico inmutable de schemas publicados. Cada submission referencia su versión. */
export const formVersions = pgTable(
  "form_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    schema: jsonb("schema").$type<unknown>().notNull(),
    publishedById: text("published_by_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("form_versions_form_version_idx").on(t.formId, t.version)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    /** Versión del schema con la que se envió. */
    formVersion: integer("form_version").notNull().default(1),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    /** Lista de mediaIds adjuntos (file fields). */
    attachments: uuid("attachments").array().notNull().default(sql`ARRAY[]::uuid[]`),
    status: submissionStatusEnum("status").notNull().default("received"),
    /** 0..100 — score anti-spam (mayor = más sospechoso). */
    spamScore: integer("spam_score").notNull().default(0),
    spamReasons: text("spam_reasons").array(),
    /** sha-256(formId + data canonical) — dedupe + idempotency. */
    contentHash: text("content_hash").notNull(),
    ipHash: text("ip_hash"),
    ua: text("ua"),
    referer: text("referer"),
    country: text("country"),
    /** UTM source/medium/campaign serializados. */
    source: jsonb("source").$type<{ utm?: Record<string, string>; ref?: string }>(),
    /** Si requiere doble opt-in: pendiente de confirmar. */
    confirmedAt: timestamp("confirmed_at"),
    confirmationToken: text("confirmation_token"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Identificador legible: csm_live_XXXX o csm_test_XXXX (8 chars de la parte secreta). */
    prefix: text("prefix").notNull(),
    /** sha-256(secret + KEY_PEPPER). */
    hash: text("hash").notNull(),
    /** "live" o "test"; las test keys no disparan webhooks ni mutan datos públicos. */
    environment: text("environment").notNull().default("live"),
    /** Scopes glob: "entries:read", "entries:*", "*:read", "*". */
    scopes: text("scopes").array().notNull().default(sql`ARRAY['*:read']::text[]`),
    /** Requests por hora (token bucket size). */
    rateLimit: integer("rate_limit").notNull().default(1000),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    /** Si esta key reemplaza a otra (rotación), guardamos el origen. */
    rotatedFromId: uuid("rotated_from_id"),
    lastUsedAt: timestamp("last_used_at"),
    /** Contador denormalizado para el dashboard (incrementa via SQL atómico). */
    requestsToday: integer("requests_today").notNull().default(0),
    requestsTotal: integer("requests_total").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("api_keys_prefix_idx").on(t.prefix),
    index("api_keys_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const apiKeyAudit = pgTable(
  "api_key_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    durationMs: integer("duration_ms").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    /** Reason si bloqueado: "scope-denied", "rate-limited", "expired", "revoked". */
    denyReason: text("deny_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("api_key_audit_key_idx").on(t.apiKeyId, t.createdAt)],
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Webhook"),
    description: text("description"),
    /** Lista de eventos: ["entry.published", "comment.created"] o ["*"]. */
    events: text("events").array().notNull().default(sql`ARRAY['*']::text[]`),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    active: boolean("active").notNull().default(true),
    /** Número máximo de reintentos (1 + N retries). */
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("webhooks_ws_active_idx").on(t.workspaceId, t.active)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    /** Identificador único por evento — usable como header X-CSM-Event-Id. */
    eventId: uuid("event_id").notNull().defaultRandom(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    statusCode: integer("status_code"),
    responseSnippet: text("response_snippet"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    /** Próxima ventana en la que el cron debe intentar entregarla. */
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_pending_idx").on(t.status, t.nextAttemptAt),
    index("webhook_deliveries_webhook_idx").on(t.webhookId, t.createdAt),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Tipo discriminado de trigger. Defaults a "event" para compatibilidad con datos previos. */
    triggerType: automationTriggerTypeEnum("trigger_type").notNull().default("event"),
    /** Config del trigger según triggerType. */
    trigger: jsonb("trigger").notNull().$type<unknown>(),
    conditions: jsonb("conditions").$type<unknown>(),
    /** Lista ordenada de steps (acciones + control flow). */
    actions: jsonb("actions").notNull().$type<unknown>(),
    active: boolean("active").notNull().default(true),
    /** Debounce en ms para evitar bursts (0 = sin debounce). */
    debounceMs: integer("debounce_ms").notNull().default(0),
    /** Para trigger "webhook_in": secret HMAC. */
    webhookSecret: text("webhook_secret"),
    lastRunAt: timestamp("last_run_at"),
    runsTotal: integer("runs_total").notNull().default(0),
    runsFailed: integer("runs_failed").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("automations_ws_active_idx").on(t.workspaceId, t.active),
    uniqueIndex("automations_ws_slug_idx").on(t.workspaceId, t.slug),
    index("automations_trigger_idx").on(t.workspaceId, t.triggerType, t.active),
  ],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    triggerEvent: text("trigger_event").notNull(),
    triggerPayload: jsonb("trigger_payload"),
    status: automationRunStatusEnum("status").notNull().default("pending"),
    /** Snapshot del contexto compartido entre steps al final del run. */
    output: jsonb("output"),
    error: text("error"),
    /** Timestamp para ejecución diferida (delays). null = ejecutar inmediatamente. */
    nextStepAt: timestamp("next_step_at"),
    /** Index del próximo step a ejecutar (para resume tras delay). */
    nextStepIndex: integer("next_step_index").notNull().default(0),
    /** Contexto compartido: outputs de steps anteriores referenciables como {{steps.0.output}}. */
    context: jsonb("context"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("automation_runs_automation_idx").on(t.automationId, t.createdAt),
    index("automation_runs_pending_idx").on(t.status, t.nextStepAt),
  ],
);

/** Log granular por step ejecutado dentro de un run. */
export const automationSteps = pgTable(
  "automation_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => automationRuns.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    /** Tipo del step (webhook | email | slack | ai | http | db.create | sleep | branch | ...). */
    type: text("type").notNull(),
    name: text("name"),
    status: automationStepStatusEnum("status").notNull().default("pending"),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("automation_steps_run_idx").on(t.runId, t.stepIndex)],
);

/** Idempotency keys para POST/PATCH del REST API: si el cliente repite la misma key, devolvemos la respuesta cacheada. */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    /** sha-256 del body para detectar reuso de key con cuerpo distinto (devolver 409). */
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code").notNull(),
    response: jsonb("response").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_unique_idx").on(t.apiKeyId, t.key),
    index("idempotency_keys_expires_idx").on(t.expiresAt),
  ],
);

// ============================================================
// PAGES & SYMBOLS (visual builder)
// ============================================================
export const pageStatusEnum = pgEnum("page_status", ["draft", "published", "archived"]);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    title: text("title").notNull(),
    layout: jsonb("layout").$type<unknown>(),
    themeId: uuid("theme_id"),
    abTestId: uuid("ab_test_id"),
    locale: text("locale").notNull().default("es"),
    status: pageStatusEnum("status").notNull().default("draft"),
    seo: jsonb("seo").$type<{ title?: string; description?: string; ogImage?: string }>(),
    isHome: boolean("is_home").notNull().default(false),
    publishedAt: timestamp("published_at"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pages_ws_path_locale_idx").on(t.workspaceId, t.path, t.locale),
    index("pages_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

export const symbols = pgTable(
  "symbols",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    layout: jsonb("layout").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("symbols_ws_slug_idx").on(t.workspaceId, t.slug)],
);

// ============================================================
// SITE
// ============================================================
export const themes = pgTable(
  "themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    basedOn: text("based_on"),
    tokens: jsonb("tokens"),
    fonts: jsonb("fonts"),
    layouts: jsonb("layouts"),
    blockOverrides: jsonb("block_overrides"),
    ogTemplate: jsonb("og_template"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("themes_ws_slug_idx").on(t.workspaceId, t.slug)],
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    location: menuLocationEnum("location").notNull().default("header"),
    /** Lista jerárquica de items: link/page/collection/external/divider/heading con children[]. */
    items: jsonb("items").$type<unknown>().notNull().default(sql`'[]'::jsonb`),
    /** Versión incremental — sube en cada save. */
    version: integer("version").notNull().default(1),
    /** Default por location (un solo "true" por workspace+location). */
    isDefault: boolean("is_default").notNull().default(false),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("menus_ws_slug_idx").on(t.workspaceId, t.slug),
    index("menus_ws_location_idx").on(t.workspaceId, t.location),
  ],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Patrón de match: path absoluto exact, prefix con o sin trailing /, o regex JS. */
    source: text("source").notNull(),
    /** Destino absoluto (https://) o relativo (/path). */
    destination: text("destination").notNull(),
    /** 301 (perm) | 302 (temp) | 307 (perm preserva method) | 308 (perm preserva method+body). */
    statusCode: integer("status_code").notNull().default(301),
    matchType: redirectMatchTypeEnum("match_type").notNull().default("exact"),
    /** Si es prefix/regex, conserva la query string original al redirigir. */
    preserveQuery: boolean("preserve_query").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    description: text("description"),
    /** Counter de hits — incrementado async desde middleware. */
    hits: integer("hits").notNull().default(0),
    lastHitAt: timestamp("last_hit_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("redirects_ws_source_idx").on(t.workspaceId, t.source),
    index("redirects_ws_enabled_idx").on(t.workspaceId, t.enabled),
  ],
);

export const settings = pgTable(
  "settings",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

// ============================================================
// OBSERVABILITY
// ============================================================
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id"),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  workspaceId: uuid("workspace_id"),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    path: text("path"),
    anonId: text("anon_id"),
    country: text("country"),
    device: text("device"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("analytics_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

// ============================================================
// A/B TESTING (F8c)
// ============================================================
/**
 * Tests A/B con allocation determinista. Variants viven en `variants` jsonb:
 *   [{ id: "v1", label: "Control", weight: 50, isControl: true }, ...]
 * Pesos enteros que suman 100. La asignación es sticky por `anonId` (cookie
 * csm_aid) y se persiste en ab_assignments para evitar drift si los pesos
 * cambian.
 *
 * - target=block: el test alimenta a uno o más bloques `ab` por su `key`.
 * - target=page: el test cubre la página entera; cada variant puede apuntar a
 *   `pageId` (otra página alternativa) o renderizar la host con override.
 *
 * goal define cómo se cuenta una conversion:
 *   { kind: "click", selector: "#cta" }    // tracking client-side
 *   { kind: "submit", formId: "uuid" }     // hook desde formularios
 *   { kind: "purchase" }                    // hook desde Stripe webhook
 *   { kind: "custom", eventName: "demo" }  // window.csm.ab.track(testKey, "demo")
 */
export const abTests = pgTable(
  "ab_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Slug estable usado en el bloque `ab` y en window.csm.ab.* */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: abTestStatusEnum("status").notNull().default("draft"),
    target: abTestTargetEnum("target").notNull().default("block"),
    /** Si target=page, página host del test. */
    pageId: uuid("page_id"),
    /** Variants JSON: array `{id,label,weight,isControl,pageId?}`. */
    variants: jsonb("variants").$type<unknown>().notNull().default(sql`'[]'::jsonb`),
    /** Goal JSON — describe cómo se cuenta una conversion. */
    goal: jsonb("goal").$type<unknown>(),
    minSampleSize: integer("min_sample_size").notNull().default(100),
    /** Variant id ganadora si el test ya cerró. */
    winnerVariantId: text("winner_variant_id"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ab_tests_ws_key_idx").on(t.workspaceId, t.key),
    index("ab_tests_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * Sticky assignment por (testId, anonId). PK compuesto evita duplicados.
 * Insert con onConflictDoNothing en cada SSR garantiza idempotencia bajo race.
 */
export const abAssignments = pgTable(
  "ab_assignments",
  {
    testId: uuid("test_id")
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    anonId: text("anon_id").notNull(),
    variantId: text("variant_id").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.testId, t.anonId] }),
    index("ab_assignments_ws_idx").on(t.workspaceId, t.testId),
  ],
);

/**
 * Eventos crudos. Agregaciones se calculan on-demand en el dashboard.
 * Para v1 está bien (workloads <100k events). Si crece se materializa a
 * `ab_test_stats` con cron.
 */
export const abEvents = pgTable(
  "ab_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    variantId: text("variant_id").notNull(),
    anonId: text("anon_id").notNull(),
    kind: abEventKindEnum("kind").notNull(),
    /** Valor numérico opcional (revenue, cantidad…). */
    value: integer("value"),
    /** Metadata opcional (eventName, formId, sessionId…). */
    meta: jsonb("meta").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ab_events_test_kind_idx").on(t.testId, t.kind),
    index("ab_events_test_variant_kind_idx").on(t.testId, t.variantId, t.kind),
    index("ab_events_ws_created_idx").on(t.workspaceId, t.createdAt),
    // Para dedup de impressions por (test, anon, kind=impression) cuando
    // queramos contar visitantes únicos. No es UNIQUE: aceptamos múltiples
    // impressions del mismo anon (refresh) — el dashboard agrupa por anonId.
    index("ab_events_test_anon_kind_idx").on(t.testId, t.anonId, t.kind),
  ],
);

// ============================================================
// IMPORTS (F9a) — wizard universal: WP/Notion/MD/Ghost/RSS/CSV
// ============================================================
/**
 * Una import es un "lote" iniciado al subir un archivo. El usuario lo configura
 * (mapping, mediaPolicy), corre dry-run y luego apply. La fila guarda el estado
 * de máquina (uploaded → ready → running → completed|failed) y un blob de
 * estadísticas para el dashboard.
 *
 * mapping ejemplo (WP → entries):
 *   { collectionId, defaultLocale: "es", fields: { title:"title", body:"content_html",
 *     publishedAt:"pubDate", excerpt:"description", slug:"post_name" } }
 *
 * stats:
 *   { detected, planned, imported, skipped, errored, mediaPlanned, mediaImported }
 */
export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: importSourceEnum("source").notNull(),
    status: importStatusEnum("status").notNull().default("uploaded"),
    /** Storage key del archivo subido (multipart) o null si fue parsing inline. */
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    mediaPolicy: importMediaPolicyEnum("media_policy").notNull().default("link"),
    /** Mapping source field → CSM target. Ver doc arriba. */
    mapping: jsonb("mapping").$type<unknown>(),
    /** Stats agregadas; el engine las actualiza durante el run. */
    stats: jsonb("stats").$type<unknown>(),
    /** Hasta 100 errores recientes para diagnóstico (no truncate, append-once). */
    errorLog: jsonb("error_log").$type<unknown>(),
    dryRun: boolean("dry_run").notNull().default(false),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    revertedAt: timestamp("reverted_at"),
  },
  (t) => [
    index("imports_ws_status_idx").on(t.workspaceId, t.status),
    index("imports_ws_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

/**
 * Log per-item de una import. Cada entry/term/media/comment importado deja
 * traza con su sourceId (id del sistema de origen). Permite:
 *  - revert atómico (DELETE FROM target WHERE id IN (SELECT targetId FROM import_items WHERE importId=...))
 *  - re-run idempotente (skip si sourceId ya importado en el mismo lote)
 *  - debugging de errores per-item.
 *
 * UNIQUE (importId, kind, sourceId) — un mismo sourceId no se procesa 2× dentro
 * del mismo lote (idempotencia intra-lote).
 *
 * Nota: la idempotencia inter-lote (re-importar el mismo WP.xml luego de añadir
 * nuevos posts) se resuelve en `entries.originRef` (unique partial index ws+ref).
 */
export const importItems = pgTable(
  "import_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: importItemKindEnum("kind").notNull(),
    /** Id del sistema de origen (post_id WP, page_id Notion, slug MD, guid RSS…). */
    sourceId: text("source_id").notNull(),
    /** URL original (cuando aplica) — usada para crear redirects auto post-import. */
    sourceUrl: text("source_url"),
    status: importItemStatusEnum("status").notNull().default("pending"),
    /** Id en CSM tras importar (entries.id, terms.id, media.id, comments.id). */
    targetId: uuid("target_id"),
    /** Mensaje de error si status=failed. */
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    importedAt: timestamp("imported_at"),
  },
  (t) => [
    uniqueIndex("import_items_lot_kind_source_idx").on(t.importId, t.kind, t.sourceId),
    index("import_items_import_status_idx").on(t.importId, t.status),
    index("import_items_ws_kind_idx").on(t.workspaceId, t.kind),
  ],
);

// ============================================================
// TYPES
// ============================================================
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type SearchIndexJob = typeof searchIndexJobs.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Symbol = typeof symbols.$inferSelect;
export type NewSymbol = typeof symbols.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
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
export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type FormVersion = typeof formVersions.$inferSelect;
export type NewFormVersion = typeof formVersions.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
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
export type AbTest = typeof abTests.$inferSelect;
export type NewAbTest = typeof abTests.$inferInsert;
export type AbAssignment = typeof abAssignments.$inferSelect;
export type NewAbAssignment = typeof abAssignments.$inferInsert;
export type AbEvent = typeof abEvents.$inferSelect;
export type NewAbEvent = typeof abEvents.$inferInsert;
// ============================================================
// CONTENT HEALTH — snapshot por entry + issues detallados
// ============================================================
/**
 * Snapshot del último escaneo por entry (1:1 con `entries`). Permite query
 * rápida "dame las entries con peor score" sin tocar issues.
 */
export const entryHealth = pgTable(
  "entry_health",
  {
    entryId: uuid("entry_id")
      .primaryKey()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** 0-100. Calculado server-side desde `issues` en cada scan. */
    score: integer("score").notNull().default(100),
    /** Conteo agrupado por severidad para queries rápidas en el dashboard. */
    counts: jsonb("counts")
      .$type<{ low: number; medium: number; high: number; critical: number }>()
      .notNull()
      .default({ low: 0, medium: 0, high: 0, critical: 0 }),
    scannedAt: timestamp("scanned_at").notNull().defaultNow(),
    /** Hash determinista del input del scan para detectar "no cambió desde último escaneo". */
    inputHash: text("input_hash"),
  },
  (t) => [
    index("entry_health_ws_score_idx").on(t.workspaceId, t.score),
    index("entry_health_ws_scanned_idx").on(t.workspaceId, t.scannedAt),
  ],
);

/**
 * Issues individuales detectados. 1 entry → N issues. Se reemplazan en bloque
 * al re-escanear (transacción: DELETE WHERE entry_id + INSERT).
 */
export const entryHealthIssues = pgTable(
  "entry_health_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: healthIssueTypeEnum("type").notNull(),
    severity: healthSeverityEnum("severity").notNull(),
    /** Mensaje legible en español. Se muestra al user en el dashboard. */
    message: text("message").notNull(),
    /** Sugerencia accionable (opcional). */
    suggestion: text("suggestion"),
    /**
     * Localización opcional dentro del entry (block id, char range, url offending).
     * Estructura libre — cada detector decide su forma.
     */
    location: jsonb("location").$type<Record<string, unknown>>(),
    detectedAt: timestamp("detected_at").notNull().defaultNow(),
    /**
     * Si el user marca un issue como "ignorar" (false positive), `dismissedAt` se
     * setea y el dashboard lo oculta por defecto pero NO se borra para audit.
     */
    dismissedAt: timestamp("dismissed_at"),
    dismissedById: text("dismissed_by_id").references(() => users.id, { onDelete: "set null" }),
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
 * Granularidad: una fila por (workspaceId, userId, day, feature). Se hace
 * UPSERT en cada call: incrementa `callsCount` y `costMicrosUsd`.
 *
 * Por qué micro-USD (1 USD = 1_000_000 micros):
 *   Coste por call típico: ~5_000 micros (0.005 USD). Integer evita drift de
 *   floats acumulados sobre cientos de miles de calls/mes. F10e podrá agregar
 *   en `ai_usage_monthly` cuando esto crezca; por ahora un row por día por
 *   user por feature es manejable (≤ 30 * N_users * 5 features = ~1500 rows
 *   por workspace por mes).
 *
 * Features: "inline" (editor), "ask" (chat), "agent" (in-product), "moderation"
 * (auto comments), "embeddings" (search index), "vision" (alt-text).
 */
export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** NULL = call de sistema (cron, automation). Para per-user rate-limit. */
    userId: text("user_id"),
    /** 'YYYY-MM-DD' UTC. Permite sumar mes/semana sin date_trunc en queries calientes. */
    day: text("day").notNull(),
    feature: text("feature").notNull(),
    callsCount: integer("calls_count").notNull().default(0),
    /** Microudólares (1 USD = 1_000_000). Integer atómico SQL — no float drift. */
    costMicrosUsd: integer("cost_micros_usd").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // UNIQUE para que el UPSERT por (ws, user, day, feature) sea atómico.
    // userId NULL hace coalesce a empty string para que dedupe correctamente.
    uniqueIndex("ai_usage_daily_unique_idx").on(
      t.workspaceId,
      sql`COALESCE(${t.userId}, '')`,
      t.day,
      t.feature,
    ),
    index("ai_usage_daily_ws_day_idx").on(t.workspaceId, t.day),
  ],
);

export type AiUsageDaily = typeof aiUsageDaily.$inferSelect;

/**
 * Reportes CSP agregados — un row por (directiva + recurso bloqueado + origen).
 *
 * El endpoint `/api/security/csp-report` recibe un evento por cada violación que
 * el navegador detecta. En sitios con tráfico real esto produce miles de eventos
 * idénticos (mismo bloqueo desde el mismo source). Persistimos agregado:
 * - `dedupKey` SHA-256 sobre los campos identificativos → UNIQUE.
 * - INSERT ... ON CONFLICT DO UPDATE incrementa `occurrences` + actualiza `lastSeenAt`.
 *
 * Uso del dashboard `/admin/ajustes/seguridad/headers`:
 * - Tabla agrupada por `violatedDirective` con conteo total.
 * - Top 10 recursos bloqueados por directiva.
 * - Botón "marcar como tratado" → `resolvedAt` (no oculta, sólo prioriza tablas).
 *
 * Cuando esta tabla esté vacía (o sólo contenga reports resueltos) durante una
 * semana en prod, el admin puede activar `CSP_ENFORCE=1` con confianza.
 */
export const cspReports = pgTable(
  "csp_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Hash determinista sobre directive+blockedUri+sourceFile+lineNumber. UNIQUE. */
    dedupKey: text("dedup_key").notNull(),
    blockedUri: text("blocked_uri"),
    violatedDirective: text("violated_directive").notNull(),
    effectiveDirective: text("effective_directive"),
    documentUri: text("document_uri"),
    sourceFile: text("source_file"),
    lineNumber: integer("line_number"),
    columnNumber: integer("column_number"),
    /** Snippet ofensivo (para inline scripts/styles). Cap a 500 chars. */
    sample: text("sample"),
    userAgentHash: text("user_agent_hash"),
    /** Disposition del browser: "enforce" o "report" (Reporting API moderna). */
    disposition: text("disposition"),
    occurrences: integer("occurrences").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("csp_reports_dedup_idx").on(t.dedupKey),
    index("csp_reports_directive_last_seen_idx").on(t.violatedDirective, t.lastSeenAt),
    index("csp_reports_unresolved_idx").on(t.lastSeenAt).where(sql`${t.resolvedAt} IS NULL`),
  ],
);

export type CspReport = typeof cspReports.$inferSelect;
export type NewCspReport = typeof cspReports.$inferInsert;

// ============================================================
// COLLAB realtime (F10b — Y.js + LISTEN/NOTIFY)
// ============================================================
/**
 * Snapshot consolidado del Y.Doc por entry. Una fila por entry.
 * `state` es el binary state encoded como base64 (Y.encodeStateAsUpdate).
 * Se actualiza en background tras un debounce — los updates incrementales
 * viven en `collab_updates` hasta que el snapshotter los compacta y los GC.
 */
export const collabSnapshots = pgTable("collab_snapshots", {
  entryId: uuid("entry_id")
    .primaryKey()
    .references(() => entries.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  /** base64 de Uint8Array — Y.encodeStateAsUpdate(doc) */
  state: text("state").notNull(),
  /** Tamaño en bytes del binary state (para diagnóstico/quota). */
  bytes: integer("bytes").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Log de updates incrementales del Y.Doc. Cada POST de un cliente persiste un row.
 * El snapshotter merge'a en `collab_snapshots.state` cada N segundos y borra los
 * rows ya consolidados (GC por `createdAt < snapshot.updatedAt`).
 *
 * `clientId` es el `Y.Doc#clientID` del emisor — los receptores skipean su propio
 * clientId para no aplicar updates que ellos mismos generaron.
 */
export const collabUpdates = pgTable(
  "collab_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** base64 de Uint8Array (Y.js update binary). */
    update: text("update").notNull(),
    clientId: text("client_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("collab_updates_entry_created_idx").on(t.entryId, t.createdAt)],
);

export type CollabSnapshot = typeof collabSnapshots.$inferSelect;
export type NewCollabSnapshot = typeof collabSnapshots.$inferInsert;
export type CollabUpdate = typeof collabUpdates.$inferSelect;
export type NewCollabUpdate = typeof collabUpdates.$inferInsert;

/**
 * Sesiones de presencia activa en el admin (F10b — global presence).
 *
 * Una fila por (workspaceId, clientId). El `clientId` es ephemeral por pestaña:
 * el cliente lo genera con `crypto.randomUUID()` y lo guarda en sessionStorage,
 * de forma que cada tab del mismo user reporta presencia independiente
 * (relevante para "Edgar editando 3 entries simultáneo").
 *
 * `lastSeenAt` se actualiza con UPSERT cada 15s desde el cliente. Un cron
 * borra filas con `lastSeenAt < now() - 5min`. Para queries de dashboard
 * filtramos por `lastSeenAt > now() - 60s` (ventana de "online").
 *
 * `route` y `entryId` permiten queries dirigidas: "quién está en /admin/contenido"
 * o "quién está editando entry X".
 */
export const presenceSessions = pgTable(
  "presence_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Generado por el cliente (sessionStorage), único por pestaña. */
    clientId: text("client_id").notNull(),
    route: text("route").notNull(),
    /** Extraído de `route` server-side cuando matchea `/admin/contenido/{uuid}`. */
    entryId: uuid("entry_id"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("presence_ws_client_idx").on(t.workspaceId, t.clientId),
    index("presence_ws_lastseen_idx").on(t.workspaceId, t.lastSeenAt),
    index("presence_ws_entry_idx")
      .on(t.workspaceId, t.entryId)
      .where(sql`${t.entryId} IS NOT NULL`),
  ],
);

export type PresenceSession = typeof presenceSessions.$inferSelect;
export type NewPresenceSession = typeof presenceSessions.$inferInsert;

/**
 * Reactions emoji sobre mensajes editorial F9c (F10b — realtime reactions live).
 * Una fila por (messageId, userId, emoji) — un usuario puede reaccionar con
 * varios emojis distintos al mismo mensaje pero no duplicar el mismo emoji.
 *
 * Persistir es importante para que las reactions sobrevivan reloads y para
 * conteos agregados. El "live" viene del NOTIFY pubsub canal
 * `reactions:thread:{threadId}` que dispara fanout cross-instancia.
 */
export const editorialReactions = pgTable(
  "editorial_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => editorialMessages.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => editorialThreads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Caracter unicode (👍 ❤️ 🎉 …). Cap a 8 chars (algunos emojis ZWJ son largos). */
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("editorial_reactions_unique_idx").on(t.messageId, t.userId, t.emoji),
    index("editorial_reactions_thread_idx").on(t.threadId, t.createdAt),
  ],
);

export type EditorialReaction = typeof editorialReactions.$inferSelect;
export type NewEditorialReaction = typeof editorialReactions.$inferInsert;

export type ImportRow = typeof imports.$inferSelect;
export type NewImportRow = typeof imports.$inferInsert;
export type ImportItem = typeof importItems.$inferSelect;
export type NewImportItem = typeof importItems.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type BranchActivity = typeof branchActivity.$inferSelect;
export type NewBranchActivity = typeof branchActivity.$inferInsert;
export type BranchComment = typeof branchComments.$inferSelect;
export type NewBranchComment = typeof branchComments.$inferInsert;
export type EntryBranchState = (typeof entryBranchStateEnum.enumValues)[number];
export type BranchActivityType = (typeof branchActivityTypeEnum.enumValues)[number];
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
// F9c — Editorial
export type EntryStatus = (typeof entryStatusEnum.enumValues)[number];
export type EntryPriority = (typeof entryPriorityEnum.enumValues)[number];
export type EditorialAssignmentRole = (typeof editorialAssignmentRoleEnum.enumValues)[number];
export type EditorialThreadStatus = (typeof editorialThreadStatusEnum.enumValues)[number];
export type EditorialEventType = (typeof editorialEventTypeEnum.enumValues)[number];
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
export type HealthSeverity = (typeof healthSeverityEnum.enumValues)[number];
export type HealthIssueType = (typeof healthIssueTypeEnum.enumValues)[number];
export type EntryHealth = typeof entryHealth.$inferSelect;
export type NewEntryHealth = typeof entryHealth.$inferInsert;
export type EntryHealthIssue = typeof entryHealthIssues.$inferSelect;
export type NewEntryHealthIssue = typeof entryHealthIssues.$inferInsert;

// ============================================================
// AI Provider configs — keys encriptadas + modelo por workspace
// ============================================================
// Las API keys se guardan ENCRIPTADAS via `encryptKey()` (AES-256-GCM
// derivado de AUTH_SECRET). Una fila por (workspace, provider). El
// resolver `chatStream()` busca aquí PRIMERO antes de caer a env vars.
export const aiProviderConfigs = pgTable(
  "ai_provider_configs",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    // base64(iv|ciphertext|tag) o "" si no se ha guardado key (ej. ollama).
    apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
    model: text("model").notNull().default(""),
    baseUrl: text("base_url"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.provider] })],
);

export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type NewAiProviderConfig = typeof aiProviderConfigs.$inferInsert;

// ============================================================
// F11a — Slug history (redirects 301 al renombrar el subdominio)
// ============================================================
// Cuando un workspace cambia su slug, registramos el viejo aquí. Durante
// 30 días el middleware/resolver acepta el slug viejo y redirige 301 al
// nuevo, evitando que enlaces compartidos rompan. Cleanup background.
export const workspaceSlugHistory = pgTable(
  "workspace_slug_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    oldSlug: text("old_slug").notNull(),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("workspace_slug_history_old_slug_idx").on(t.oldSlug),
    index("workspace_slug_history_ws_idx").on(t.workspaceId),
    index("workspace_slug_history_expires_idx").on(t.expiresAt),
  ],
);

export type WorkspaceSlugHistory = typeof workspaceSlugHistory.$inferSelect;
export type NewWorkspaceSlugHistory = typeof workspaceSlugHistory.$inferInsert;

// ============================================================
// F11a — Custom domain verification state
// ============================================================
// Una fila por workspace que está intentando vincular un dominio propio.
// Hasta que `verifiedAt IS NOT NULL`, el dominio existe pero no resuelve.
// Verificación por TXT record `csm-verify=<token>` o por CNAME apuntando
// al ROOT_DOMAIN de la instancia.
export const workspaceDomains = pgTable(
  "workspace_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    domain: text("domain").notNull().unique(),
    verifyToken: text("verify_token").notNull(),
    verifiedAt: timestamp("verified_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    lastCheckError: text("last_check_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_domains_domain_idx").on(t.domain),
    index("workspace_domains_ws_idx").on(t.workspaceId),
  ],
);

export type WorkspaceDomain = typeof workspaceDomains.$inferSelect;
export type NewWorkspaceDomain = typeof workspaceDomains.$inferInsert;
