/**
 * Schema GraphQL handcrafted con `graphql` package.
 *
 * Por qué no Pothos: el repo ya construye su OpenAPI handcrafted desde Zod
 * (`src/api/openapi.ts`); seguir el mismo patrón aquí mantiene 0 deps de
 * codegen / type-builders y deja todo el grafo en un único archivo de leer.
 *
 * Cobertura v1: read-only para entries, collections, media, pages, comments,
 * taxonomies, terms, forms, submissions, automations, automationRuns,
 * webhooks, menus, redirects. Auth + scopes vienen del context (api key).
 */

import { db, dialect } from "@/db/client";
import { iLike as ilike } from "@/db/dialect";
import {
  apiKeys,
  automationRuns,
  automations,
  collections,
  comments,
  entries,
  forms,
  media,
  menus,
  pages,
  redirects,
  submissions,
  taxonomies,
  terms,
  webhooks,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLError,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
} from "graphql";
import type { GraphQLContext } from "./context";

// ============================================================
// Scalars
// ============================================================

const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 timestamp string",
  serialize(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
  },
  parseValue(value: unknown) {
    return typeof value === "string" ? new Date(value) : null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value (object, array, string, number, boolean, null)",
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return parseAst(ast);
  },
});

function parseAst(ast: unknown): unknown {
  // Soporte recursivo simple para parseLiteral
  // biome-ignore lint/suspicious/noExplicitAny: AST union type requires any
  const node = ast as any;
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.OBJECT: {
      // biome-ignore lint/suspicious/noExplicitAny: AST union type
      return Object.fromEntries(node.fields.map((f: any) => [f.name.value, parseAst(f.value)]));
    }
    case Kind.LIST:
      // biome-ignore lint/suspicious/noExplicitAny: AST union type
      return node.values.map((v: any) => parseAst(v));
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

// ============================================================
// Helpers (auth + serialization)
// ============================================================

function requireScope(ctx: GraphQLContext, scope: string) {
  if (!ctx.apiKey) {
    throw new GraphQLError("Unauthorized: missing API key", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  if (!hasScopeLocal(ctx.apiKey.scopes, scope)) {
    throw new GraphQLError(`Forbidden: scope '${scope}' required`, {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

function hasScopeLocal(scopes: string[], required: string): boolean {
  // Replica de hasScope de api/keys.ts para evitar import cycle
  if (scopes.includes("*")) return true;
  if (scopes.includes(required)) return true;
  const [resource, action] = required.split(":");
  if (!resource || !action) return false;
  if (scopes.includes(`${resource}:*`)) return true;
  if (scopes.includes(`*:${action}`)) return true;
  return false;
}

// ============================================================
// Common types
// ============================================================

const PageInfoType = new GraphQLObjectType({
  name: "PageInfo",
  fields: () => ({
    hasMore: { type: new GraphQLNonNull(GraphQLBoolean) },
    nextCursor: { type: GraphQLString },
    count: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

function decodeCursor(cursor: string | null | undefined): { ts: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (typeof decoded?.ts === "string" && typeof decoded?.id === "string") return decoded;
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(ts: Date | string, id: string): string {
  const tsStr = ts instanceof Date ? ts.toISOString() : ts;
  return Buffer.from(JSON.stringify({ ts: tsStr, id })).toString("base64");
}

// ============================================================
// Resource types
// ============================================================

const EntryStatusEnum = new GraphQLEnumType({
  name: "EntryStatus",
  values: {
    draft: {},
    review: {},
    approved: {},
    scheduled: {},
    published: {},
    archived: {},
  },
});

const EntryType = new GraphQLObjectType({
  name: "Entry",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    excerpt: { type: GraphQLString },
    body: { type: JSONScalar },
    status: { type: new GraphQLNonNull(EntryStatusEnum) },
    locale: { type: new GraphQLNonNull(GraphQLString) },
    collectionId: { type: new GraphQLNonNull(GraphQLID) },
    publishedAt: { type: DateTimeScalar },
    scheduledAt: { type: DateTimeScalar },
    seo: { type: JSONScalar },
    fields: { type: JSONScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
    updatedAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const EntryConnectionType = new GraphQLObjectType({
  name: "EntryConnection",
  fields: () => ({
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EntryType))) },
    pageInfo: { type: new GraphQLNonNull(PageInfoType) },
  }),
});

const CollectionType = new GraphQLObjectType({
  name: "Collection",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    icon: { type: GraphQLString },
    description: { type: GraphQLString },
    isSingleton: { type: new GraphQLNonNull(GraphQLBoolean) },
    isBuiltin: { type: new GraphQLNonNull(GraphQLBoolean) },
    schema: { type: JSONScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
    updatedAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const MediaType = new GraphQLObjectType({
  name: "Media",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    url: { type: new GraphQLNonNull(GraphQLString) },
    filename: { type: GraphQLString },
    mime: { type: new GraphQLNonNull(GraphQLString) },
    size: { type: new GraphQLNonNull(GraphQLInt) },
    width: { type: GraphQLInt },
    height: { type: GraphQLInt },
    alt: { type: GraphQLString },
    caption: { type: GraphQLString },
    blurhash: { type: GraphQLString },
    aiTags: { type: new GraphQLList(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const MediaConnectionType = new GraphQLObjectType({
  name: "MediaConnection",
  fields: () => ({
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MediaType))) },
    pageInfo: { type: new GraphQLNonNull(PageInfoType) },
  }),
});

const PageType = new GraphQLObjectType({
  name: "Page",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    path: { type: new GraphQLNonNull(GraphQLString) },
    locale: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    isHome: { type: new GraphQLNonNull(GraphQLBoolean) },
    layout: { type: JSONScalar },
    seo: { type: JSONScalar },
    publishedAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
    updatedAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const CommentType = new GraphQLObjectType({
  name: "Comment",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    entryId: { type: new GraphQLNonNull(GraphQLID) },
    parentId: { type: GraphQLID },
    authorName: { type: new GraphQLNonNull(GraphQLString) },
    authorEmail: { type: new GraphQLNonNull(GraphQLString) },
    body: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    aiScore: { type: GraphQLInt },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const CommentConnectionType = new GraphQLObjectType({
  name: "CommentConnection",
  fields: () => ({
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CommentType))) },
    pageInfo: { type: new GraphQLNonNull(PageInfoType) },
  }),
});

const TaxonomyType = new GraphQLObjectType({
  name: "Taxonomy",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    terms: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TermType))),
      resolve: async (parent: { id: string }) => {
        if (!db) return [];
        return db.select().from(terms).where(eq(terms.taxonomyId, parent.id));
      },
    },
  }),
});

const TermType = new GraphQLObjectType({
  name: "Term",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    parentId: { type: GraphQLID },
  }),
});

const FormType = new GraphQLObjectType({
  name: "Form",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    status: { type: new GraphQLNonNull(GraphQLString) },
    version: { type: new GraphQLNonNull(GraphQLInt) },
    submissionsCount: { type: new GraphQLNonNull(GraphQLInt) },
    spamCount: { type: new GraphQLNonNull(GraphQLInt) },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
    updatedAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const SubmissionType = new GraphQLObjectType({
  name: "Submission",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    formId: { type: new GraphQLNonNull(GraphQLID) },
    formVersion: { type: new GraphQLNonNull(GraphQLInt) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    spamScore: { type: new GraphQLNonNull(GraphQLInt) },
    data: { type: JSONScalar },
    country: { type: GraphQLString },
    confirmedAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const AutomationType = new GraphQLObjectType({
  name: "Automation",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    triggerType: { type: new GraphQLNonNull(GraphQLString) },
    active: { type: new GraphQLNonNull(GraphQLBoolean) },
    runsTotal: { type: new GraphQLNonNull(GraphQLInt) },
    runsFailed: { type: new GraphQLNonNull(GraphQLInt) },
    lastRunAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const AutomationRunType = new GraphQLObjectType({
  name: "AutomationRun",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    automationId: { type: new GraphQLNonNull(GraphQLID) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    triggerEvent: { type: new GraphQLNonNull(GraphQLString) },
    error: { type: GraphQLString },
    durationMs: { type: GraphQLInt },
    startedAt: { type: DateTimeScalar },
    finishedAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const WebhookType = new GraphQLObjectType({
  name: "Webhook",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    url: { type: new GraphQLNonNull(GraphQLString) },
    events: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
    active: { type: new GraphQLNonNull(GraphQLBoolean) },
    lastSuccessAt: { type: DateTimeScalar },
    lastFailureAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const MenuType = new GraphQLObjectType({
  name: "Menu",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    location: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    isDefault: { type: new GraphQLNonNull(GraphQLBoolean) },
    version: { type: new GraphQLNonNull(GraphQLInt) },
    items: { type: JSONScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const RedirectType = new GraphQLObjectType({
  name: "Redirect",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    source: { type: new GraphQLNonNull(GraphQLString) },
    destination: { type: new GraphQLNonNull(GraphQLString) },
    statusCode: { type: new GraphQLNonNull(GraphQLInt) },
    matchType: { type: new GraphQLNonNull(GraphQLString) },
    preserveQuery: { type: new GraphQLNonNull(GraphQLBoolean) },
    enabled: { type: new GraphQLNonNull(GraphQLBoolean) },
    hits: { type: new GraphQLNonNull(GraphQLInt) },
    lastHitAt: { type: DateTimeScalar },
    createdAt: { type: new GraphQLNonNull(DateTimeScalar) },
  }),
});

const MeType = new GraphQLObjectType({
  name: "Me",
  fields: () => ({
    apiKeyId: { type: new GraphQLNonNull(GraphQLID) },
    workspaceId: { type: new GraphQLNonNull(GraphQLID) },
    scopes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
    environment: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

// ============================================================
// Query root
// ============================================================

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    // — Health
    health: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "ok",
    },
    me: {
      type: MeType,
      resolve: (_root, _args, ctx: GraphQLContext) => {
        if (!ctx.apiKey) return null;
        return {
          apiKeyId: ctx.apiKey.id,
          workspaceId: ctx.apiKey.workspaceId,
          scopes: ctx.apiKey.scopes,
          environment: ctx.apiKey.environment,
        };
      },
    },

    // — Entries
    entries: {
      type: new GraphQLNonNull(EntryConnectionType),
      args: {
        status: { type: EntryStatusEnum },
        collectionId: { type: GraphQLID },
        locale: { type: GraphQLString },
        cursor: { type: GraphQLString },
        limit: { type: GraphQLInt },
      },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "entries:read");
        if (!db || !ctx.apiKey)
          return { nodes: [], pageInfo: { hasMore: false, nextCursor: null, count: 0 } };
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        // F9b: GraphQL público nunca devuelve forks de branches.
        const conds = [eq(entries.workspaceId, ctx.apiKey.workspaceId), isNull(entries.branchId)];
        if (args.status) conds.push(eq(entries.status, args.status));
        if (args.collectionId) conds.push(eq(entries.collectionId, args.collectionId));
        if (args.locale) conds.push(eq(entries.locale, args.locale));
        const cur = decodeCursor(args.cursor);
        if (cur) {
          // Cursor pagination cross-dialect. PG necesita `::text` para uuid y
          // `::timestamp` para el literal date; MySQL no necesita casts.
          //
          // IMPORTANTE: pasamos el timestamp como ISO string (no Date) — los
          // drivers (postgres-js, mysql2) fallan con `TypeError` cuando
          // reciben Date dentro de `sql\`...\``. Postgres lo casta a timestamp
          // vía `::timestamp`; MySQL acepta ISO string directo.
          const cursorTs = new Date(cur.ts).toISOString();
          conds.push(
            dialect === "postgres"
              ? sql`(${entries.updatedAt}, ${entries.id}::text) < (${cursorTs}::timestamp, ${cur.id})`
              : sql`(${entries.updatedAt}, ${entries.id}) < (${cursorTs}, ${cur.id})`,
          );
        }
        const rows = await db
          .select()
          .from(entries)
          .where(and(...conds))
          .orderBy(desc(entries.updatedAt), desc(entries.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const slice = rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          nodes: slice,
          pageInfo: {
            hasMore,
            nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
            count: slice.length,
          },
        };
      },
    },
    entry: {
      type: EntryType,
      args: { id: { type: GraphQLID }, slug: { type: GraphQLString } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "entries:read");
        if (!db || !ctx.apiKey) return null;
        if (!args.id && !args.slug) {
          throw new GraphQLError("Provide id or slug");
        }
        // F9b: GraphQL público nunca devuelve forks de branches.
        const conds = [eq(entries.workspaceId, ctx.apiKey.workspaceId), isNull(entries.branchId)];
        if (args.id) conds.push(eq(entries.id, args.id));
        else if (args.slug) conds.push(eq(entries.slug, args.slug));
        const [row] = await db
          .select()
          .from(entries)
          .where(and(...conds))
          .limit(1);
        return row ?? null;
      },
    },

    // — Collections
    collections: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CollectionType))),
      async resolve(_root, _args, ctx: GraphQLContext) {
        requireScope(ctx, "collections:read");
        if (!db || !ctx.apiKey) return [];
        return db
          .select()
          .from(collections)
          .where(eq(collections.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(asc(collections.name));
      },
    },
    collection: {
      type: CollectionType,
      args: { slug: { type: new GraphQLNonNull(GraphQLString) } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "collections:read");
        if (!db || !ctx.apiKey) return null;
        const [row] = await db
          .select()
          .from(collections)
          .where(
            and(
              eq(collections.workspaceId, ctx.apiKey.workspaceId),
              eq(collections.slug, args.slug),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // — Media
    media: {
      type: new GraphQLNonNull(MediaConnectionType),
      args: { cursor: { type: GraphQLString }, limit: { type: GraphQLInt } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "media:read");
        if (!db || !ctx.apiKey)
          return { nodes: [], pageInfo: { hasMore: false, nextCursor: null, count: 0 } };
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const rows = await db
          .select()
          .from(media)
          .where(eq(media.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(desc(media.createdAt), desc(media.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const slice = rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          nodes: slice,
          pageInfo: {
            hasMore,
            nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
            count: slice.length,
          },
        };
      },
    },

    // — Pages
    pages: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PageType))),
      args: { status: { type: GraphQLString }, locale: { type: GraphQLString } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "pages:read");
        if (!db || !ctx.apiKey) return [];
        const conds = [eq(pages.workspaceId, ctx.apiKey.workspaceId)];
        if (args.status) conds.push(eq(pages.status, args.status));
        if (args.locale) conds.push(eq(pages.locale, args.locale));
        return db
          .select()
          .from(pages)
          .where(and(...conds))
          .orderBy(desc(pages.updatedAt));
      },
    },

    // — Comments
    comments: {
      type: new GraphQLNonNull(CommentConnectionType),
      args: {
        status: { type: GraphQLString },
        entryId: { type: GraphQLID },
        cursor: { type: GraphQLString },
        limit: { type: GraphQLInt },
      },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "comments:read");
        if (!db || !ctx.apiKey)
          return { nodes: [], pageInfo: { hasMore: false, nextCursor: null, count: 0 } };
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const conds = [eq(comments.workspaceId, ctx.apiKey.workspaceId)];
        if (args.status) conds.push(eq(comments.status, args.status));
        if (args.entryId) conds.push(eq(comments.entryId, args.entryId));
        const rows = await db
          .select()
          .from(comments)
          .where(and(...conds))
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const slice = rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          nodes: slice,
          pageInfo: {
            hasMore,
            nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
            count: slice.length,
          },
        };
      },
    },

    // — Taxonomies
    taxonomies: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaxonomyType))),
      async resolve(_root, _args, ctx: GraphQLContext) {
        requireScope(ctx, "taxonomies:read");
        if (!db || !ctx.apiKey) return [];
        return db
          .select()
          .from(taxonomies)
          .where(eq(taxonomies.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(asc(taxonomies.name));
      },
    },

    // — Forms
    forms: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FormType))),
      args: { status: { type: GraphQLString }, q: { type: GraphQLString } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "forms:read");
        if (!db || !ctx.apiKey) return [];
        const conds = [eq(forms.workspaceId, ctx.apiKey.workspaceId)];
        if (args.status) conds.push(eq(forms.status, args.status));
        if (args.q) conds.push(ilike(forms.name, `%${args.q}%`));
        return db
          .select()
          .from(forms)
          .where(and(...conds))
          .orderBy(desc(forms.updatedAt));
      },
    },
    submissions: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(SubmissionType))),
      args: { formId: { type: new GraphQLNonNull(GraphQLID) }, limit: { type: GraphQLInt } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "submissions:read");
        if (!db || !ctx.apiKey) return [];
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        return db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.workspaceId, ctx.apiKey.workspaceId),
              eq(submissions.formId, args.formId),
            ),
          )
          .orderBy(desc(submissions.createdAt))
          .limit(limit);
      },
    },

    // — Automations
    automations: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AutomationType))),
      async resolve(_root, _args, ctx: GraphQLContext) {
        requireScope(ctx, "automations:read");
        if (!db || !ctx.apiKey) return [];
        return db
          .select()
          .from(automations)
          .where(eq(automations.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(desc(automations.updatedAt));
      },
    },
    automationRuns: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AutomationRunType))),
      args: { automationId: { type: new GraphQLNonNull(GraphQLID) }, limit: { type: GraphQLInt } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "runs:read");
        if (!db || !ctx.apiKey) return [];
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        return db
          .select()
          .from(automationRuns)
          .where(
            and(
              eq(automationRuns.workspaceId, ctx.apiKey.workspaceId),
              eq(automationRuns.automationId, args.automationId),
            ),
          )
          .orderBy(desc(automationRuns.createdAt))
          .limit(limit);
      },
    },

    // — Webhooks
    webhooks: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(WebhookType))),
      async resolve(_root, _args, ctx: GraphQLContext) {
        requireScope(ctx, "webhooks:read");
        if (!db || !ctx.apiKey) return [];
        return db
          .select()
          .from(webhooks)
          .where(eq(webhooks.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(desc(webhooks.updatedAt));
      },
    },

    // — Menus
    menus: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MenuType))),
      async resolve(_root, _args, ctx: GraphQLContext) {
        requireScope(ctx, "menus:read");
        if (!db || !ctx.apiKey) return [];
        return db
          .select()
          .from(menus)
          .where(eq(menus.workspaceId, ctx.apiKey.workspaceId))
          .orderBy(asc(menus.location), asc(menus.name));
      },
    },
    menu: {
      type: MenuType,
      args: { slug: { type: new GraphQLNonNull(GraphQLString) } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "menus:read");
        if (!db || !ctx.apiKey) return null;
        const [row] = await db
          .select()
          .from(menus)
          .where(and(eq(menus.workspaceId, ctx.apiKey.workspaceId), eq(menus.slug, args.slug)))
          .limit(1);
        return row ?? null;
      },
    },

    // — Redirects
    redirects: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RedirectType))),
      args: { enabled: { type: GraphQLBoolean } },
      async resolve(_root, args, ctx: GraphQLContext) {
        requireScope(ctx, "redirects:read");
        if (!db || !ctx.apiKey) return [];
        const conds = [eq(redirects.workspaceId, ctx.apiKey.workspaceId)];
        if (typeof args.enabled === "boolean") conds.push(eq(redirects.enabled, args.enabled));
        return db
          .select()
          .from(redirects)
          .where(and(...conds))
          .orderBy(desc(redirects.updatedAt));
      },
    },
  }),
});

export const csmGraphQLSchema = new GraphQLSchema({
  query: QueryType,
  types: [
    EntryType,
    CollectionType,
    MediaType,
    PageType,
    CommentType,
    TaxonomyType,
    TermType,
    FormType,
    SubmissionType,
    AutomationType,
    AutomationRunType,
    WebhookType,
    MenuType,
    RedirectType,
    MeType,
  ],
});

// Para no romper imports en handlers
export { apiKeys };
