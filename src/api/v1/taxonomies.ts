import { computeEtag } from "@/api/runtime";
import { TaxonomyResourceSchema, paginatedResponseSchema } from "@/api/schemas";
import { db } from "@/db/client";
import { taxonomies, terms } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";

export async function listTaxonomiesHandler(input: { ctx: { workspaceId: string } }) {
  if (!db) throw new Error("DB no configurada");
  const taxRows = await db
    .select()
    .from(taxonomies)
    .where(eq(taxonomies.workspaceId, input.ctx.workspaceId))
    .orderBy(asc(taxonomies.name));
  const taxIds = taxRows.map((t) => t.id);
  const termRows =
    taxIds.length > 0 ? await db.select().from(terms).where(inArray(terms.taxonomyId, taxIds)) : [];
  const data = taxRows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    type: t.type,
    terms: termRows
      .filter((tr) => tr.taxonomyId === t.id)
      .map((tr) => ({ id: tr.id, name: tr.name, slug: tr.slug, parentId: tr.parentId })),
  }));
  return {
    etag: computeEtag(data),
    data: { data, meta: { nextCursor: null, hasMore: false, count: data.length } },
  };
}

export const ListTaxonomiesResponseSchema = paginatedResponseSchema(TaxonomyResourceSchema);
