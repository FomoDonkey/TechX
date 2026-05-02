import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import { getFormById, listForms, listSubmissions } from "@/forms/lib";
import { z } from "zod";

export const FormResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  version: z.number().int(),
  submissionsCount: z.number().int(),
  spamCount: z.number().int(),
  lastSubmissionAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListFormsResponseSchema = paginatedResponseSchema(FormResourceSchema);
export const ListFormsQuerySchema = z.object({
  status: z.enum(["draft", "published", "archived"]).optional(),
  q: z.string().optional(),
});

export async function listFormsHandler({
  query,
  ctx,
}: { query: z.infer<typeof ListFormsQuerySchema>; ctx: ApiContext }) {
  const rows = await listForms(ctx.workspaceId, {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { search: query.q } : {}),
  });
  return {
    data: rows.map(serializeForm),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const FormDetailParams = z.object({ id: z.string().uuid() });

export async function getFormHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const f = await getFormById(ctx.workspaceId, params.id);
  if (!f) return null;
  return serializeForm(f);
}

// ============================================================
// Submissions
// ============================================================

export const SubmissionResourceSchema = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  formVersion: z.number().int(),
  status: z.enum(["received", "spam", "processed", "archived"]),
  spamScore: z.number().int(),
  data: z.record(z.unknown()),
  country: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const ListSubmissionsResponseSchema = paginatedResponseSchema(SubmissionResourceSchema);

export const ListSubmissionsQuerySchema = z.object({
  status: z.enum(["received", "spam", "processed", "archived"]).optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

export async function listSubmissionsHandler({
  params,
  query,
  ctx,
}: {
  params: { id: string };
  query: z.infer<typeof ListSubmissionsQuerySchema>;
  ctx: ApiContext;
}) {
  // Validación previa: el form debe pertenecer al workspace
  const form = await getFormById(ctx.workspaceId, params.id);
  if (!form) return { data: [], meta: { nextCursor: null, hasMore: false, count: 0 } };

  let cursor: { createdAt: string; id: string } | null = null;
  if (query.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(query.cursor, "base64").toString("utf8"));
    } catch {
      cursor = null;
    }
  }

  const result = await listSubmissions({
    workspaceId: ctx.workspaceId,
    formId: params.id,
    ...(query.status ? { status: query.status } : {}),
    limit: query.limit,
    cursor,
  });
  const nextCursor = result.nextCursor
    ? Buffer.from(JSON.stringify(result.nextCursor)).toString("base64")
    : null;
  return {
    data: result.rows.map(serializeSubmission),
    meta: { nextCursor, hasMore: nextCursor !== null, count: result.rows.length },
  };
}

// ============================================================
// Serializers
// ============================================================

function serializeForm(f: Awaited<ReturnType<typeof listForms>>[number]) {
  return {
    id: f.id,
    name: f.name,
    slug: f.slug,
    description: f.description,
    status: f.status,
    version: f.version,
    submissionsCount: f.submissionsCount,
    spamCount: f.spamCount,
    lastSubmissionAt: f.lastSubmissionAt?.toISOString() ?? null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function serializeSubmission(s: Awaited<ReturnType<typeof listSubmissions>>["rows"][number]) {
  return {
    id: s.id,
    formId: s.formId,
    formVersion: s.formVersion,
    status: s.status,
    spamScore: s.spamScore,
    data: (s.data ?? {}) as Record<string, unknown>,
    country: s.country,
    confirmedAt: s.confirmedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
