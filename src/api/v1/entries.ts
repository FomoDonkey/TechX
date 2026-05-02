/**
 * Handlers REST v1 — entries.
 */

import { conflict, notFound } from "@/api/errors";
import {
  clauseToSql,
  combineWhere,
  decodeCursor,
  encodeCursor,
  parseFields,
  parseSort,
  parseWhere,
  pickFields,
  sortToOrder,
} from "@/api/query";
import { computeEtag } from "@/api/runtime";
import {
  type EntryCreateSchema,
  EntryResourceSchema,
  type EntryUpdateSchema,
  PaginationQuerySchema,
  UuidSchema,
  paginatedResponseSchema,
} from "@/api/schemas";
import { db } from "@/db/client";
import { type Entry, collections, entries } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { ensureUniqueEntrySlug, getOrCreateBuiltinCollection } from "@/lib/entries";
import { slugify } from "@/lib/slug";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

const ENTRY_FILTER_COLUMNS = {
  status: entries.status,
  locale: entries.locale,
  collectionId: entries.collectionId,
  authorId: entries.authorId,
};

const ENTRY_SORT_COLUMNS = {
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
  publishedAt: entries.publishedAt,
  title: entries.title,
};

function serializeEntry(row: Entry, collection?: { id: string; slug: string; name: string }) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    status: row.status,
    locale: row.locale,
    body: row.body ?? null,
    bodyText: row.bodyText,
    fields: row.fields ?? null,
    authorId: row.authorId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    seo: row.seo ?? null,
    ogImageUrl: row.ogImageUrl,
    ...(collection ? { collection } : {}),
  };
}

// ============================================================
// LIST: GET /v1/entries
// ============================================================

export const ListEntriesQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]).optional(),
  collectionSlug: z.string().optional(),
  locale: z.string().optional(),
  q: z.string().optional(),
});

export async function listEntriesHandler(input: {
  query: z.infer<typeof ListEntriesQuerySchema>;
  ctx: { workspaceId: string; searchParams: URLSearchParams };
}) {
  if (!db) throw new Error("DB no configurada");
  const { query, ctx } = input;
  const fields = parseFields(query.fields ?? null);
  const sorts = parseSort(query.sort ?? null);
  const whereClauses = parseWhere(ctx.searchParams);

  const filters = [eq(entries.workspaceId, ctx.workspaceId)];
  if (query.status) filters.push(eq(entries.status, query.status));
  if (query.locale) filters.push(eq(entries.locale, query.locale));
  if (query.q) {
    filters.push(
      sql`(${entries.title} ILIKE ${`%${query.q}%`} OR ${entries.bodyText} ILIKE ${`%${query.q}%`})`,
    );
  }
  if (query.collectionSlug) {
    const [coll] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.workspaceId, ctx.workspaceId),
          eq(collections.slug, query.collectionSlug),
        ),
      )
      .limit(1);
    if (!coll) {
      return {
        etag: computeEtag("empty"),
        data: { data: [], meta: { nextCursor: null, hasMore: false, count: 0 } },
      };
    }
    filters.push(eq(entries.collectionId, coll.id));
  }
  for (const clause of whereClauses) {
    const sqlClause = clauseToSql(clause, ENTRY_FILTER_COLUMNS);
    if (sqlClause) filters.push(sqlClause);
  }

  // Cursor: keyset pagination on (updatedAt DESC, id ASC)
  const cursor = decodeCursor(query.cursor ?? null);
  if (cursor) {
    const cursorTs = new Date(cursor.ts);
    filters.push(
      or(
        lt(entries.updatedAt, cursorTs),
        and(eq(entries.updatedAt, cursorTs), lt(entries.id, cursor.id)),
      ) as never,
    );
  }

  const order = sortToOrder(sorts, ENTRY_SORT_COLUMNS, entries.updatedAt);
  const limit = query.limit;

  const rows = await db
    .select()
    .from(entries)
    .where(combineWhere(filters))
    .orderBy(...order, sql`${entries.id} DESC`)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ ts: last.updatedAt.toISOString(), id: last.id }) : null;

  const data = slice.map((row) => pickFields(serializeEntry(row), fields));
  const etag = computeEtag(slice.map((r) => [r.id, r.updatedAt.toISOString()]));

  return {
    etag,
    data: {
      data,
      meta: { nextCursor, hasMore, count: slice.length },
    },
  };
}

export const ListEntriesResponseSchema = paginatedResponseSchema(EntryResourceSchema);

// ============================================================
// GET /v1/entries/:id
// ============================================================

export async function getEntryHandler(input: {
  params: { id: string };
  query: { fields?: string; locale?: string };
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const idOrSlug = input.params.id;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  let row: Entry | undefined;
  if (isUuid) {
    [row] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.workspaceId, input.ctx.workspaceId), eq(entries.id, idOrSlug)))
      .limit(1);
  } else {
    const filters = [eq(entries.workspaceId, input.ctx.workspaceId), eq(entries.slug, idOrSlug)];
    if (input.query.locale) filters.push(eq(entries.locale, input.query.locale));
    [row] = await db.select().from(entries).where(combineWhere(filters)).limit(1);
  }
  if (!row) throw notFound(`Entrada ${idOrSlug} no existe`);

  const fields = parseFields(input.query.fields ?? null);
  return {
    etag: computeEtag(row.id, row.updatedAt.toISOString()),
    data: pickFields(serializeEntry(row), fields),
  };
}

