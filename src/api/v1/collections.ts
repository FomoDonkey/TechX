import { notFound } from "@/api/errors";
import { computeEtag } from "@/api/runtime";
import { CollectionResourceSchema, paginatedResponseSchema } from "@/api/schemas";
import { db } from "@/db/client";
import { countInt } from "@/db/dialect";
import { collections, entries } from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

function serializeCollection(row: typeof collections.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    isSingleton: row.isSingleton,
    isBuiltin: row.isBuiltin,
    schema: row.schema ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCollectionsHandler(input: { ctx: { workspaceId: string } }) {
  if (!db) throw new Error("DB no configurada");
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.workspaceId, input.ctx.workspaceId))
    .orderBy(asc(collections.isBuiltin), asc(collections.name));
  const data = rows.map(serializeCollection);
  return {
    etag: computeEtag(rows.map((r) => [r.id, r.updatedAt.toISOString()])),
    data: { data, meta: { nextCursor: null, hasMore: false, count: data.length } },
  };
}

export async function getCollectionHandler(input: {
  params: { slug: string };
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const [row] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.workspaceId, input.ctx.workspaceId),
        eq(collections.slug, input.params.slug),
      ),
    )
    .limit(1);
  if (!row) throw notFound(`Colección ${input.params.slug} no existe`);
  // Incluye contador de entries
  // F9b: contador refleja main, no incluye forks de branches.
  const countRows = await db
    .select({ count: countInt() })
    .from(entries)
    .where(and(eq(entries.collectionId, row.id), isNull(entries.branchId)));
  const count = countRows[0]?.count ?? 0;
  return {
    etag: computeEtag(row.id, row.updatedAt.toISOString(), count),
    data: { ...serializeCollection(row), entryCount: count },
  };
}

export const ListCollectionsResponseSchema = paginatedResponseSchema(CollectionResourceSchema);

// Re-exports para evitar warnings
void desc;
