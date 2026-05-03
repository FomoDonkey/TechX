import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import { listRedirects } from "@/redirects/lib";
import { z } from "zod";

export const RedirectResourceSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  destination: z.string(),
  statusCode: z.number().int(),
  matchType: z.enum(["exact", "prefix", "regex"]),
  preserveQuery: z.boolean(),
  enabled: z.boolean(),
  description: z.string().nullable(),
  hits: z.number().int(),
  lastHitAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListRedirectsQuerySchema = z.object({
  enabled: z.enum(["true", "false"]).optional(),
  matchType: z.enum(["exact", "prefix", "regex"]).optional(),
  q: z.string().optional(),
});
export const ListRedirectsResponseSchema = paginatedResponseSchema(RedirectResourceSchema);

export async function listRedirectsHandler({
  query,
  ctx,
}: { query: z.infer<typeof ListRedirectsQuerySchema>; ctx: ApiContext }) {
  const rows = await listRedirects(ctx.workspaceId, {
    ...(query.enabled ? { enabled: query.enabled === "true" } : {}),
    ...(query.matchType ? { matchType: query.matchType } : {}),
    ...(query.q ? { search: query.q } : {}),
  });
  return {
    data: rows.map(serialize),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

function serialize(r: Awaited<ReturnType<typeof listRedirects>>[number]) {
  return {
    id: r.id,
    source: r.source,
    destination: r.destination,
    statusCode: r.statusCode,
    matchType: r.matchType,
    preserveQuery: r.preserveQuery,
    enabled: r.enabled,
    description: r.description,
    hits: r.hits,
    lastHitAt: r.lastHitAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