// ============================================================
// POST /v1/entries
// ============================================================

export async function createEntryHandler(input: {
  body: z.infer<typeof EntryCreateSchema>;
  ctx: { workspaceId: string; apiKey: { id: string; environment: string } };
}) {
  if (!db) throw new Error("DB no configurada");
  const { body, ctx } = input;

  if (ctx.apiKey.environment === "test") {
    // Las test keys NO mutan datos; devuelven un objeto simulado en memoria
    return {
      id: `test_${Math.random().toString(36).slice(2, 10)}`,
      title: body.title,
      slug: body.slug ?? slugify(body.title),
      excerpt: body.excerpt ?? null,
      status: body.status,
      locale: body.locale ?? "es",
      body: body.body ?? null,
      bodyText: null,
      fields: body.fields ?? null,
      authorId: null,
      publishedAt: null,
      scheduledAt: body.scheduledAt ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seo: body.seo ?? null,
      ogImageUrl: null,
    };
  }

  // Resolver collection: para builtins (posts/pages) auto-creamos; para custom
  // exigimos que ya exista (no creamos colecciones implícitamente vía API).
  const collSlug = body.collectionSlug ?? "posts";
  const isBuiltinSlug = collSlug === "posts" || collSlug === "pages";
  let collection: { id: string; slug: string } | null = null;
  if (isBuiltinSlug) {
    collection = await getOrCreateBuiltinCollection(ctx.workspaceId, collSlug).catch(() => null);
  } else {
    const [row] = await db
      .select({ id: collections.id, slug: collections.slug })
      .from(collections)
      .where(and(eq(collections.workspaceId, ctx.workspaceId), eq(collections.slug, collSlug)))
      .limit(1);
    collection = row ?? null;
  }
  if (!collection) throw notFound(`Colección "${collSlug}" no existe`);

  // Si vino slug, asegurarlo único; si no, generar desde título
  const baseSlug = body.slug ?? slugify(body.title);
  const slug = await ensureUniqueEntrySlug(
    ctx.workspaceId,
    collection.id,
    body.locale ?? "es",
    baseSlug,
  );

  // authorId queda null porque las API keys no son users (FK apunta a users.id).
  // El audit log conserva la api_key_id que originó la creación.
  const created = await db
    .insert(entries)
    .values({
      workspaceId: ctx.workspaceId,
      collectionId: collection.id,
      title: body.title,
      slug,
      locale: body.locale ?? "es",
      status: "draft",
      body: { type: "doc", content: [{ type: "paragraph" }] } as Record<string, unknown>,
      bodyText: "",
      authorId: null,
      updatedById: null,
    })
    .returning();
  const createdRow = created[0];
  if (!createdRow) throw conflict("No se pudo crear la entrada");

  // Actualizamos los campos opcionales del body en una segunda query (mantenemos
  // el insert mínimo para reusar la unique-violation tolerance que ya tiene
  // ensureUniqueEntrySlug; cualquier otra columna puede ir después).
  const hasExtras =
    body.body !== undefined ||
    body.excerpt !== undefined ||
    body.fields !== undefined ||
    body.seo !== undefined ||
    body.status !== "draft" ||
    body.scheduledAt !== undefined;
  if (hasExtras) {
    const setBag: Record<string, unknown> = { updatedAt: new Date() };
    if (body.body !== undefined) setBag.body = body.body;
    if (body.excerpt !== undefined) setBag.excerpt = body.excerpt;
    if (body.fields !== undefined) setBag.fields = body.fields;
    if (body.seo !== undefined) setBag.seo = body.seo;
    if (body.status !== "draft") setBag.status = body.status;
    if (body.status === "published") setBag.publishedAt = new Date();
    if (body.scheduledAt !== undefined) {
      setBag.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }
    await db
      .update(entries)
      .set(setBag)
      .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.id, createdRow.id)));
  }

  await logActivity({
    workspaceId: ctx.workspaceId,
    actorId: null,
    action: "entry.created",
    targetType: "entry",
    targetId: createdRow.id,
    meta: { via: "api", apiKeyId: ctx.apiKey.id, title: body.title, slug },
  });

  const [final] = await db.select().from(entries).where(eq(entries.id, createdRow.id)).limit(1);
  if (!final) throw conflict("La entrada se creó pero no se pudo recuperar");

  emitAsync({
    workspaceId: ctx.workspaceId,
    event: "entry.created",
    payload: { id: final.id, title: final.title, slug: final.slug, status: final.status },
  });
  if (final.status === "published") {
    emitAsync({
      workspaceId: ctx.workspaceId,
      event: "entry.published",
      payload: { id: final.id, slug: final.slug, title: final.title, via: "api" },
    });
  }

  return serializeEntry(final);
}

// ============================================================
// PATCH /v1/entries/:id
// ============================================================

