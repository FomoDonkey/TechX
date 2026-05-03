import { ApiError } from "@/api/errors";
import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import {
  bulkUnsubscribe,
  deleteSubscribers,
  getSubscriber,
  listSubscribers,
  subscribe,
  tagSubscribers,
} from "@/newsletter/subscribers";
import { z } from "zod";

export const SubscriberResourceSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  locale: z.string().nullable(),
  status: z.enum(["active", "unsubscribed", "bounced"]),
  tags: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  unsubscribedAt: z.string().nullable(),
  lastOpenAt: z.string().nullable(),
  lastClickAt: z.string().nullable(),
  bounceCount: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListSubscribersQuerySchema = z.object({
  status: z.enum(["active", "unsubscribed", "bounced"]).optional(),
  q: z.string().optional(),
  tag: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .pipe(z.number().int().min(0).max(1_000_000)),
});

export const ListSubscribersResponseSchema = paginatedResponseSchema(SubscriberResourceSchema);

function serialize(
  s: Awaited<ReturnType<typeof getSubscriber>>,
): z.infer<typeof SubscriberResourceSchema> | null {
  if (!s) return null;
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    locale: s.locale,
    status: s.status,
    tags: s.tags,
    source: s.source,
    confirmedAt:
      s.confirmedAt instanceof Date ? s.confirmedAt.toISOString() : (s.confirmedAt ?? null),
    unsubscribedAt:
      s.unsubscribedAt instanceof Date
        ? s.unsubscribedAt.toISOString()
        : (s.unsubscribedAt ?? null),
    lastOpenAt: s.lastOpenAt instanceof Date ? s.lastOpenAt.toISOString() : (s.lastOpenAt ?? null),
    lastClickAt:
      s.lastClickAt instanceof Date ? s.lastClickAt.toISOString() : (s.lastClickAt ?? null),
    bounceCount: s.bounceCount ?? 0,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
  };
}

export async function listSubscribersHandler({
  query,
  ctx,
}: {
  query: z.infer<typeof ListSubscribersQuerySchema>;
  ctx: ApiContext;
}) {
  const result = await listSubscribers({
    workspaceId: ctx.workspaceId,
    status: query.status,
    q: query.q,
    tag: query.tag,
    limit: query.limit,
    offset: query.offset,
    orderBy: "createdAt",
    direction: "desc",
  });
  const data = result.rows.map((r) => serialize(r)!).filter(Boolean);
  const nextOffset = query.offset + result.rows.length;
  return {
    data,
    meta: {
      nextCursor: nextOffset < result.total ? String(nextOffset) : null,
      hasMore: nextOffset < result.total,
      count: result.rows.length,
    },
  };
}

export const SubscriberDetailParams = z.object({ id: z.string().uuid() });

export async function getSubscriberHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const s = await getSubscriber(ctx.workspaceId, params.id);
  if (!s) return null;
  return serialize(s);
}

export const CreateSubscriberSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  locale: z.string().max(8).optional(),
  source: z.string().max(80).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  preConfirmed: z.boolean().optional(),
});

export async function createSubscriberHandler({
  body,
  ctx,
}: {
  body: z.infer<typeof CreateSubscriberSchema>;
  ctx: ApiContext;
}) {
  const result = await subscribe({
    workspaceId: ctx.workspaceId,
    email: body.email,
    name: body.name ?? null,
    locale: body.locale ?? null,
    source: body.source ?? "api",
    tags: body.tags ?? null,
    preConfirmed: body.preConfirmed ?? false,
  });
  if (!result.ok) {
    if (result.error === "invalid_email") {
      throw new ApiError("validation_error", "Email inválido");
    }
    throw new ApiError("internal_error", "No se pudo crear");
  }
  return serialize(result.subscriber);
}

export const UpdateSubscriberSchema = z.object({
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  removeTags: z.array(z.string().min(1).max(64)).max(20).optional(),
});

export async function updateSubscriberHandler({
  params,
  body,
  ctx,
}: {
  params: { id: string };
  body: z.infer<typeof UpdateSubscriberSchema>;
  ctx: ApiContext;
}) {
  if (!body.tags && !body.removeTags) {
    const existing = await getSubscriber(ctx.workspaceId, params.id);
    return existing ? serialize(existing) : null;
  }
  const updated = await tagSubscribers(
    ctx.workspaceId,
    [params.id],
    body.tags ?? [],
    body.removeTags ?? [],
  );
  if (updated === 0) throw new ApiError("not_found", "Subscriber no encontrado");
  const fresh = await getSubscriber(ctx.workspaceId, params.id);
  return serialize(fresh);
}

export async function unsubscribeSubscriberHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const updated = await bulkUnsubscribe(ctx.workspaceId, [params.id]);
  if (updated === 0) throw new ApiError("not_found", "Subscriber no encontrado");
  const fresh = await getSubscriber(ctx.workspaceId, params.id);
  return serialize(fresh);
}

export async function deleteSubscriberHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const deleted = await deleteSubscribers(ctx.workspaceId, [params.id]);
  if (deleted === 0) throw new ApiError("not_found", "Subscriber no encontrado");
  return { ok: true, id: params.id };
}

export const DeleteSubscriberResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string().uuid(),
});
