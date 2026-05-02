import { notFound } from "@/api/errors";
import { computeEtag } from "@/api/runtime";
import {
  CommentResourceSchema,
  PaginationQuerySchema,
  paginatedResponseSchema,
} from "@/api/schemas";
import { db } from "@/db/client";
import { comments } from "@/db/schema";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

function serializeComment(row: typeof comments.$inferSelect) {
  return {
    id: row.id,
    entryId: row.entryId,
    parentId: row.parentId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    body: row.body,
    status: row.status,
    aiScore: row.aiScore,
    createdAt: row.createdAt.toISOString(),
  };
}

const ListCommentsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["pending", "approved", "spam"]).optional(),
  entryId: z.string().uuid().optional(),
});

export async function listCommentsHandler(input: {
  query: z.infer<typeof ListCommentsQuerySchema>;
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const filters = [eq(comments.workspaceId, input.ctx.workspaceId)];
  if (input.query.status) filters.push(eq(comments.status, input.query.status));
  if (input.query.entryId) filters.push(eq(comments.entryId, input.query.entryId));
  const rows = await db
    .select()
    .from(comments)
    .where(and(...filters))
    .orderBy(desc(comments.createdAt))
    .limit(input.query.limit);
  return {
    etag: computeEtag(rows.map((r) => [r.id, r.updatedAt.toISOString()])),
    data: {
      data: rows.map(serializeComment),
      meta: { nextCursor: null, hasMore: false, count: rows.length },
    },
  };
}

const PatchCommentSchema = z.object({
  status: z.enum(["pending", "approved", "spam"]),
});

export async function patchCommentHandler(input: {
  params: { id: string };
  body: z.infer<typeof PatchCommentSchema>;
  ctx: { workspaceId: string };
}) {
  if (!db) throw new Error("DB no configurada");
  const [existing] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.workspaceId, input.ctx.workspaceId), eq(comments.id, input.params.id)))
    .limit(1);
  if (!existing) throw notFound(`Comentario ${input.params.id} no existe`);
  // Si el status no cambió, no-op (evita webhook duplicado)
  if (existing.status === input.body.status) return { ok: true as const };
  await db
    .update(comments)
    .set({ status: input.body.status, updatedAt: new Date() })
    .where(and(eq(comments.workspaceId, input.ctx.workspaceId), eq(comments.id, input.params.id)));
  if (input.body.status === "approved") {
    emitAsync({
      workspaceId: input.ctx.workspaceId,
      event: "comment.approved",
      payload: { id: existing.id, entryId: existing.entryId },
    });
  } else if (input.body.status === "spam") {
    emitAsync({
      workspaceId: input.ctx.workspaceId,
      event: "comment.spam",
      payload: { id: existing.id, entryId: existing.entryId },
    });
  }
  return { ok: true as const };
}

export { ListCommentsQuerySchema, PatchCommentSchema };
export const ListCommentsResponseSchema = paginatedResponseSchema(CommentResourceSchema);
