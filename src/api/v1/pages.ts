import { notFound } from "@/api/errors";
import { computeEtag } from "@/api/runtime";
import { PageResourceSchema, PaginationQuerySchema, paginatedResponseSchema } from "@/api/schemas";
import { db } from "@/db/client";
import { pages } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

function serializePage(row: typeof pages.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    path: row.path,
    status: row.status,
    locale: row.locale,
    isHome: row.isHome,
    layout: row.layout ?? null,
    seo: row.seo ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ListPagesQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
  locale: z.string().optional(),
});

export async function listPagesHandler(input: {
  query: z.infer<typeof ListPagesQuerySchema>;
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const filters = [eq(pages.workspaceId, input.ctx.workspaceId)];
  if (input.query.status) filters.push(eq(pages.status, input.query.status));
  if (input.query.locale) filters.push(eq(pages.locale, input.query.locale));
  const rows = await db
    .select()
    .from(pages)
    .where(and(...filters))
    .orderBy(desc(pages.updatedAt))
    .limit(input.query.limit);
  return {
    etag: computeEtag(rows.map((r) => [r.id, r.updatedAt.toISOString()])),
    data: {
      data: rows.map(serializePage),
      meta: { nextCursor: null, hasMore: false, count: rows.length },
    },
  };
}

export async function getPageHandler(input: {
  params: { id: string };
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.workspaceId, input.ctx.workspaceId), eq(pages.id, input.params.id)))
    .limit(1);
  if (!row) throw notFound(`Página ${input.params.id} no existe`);
  return { etag: computeEtag(row.id, row.updatedAt.toISOString()), data: serializePage(row) };
}

export { ListPagesQuerySchema };
export const ListPagesResponseSchema = paginatedResponseSchema(PageResourceSchema);

void asc;