export async function updateEntryHandler(input: {
  params: { id: string };
  body: z.infer<typeof EntryUpdateSchema>;
  ctx: { workspaceId: string; apiKey: { environment: string } };
}) {
  if (!db) throw new Error("DB no configurada");
  const { params, body, ctx } = input;
  if (ctx.apiKey.environment === "test") {
    return {
      ...body,
      id: params.id,
      updatedAt: new Date().toISOString(),
    };
  }
  UuidSchema.parse(params.id);
  const [existing] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.id, params.id)))
    .limit(1);
  if (!existing) throw notFound(`Entrada ${params.id} no existe`);

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (body.title !== undefined) updates.title = body.title;
  if (body.excerpt !== undefined) updates.excerpt = body.excerpt;
  if (body.body !== undefined) updates.body = body.body;
  if (body.fields !== undefined) updates.fields = body.fields;
  if (body.seo !== undefined) updates.seo = body.seo;
  if (body.locale !== undefined) updates.locale = body.locale;
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "published" && !existing.publishedAt) updates.publishedAt = new Date();
  }
  if (body.scheduledAt !== undefined) {
    updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  }
  if (body.slug !== undefined) {
    updates.slug = await ensureUniqueEntrySlug(
      ctx.workspaceId,
      existing.collectionId,
      body.locale ?? existing.locale,
      body.slug,
      existing.id,
    );
  }

  await db
    .update(entries)
    .set(updates)
    .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.id, params.id)));

  const [final] = await db.select().from(entries).where(eq(entries.id, params.id)).limit(1);
  if (!final) throw notFound("Entrada no encontrada tras update");
  await logActivity({
    workspaceId: ctx.workspaceId,
    actorId: null,
    action: "entry.updated",
    targetType: "entry",
    targetId: final.id,
    meta: { via: "api" },
  });
  emitAsync({
    workspaceId: ctx.workspaceId,
    event: "entry.updated",
    payload: { id: final.id, title: final.title, slug: final.slug, status: final.status },
  });
  // Webhook por transición real de estado
  if (existing.status !== "published" && final.status === "published") {
    emitAsync({
      workspaceId: ctx.workspaceId,
      event: "entry.published",
      payload: { id: final.id, slug: final.slug, title: final.title, via: "api" },
    });
  } else if (existing.status === "published" && final.status !== "published") {
    emitAsync({
      workspaceId: ctx.workspaceId,
      event: "entry.unpublished",
      payload: { id: final.id, slug: final.slug, title: final.title, via: "api" },
    });
  }
  return serializeEntry(final);
}

// ============================================================
// DELETE /v1/entries/:id
// ============================================================

export async function deleteEntryHandler(input: {
  params: { id: string };
  ctx: { workspaceId: string; apiKey: { environment: string } };
}) {
  if (!db) throw new Error("DB no configurada");
  if (input.ctx.apiKey.environment === "test") return { ok: true as const };
  UuidSchema.parse(input.params.id);
  const result = await db
    .delete(entries)
    .where(and(eq(entries.workspaceId, input.ctx.workspaceId), eq(entries.id, input.params.id)))
    .returning({ id: entries.id });
  if (result.length === 0) throw notFound(`Entrada ${input.params.id} no existe`);
  await logActivity({
    workspaceId: input.ctx.workspaceId,
    actorId: null,
    action: "entry.deleted",
    targetType: "entry",
    targetId: input.params.id,
    meta: { via: "api" },
  });
  emitAsync({
    workspaceId: input.ctx.workspaceId,
    event: "entry.deleted",
    payload: { id: input.params.id, via: "api" },
  });
  return { ok: true as const };
}

// ============================================================
// POST /v1/entries/:id/publish
// ============================================================

export async function publishEntryHandler(input: {
  params: { id: string };
  ctx: { workspaceId: string; apiKey: { environment: string } };
}) {
  if (!db) throw new Error("DB no configurada");
  if (input.ctx.apiKey.environment === "test") return { ok: true as const, published: 1 };
  UuidSchema.parse(input.params.id);
  // Verificamos primero que la entrada existe (para distinguir 404 vs idempotente)
  const [existing] = await db
    .select({ id: entries.id, status: entries.status, slug: entries.slug, title: entries.title })
    .from(entries)
    .where(and(eq(entries.workspaceId, input.ctx.workspaceId), eq(entries.id, input.params.id)))
    .limit(1);
  if (!existing) throw notFound(`Entrada ${input.params.id} no existe`);
  // Sólo emitimos webhook si realmente transiciona
  if (existing.status === "published") {
    return { ok: true as const, published: 0, alreadyPublished: true };
  }
  await db
    .update(entries)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(entries.workspaceId, input.ctx.workspaceId), eq(entries.id, input.params.id)));
  await logActivity({
    workspaceId: input.ctx.workspaceId,
    actorId: null,
    action: "entry.published",
    targetType: "entry",
    targetId: input.params.id,
    meta: { via: "api" },
  });
  emitAsync({
    workspaceId: input.ctx.workspaceId,
    event: "entry.published",
    payload: { id: existing.id, slug: existing.slug, title: existing.title, via: "api" },
  });
  return { ok: true as const, published: 1 };
}
