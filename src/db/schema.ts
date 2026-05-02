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
  "scheduled",
  "published",
  "archived",
]);
export const commentStatusEnum = pgEnum("comment_status", ["pending", "approved", "spam"]);
export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
  "bounced",
]);
export const taxonomyTypeEnum = pgEnum("taxonomy_type", ["category", "tag"]);
export const branchStatusEnum = pgEnum("branch_status", ["draft", "merged", "abandoned"]);
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_handle_idx").on(t.handle)],
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collections_ws_slug_idx").on(t.workspaceId, t.slug)],
);

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseBranchId: uuid("base_branch_id"),
  status: branchStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    seo: jsonb("seo").$type<{ title?: string; description?: string; ogImage?: string }>(),
    ogImageUrl: text("og_image_url"),
    embedding: vector("embedding", { dimensions: 1536 }),
    fields: jsonb("fields").$type<Record<string, unknown>>(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscribers_ws_email_idx").on(t.workspaceId, t.email)],
);

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rules: jsonb("rules"),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: jsonb("body"),
  segmentId: uuid("segment_id"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  status: text("status").default("draft"),
  opens: integer("opens").default(0),
  clicks: integer("clicks").default(0),
});

export const tiers = pgTable("tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  interval: text("interval").default("month"),
  perks: jsonb("perks"),
  stripePriceId: text("stripe_price_id"),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  tierId: uuid("tier_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
});

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

export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  items: jsonb("items"),
});

export const redirects = pgTable("redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  from: text("from").notNull(),
  to: text("to").notNull(),
  code: integer("code").default(301),
});

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
