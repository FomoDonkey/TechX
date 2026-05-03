import { ApiError } from "@/api/errors";
import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import type { Segment } from "@/db/schema";
import {
  createSegment,
  deleteSegment,
  getSegment,
  listSegments,
  previewSegmentSize,
  updateSegment,
} from "@/newsletter/segments-lib";
import { z } from "zod";

export const SegmentResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rules: z.unknown().nullable(),
});

export const ListSegmentsResponseSchema = paginatedResponseSchema(SegmentResourceSchema);

function serialize(s: Segment | null): z.infer<typeof SegmentResourceSchema> | null {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    rules: (s.rules ?? null) as unknown,
  };
}

export async function listSegmentsHandler({ ctx }: { ctx: ApiContext }) {
  const rows = await listSegments(ctx.workspaceId);
  return {
    data: rows.map((r) => serialize(r)!),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const SegmentDetailParams = z.object({ id: z.string().uuid() });

export async function getSegmentHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const s = await getSegment(ctx.workspaceId, params.id);
  if (!s) return null;
  return serialize(s);
}

export const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(120),
  rules: z.unknown().optional(),
});

export async function createSegmentHandler({
  body,
  ctx,
}: {
  body: z.infer<typeof CreateSegmentSchema>;
  ctx: ApiContext;
}) {
  const result = await createSegment({
    workspaceId: ctx.workspaceId,
    name: body.name,
    rules: body.rules,
  });
  if (!result.ok) throw new ApiError("validation_error", result.error);
  return serialize(result.segment);
}

export const UpdateSegmentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  rules: z.unknown().optional(),
});

export async function updateSegmentHandler({
  params,
  body,
  ctx,
}: {
  params: { id: string };
  body: z.infer<typeof UpdateSegmentSchema>;
  ctx: ApiContext;
}) {
  const result = await updateSegment(ctx.workspaceId, params.id, body);
  if (!result.ok) {
    if (result.error === "not_found") throw new ApiError("not_found", "Segmento no encontrado");
    throw new ApiError("validation_error", result.error);
  }
  return serialize(result.segment);
}

export async function deleteSegmentHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const ok = await deleteSegment(ctx.workspaceId, params.id);
  if (!ok) throw new ApiError("not_found", "Segmento no encontrado");
  return { ok: true, id: params.id };
}

export const SegmentPreviewSchema = z.object({
  matched: z.number().int(),
  total: z.number().int(),
});

export async function previewSegmentHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const seg = await getSegment(ctx.workspaceId, params.id);
  if (!seg) throw new ApiError("not_found", "Segmento no encontrado");
  const result = await previewSegmentSize(ctx.workspaceId, seg.rules as never);
  return { matched: result.matched, total: result.total };
}

export const DeleteSegmentResponseSchema = z.object({ ok: z.boolean(), id: z.string().uuid() });
