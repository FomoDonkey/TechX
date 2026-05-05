"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import {
  createTier,
  deleteTier,
  getTier,
  grantMembership,
  recordMemberEvent,
  updateTier,
} from "@/payments/memberships";
import {
  archivePrice,
  createPrice,
  createProduct,
  stripeAvailable,
  updateProduct,
} from "@/payments/stripe";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TierBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional().nullable(),
  priceCents: z.coerce.number().int().min(0).max(99_999_999),
  currency: z.string().trim().toLowerCase().length(3).default("eur"),
  interval: z.enum(["month", "year", "lifetime"]).default("month"),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  features: z.array(z.string().trim().max(160)).max(20).default([]),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-100).max(100).default(0),
});

export async function createTierAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = TierBaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const data = parsed.data;
  const tier = await createTier(ctx.workspace.id, {
    ...data,
    isFree: data.priceCents === 0,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "tier.created",
    targetType: "tier",
    targetId: tier.id,
  });
  revalidatePath("/admin/membresias");
  return { ok: true as const, tier };
}

const TierUpdateSchema = TierBaseSchema.partial().extend({ id: z.string().uuid() });

export async function updateTierAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = TierUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const { id, ...patch } = parsed.data;

  const updated = await updateTier(ctx.workspace.id, id, {
    ...patch,
    ...(patch.priceCents !== undefined ? { isFree: patch.priceCents === 0 } : {}),
  });
  if (!updated) return { ok: false as const, error: "not_found" };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "tier.updated",
    targetType: "tier",
    targetId: id,
  });
  revalidatePath("/admin/membresias");
  return { ok: true as const, tier: updated };
}

export async function deleteTierAction(input: { id: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const id = z.string().uuid().safeParse(input.id);
  if (!id.success) return { ok: false as const, error: "invalid_id" };
  const ok = await deleteTier(ctx.workspace.id, id.data);
  if (!ok) return { ok: false as const, error: "not_found" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "tier.deleted",
    targetType: "tier",
    targetId: id.data,
  });
  revalidatePath("/admin/membresias");
  return { ok: true as const };
}

/**
 * Sincroniza un tier con Stripe: crea o actualiza Product, y crea un nuevo
 * Price si cambió (Stripe no permite editar prices). Archiva el antiguo.
 */
export async function syncTierToStripeAction(input: { id: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!stripeAvailable()) return { ok: false as const, error: "stripe_not_configured" };
  const id = z.string().uuid().safeParse(input.id);
  if (!id.success) return { ok: false as const, error: "invalid_id" };

  const tier = await getTier(ctx.workspace.id, id.data);
  if (!tier) return { ok: false as const, error: "not_found" };
  if (tier.isFree || tier.priceCents === 0) {
    return { ok: false as const, error: "free_tier_no_stripe" };
  }

  try {
    let stripeProductId = tier.stripeProductId;
    if (!stripeProductId) {
      const product = await createProduct({
        name: tier.name,
        description: tier.description,
      });
      stripeProductId = product.id;
    } else {
      await updateProduct(stripeProductId, {
        name: tier.name,
        description: tier.description,
        active: tier.isActive,
      });
    }

    let stripePriceId = tier.stripePriceId;
    if (tier.interval === "lifetime") {
      // payment one-shot: precio sin recurring
      const price = await createPrice({
        productId: stripeProductId,
        unitAmount: tier.priceCents,
        currency: tier.currency,
        recurring: null,
      });
      if (stripePriceId && stripePriceId !== price.id) {
        await archivePrice(stripePriceId).catch(() => null);
      }
      stripePriceId = price.id;
    } else {
      // subscription mensual/anual
      const price = await createPrice({
        productId: stripeProductId,
        unitAmount: tier.priceCents,
        currency: tier.currency,
        recurring: { interval: tier.interval },
      });
      if (stripePriceId && stripePriceId !== price.id) {
        await archivePrice(stripePriceId).catch(() => null);
      }
      stripePriceId = price.id;
    }

    const updated = await updateTier(ctx.workspace.id, tier.id, {
      stripeProductId,
      stripePriceId,
    });

    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "tier.synced_stripe",
      targetType: "tier",
      targetId: tier.id,
    });
    revalidatePath("/admin/membresias");
    return { ok: true as const, tier: updated };
  } catch (err) {
    console.error("syncTierToStripe failed", err);
    return {
      ok: false as const,
      error: "stripe_error",
      message: err instanceof Error ? err.message : "unknown",
    };
  }
}

const ManualGrantSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional().nullable(),
  tierId: z.string().uuid().nullable(),
});

export async function grantManualMembershipAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = ManualGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const data = parsed.data;

  const m = await grantMembership({
    workspaceId: ctx.workspace.id,
    email: data.email,
    name: data.name ?? null,
    tierId: data.tierId,
    status: "active",
    source: "manual",
  });
  await recordMemberEvent({
    workspaceId: ctx.workspace.id,
    membershipId: m.id,
    email: m.email,
    type: "membership_created",
    data: { source: "manual", actorId: user.id },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "membership.granted",
    targetType: "membership",
    targetId: m.id,
  });
  revalidatePath("/admin/membresias");
  return { ok: true as const, membership: m };
}

export async function cancelMembershipAction(input: { id: string; immediate?: boolean }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const id = z.string().uuid().safeParse(input.id);
  if (!id.success) return { ok: false as const, error: "invalid_id" };

  const { db } = await import("@/db/client");
  const { memberships } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  if (!db) return { ok: false as const, error: "no_db" };
  const now = new Date();
  const updates: Record<string, unknown> = {
    status: "canceled" as const,
    canceledAt: now,
    cancelAtPeriodEnd: !input.immediate,
    updatedAt: now,
  };
  if (input.immediate) updates.currentPeriodEnd = now;
  await db
    .update(memberships)
    .set(updates)
    .where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.id, id.data)));
  const [updated] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.id, id.data)))
    .limit(1);
  if (!updated) return { ok: false as const, error: "not_found" };

  await recordMemberEvent({
    workspaceId: ctx.workspace.id,
    membershipId: updated.id,
    email: updated.email,
    type: "membership_canceled",
    data: { immediate: !!input.immediate, actorId: user.id },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "membership.canceled",
    targetType: "membership",
    targetId: updated.id,
  });
  revalidatePath("/admin/membresias");
  return { ok: true as const, membership: updated };
}
