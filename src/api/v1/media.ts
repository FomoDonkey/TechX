import { notFound } from "@/api/errors";
import {
  combineWhere,
  decodeCursor,
  encodeCursor,
  parseFields,
  parseSort,
  pickFields,
  sortToOrder,
} from "@/api/query";
import { computeEtag } from "@/api/runtime";
import { MediaResourceSchema, PaginationQuerySchema, paginatedResponseSchema } from "@/api/schemas";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

function serializeMedia(row: typeof media.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    blurhash: row.blurhash,
    dominantColor: row.dominantColor,
    focalX: row.focalX,
    focalY: row.focalY,
    aiTags: row.aiTags ?? null,
    tagsManual: row.tagsManual ?? null,
    variants: row.variants ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const ListMediaQuerySchema = PaginationQuerySchema.extend({
  mime: z.string().optional(),
});

const MEDIA_SORT_COLUMNS = {
  createdAt: media.createdAt,
  size: media.size,
};

export async function listMediaHandler(input: {
  query: z.infer<typeof ListMediaQuerySchema>;
  ctx: { workspaceId: string; searchParams: URLSearchParams };
}) {
  if (!db) throw new Error("DB no configurada");
  const { query, ctx } = input;
  const fields = parseFields(query.fields ?? null);
  const sorts = parseSort(query.sort ?? null);

  const filters = [eq(media.workspaceId, ctx.workspaceId)];
  if (query.mime) filters.push(sql`${media.mime} ILIKE ${`${query.mime}%`}`);
  const cursor = decodeCursor(query.cursor ?? null);
  if (cursor) {
    const cursorTs = new Date(cursor.ts);
    filters.push(
      or(
        lt(media.createdAt, cursorTs),
        and(eq(media.createdAt, cursorTs), lt(media.id, cursor.id)),
      ) as never,
    );
  }
  const order = sortToOrder(sorts, MEDIA_SORT_COLUMNS, media.createdAt);
  const limit = query.limit;

  const rows = await db
    .select()
    .from(media)
    .where(combineWhere(filters))
    .orderBy(...order, sql`${media.id} DESC`)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ ts: last.createdAt.toISOString(), id: last.id }) : null;

  return {
    etag: computeEtag(slice.map((r) => r.id)),
    data: {
      data: slice.map((r) => pickFields(serializeMedia(r), fields)),
      meta: { nextCursor, hasMore, count: slice.length },
    },
  };
}

export async function getMediaHandler(input: {
  params: { id: string };
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.workspaceId, input.ctx.workspaceId), eq(media.id, input.params.id)))
    .limit(1);
  if (!row) throw notFound(`Media ${input.params.id} no existe`);
  return { etag: computeEtag(row.id, row.createdAt.toISOString()), data: serializeMedia(row) };
}

export { ListMediaQuerySchema };
export const ListMediaResponseSchema = paginatedResponseSchema(MediaResourceSchema);
