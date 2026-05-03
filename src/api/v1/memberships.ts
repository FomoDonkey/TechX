import { ApiError } from "@/api/errors";
import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import type { Membership } from "@/db/schema";
import {
  getMembershipByEmail,
  grantMembership,
  isMembershipActive,
  listMemberships,
  recordMemberEvent,
} from "@/payments/memberships";
import { z } from "zod";

export const MembershipResourceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  tierId: z.string().uuid().nullable(),
  status: z.enum(["incomplete", "trialing", "active", "past_due", "canceled", "unpaid", "paused"]),
  isActive: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable(),
  trialEnd: z.string().nullable(),
  source: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListMembershipsResponseSchema = paginatedResponseSchema(MembershipResourceSchema);
export const ListMembershipsQuerySchema = z.object({
  status: z
    .enum(["incomplete", "trialing", "active", "past_due", "canceled", "unpaid", "paused"])
    .optional(),
  tierId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function serialize(m: Membership): z.infer<typeof MembershipResourceSchema> {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    email: m.email,
    name: m.name,
    tierId: m.tierId,
    status: m.status,
    isActive: isMembershipActive(m),
    stripeCustomerId: m.stripeCustomerId,
    stripeSubscriptionId: m.stripeSubscriptionId,
    currentPeriodStart: m.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: m.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: m.cancelAtPeriodEnd,
    canceledAt: m.canceledAt?.toISOString() ?? null,
    trialEnd: m.trialEnd?.toISOString() ?? null,
    source: m.source,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function listMembershipsHandler({
  query,
  ctx,
}: {
  query: z.infer<typeof ListMembershipsQuerySchema>;
  ctx: ApiContext;
}) {
  const { rows, total } = await listMemberships(ctx.workspaceId, {
    ...(query.status ? { status: query.status } : {}),
    ...(query.tierId ? { tierId: query.tierId } : {}),
    limit: query.limit,
    offset: query.offset,
  });
  const hasMore = query.offset + rows.length < total;
  return {
    data: rows.map(serialize),
    meta: {
      nextCursor: hasMore ? String(query.offset + rows.length) : null,
      hasMore,
      count: total,
    },
  };
}

export const MembershipParams = z.object({ id: z.string().uuid() });

export async function getMembershipHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const { db } = await import("@/db/client");
  const { memberships } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  if (!db) throw new ApiError("service_unavailable", "DB no disponible");
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, ctx.workspaceId), eq(memberships.id, params.id)))
    .limit(1);
  if (!row) throw new ApiError("not_found", "Membresía no encontrada");
  return serialize(row);
}

export const CreateMembershipSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).nullable().optional(),
  tierId: z.string().uuid().nullable(),
  status: z
    .enum(["incomplete", "trialing", "active", "past_due", "canceled", "unpaid", "paused"])
    .default("active"),
  source: z.string().max(40).default("api"),
});

export async function createMembershipHandler({
  body,
  ctx,
}: {
  body: z.infer<typeof CreateMembershipSchema>;
  ctx: ApiContext;
}) {
  const m = await grantMembership({
    workspaceId: ctx.workspaceId,
    email: body.email,
    name: body.name ?? null,
    tierId: body.tierId,
    status: body.status,
    source: body.source,
  });
  await recordMemberEvent({
    workspaceId: ctx.workspaceId,
    membershipId: m.id,
    email: m.email,
    type: "membership_created",
    data: { source: body.source, via: "api" },
  });
  return serialize(m);
}

export const UpdateMembershipSchema = z.object({
  tierId: z.string().uuid().nullable().optional(),
  status: z
    .enum(["incomplete", "trialing", "active", "past_due", "canceled", "unpaid", "paused"])
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

export async function updateMembershipHandler({
  params,
  body,
  ctx,
}: {
  params: { id: string };
  body: z.infer<typeof UpdateMembershipSchema>;
  ctx: ApiContext;
}) {
  const { db } = await import("@/db/client");
  const { memberships } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  if (!db) throw new ApiError("service_unavailable", "DB no disponible");

  // Cargar primero la fila para validar que NO toquemos membresías Stripe-bound:
  // un PATCH local quedaría sobreescrito en el siguiente webhook. Mejor 409.
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, ctx.workspaceId), eq(memberships.id, params.id)))
    .limit(1);
  if (!existing) throw new ApiError("not_found", "Membresía no encontrada");
  if (existing.stripeSubscriptionId) {
    throw new ApiError(
      "conflict",
      "Esta membresía está vinculada a una suscripción de Stripe. Modifícala desde el Stripe Billing Portal o el dashboard de Stripe.",
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.tierId !== undefined) updates.tierId = body.tierId;
  if (body.status !== undefined) updates.status = body.status;
  if (body.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = body.cancelAtPeriodEnd;

  const [row] = await db
    .update(memberships)
    .set(updates)
    .where(and(eq(memberships.workspaceId, ctx.workspaceId), eq(memberships.id, params.id)))
    .returning();
  if (!row) throw new ApiError("not_found", "Membresía no encontrada");

  await recordMemberEvent({
    workspaceId: ctx.workspaceId,
    membershipId: row.id,
    email: row.email,
    type:
      body.status === "canceled"
        ? "membership_canceled"
        : body.tierId !== undefined
          ? "tier_changed"
          : "membership_updated",
    data: { via: "api", patch: body },
  });
  return serialize(row);
}

// Helper export used by routes
export { getMembershipByEmail };
