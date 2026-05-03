import { ApiError } from "@/api/errors";
import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import type { Tier } from "@/db/schema";
import { createTier, deleteTier, getTier, listTiers, updateTier } from "@/payments/memberships";
import { z } from "zod";

export const TierResourceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  currency: z.string(),
  interval: z.enum(["month", "year", "lifetime"]),
  trialDays: z.number().int(),
  features: z.array(z.string()),
  isActive: z.boolean(),
  isFree: z.boolean(),
  sortOrder: z.number().int(),
  stripeProductId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListTiersResponseSchema = paginatedResponseSchema(TierResourceSchema);
export const ListTiersQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
});

function serialize(t: Tier): z.infer<typeof TierResourceSchema> {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    name: t.name,
    slug: t.slug,
    description: t.description,
    priceCents: t.priceCents,
    currency: t.currency,
    interval: t.interval,
    trialDays: t.trialDays,
    features: (t.features ?? []) as string[],
    isActive: t.isActive,
    isFree: t.isFree,
    sortOrder: t.sortOrder,
    stripeProductId: t.stripeProductId,
    stripePriceId: t.stripePriceId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listTiersHandler({
  query,
  ctx,
}: {
  query: z.infer<typeof ListTiersQuerySchema>;
  ctx: ApiContext;
}) {
  const rows = await listTiers(ctx.workspaceId, { onlyActive: query.active === true });
  return {
    data: rows.map(serialize),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const TierParams = z.object({ id: z.string().uuid() });

export async function getTierHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const t = await getTier(ctx.workspaceId, params.id);
  if (!t) throw new ApiError("not_found", "Tier no encontrado");
  return serialize(t);
}

export const CreateTierSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().max(80).optional(),
  description: z.string().max(400).nullable().optional(),
  priceCents: z.number().int().min(0).max(99_999_999).default(0),
  currency: z.string().toLowerCase().length(3).default("eur"),
  interval: z.enum(["month", "year", "lifetime"]).default("month"),
  trialDays: z.number().int().min(0).max(365).default(0),
  features: z.array(z.string().max(160)).max(20).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function createTierHandler({
  body,
  ctx,
}: {
  body: z.infer<typeof CreateTierSchema>;
  ctx: ApiContext;
}) {
  const tier = await createTier(ctx.workspaceId, {
    ...body,
    isFree: body.priceCents === 0,
  });
  return serialize(tier);
}

export const UpdateTierSchema = CreateTierSchema.partial();

export async function updateTierHandler({
  params,
  body,
  ctx,
}: {
  params: { id: string };
  body: z.infer<typeof UpdateTierSchema>;
  ctx: ApiContext;
}) {
  const updated = await updateTier(ctx.workspaceId, params.id, {
    ...body,
    ...(body.priceCents !== undefined ? { isFree: body.priceCents === 0 } : {}),
  });
  if (!updated) throw new ApiError("not_found", "Tier no encontrado");
  return serialize(updated);
}

export async function deleteTierHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const ok = await deleteTier(ctx.workspaceId, params.id);
  if (!ok) throw new ApiError("not_found", "Tier no encontrado");
  return { ok: true, id: params.id };
}

export const DeleteTierResponseSchema = z.object({ ok: z.boolean(), id: z.string().uuid() });
