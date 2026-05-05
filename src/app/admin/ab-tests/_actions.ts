"use server";

import {
  createAbTestRow,
  deleteAbTestRow,
  getAbTest,
  getAbTestByKey,
  updateAbTestRow,
} from "@/ab/queries";
import type { AbVariant } from "@/ab/types";
import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { pages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Valida que cualquier `pageId` referenciado en el test pertenezca al
 * workspace actual. Sin esto, un editor de wsA podía persistir un test con
 * variant.pageId apuntando a una página de wsB (cross-tenant data leak
 * latente — F0-F9a audit layer 3).
 */
async function ensurePagesBelongToWorkspace(
  workspaceId: string,
  pageIds: Array<string | null | undefined>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!db) return { ok: true };
  const valid = pageIds.filter((p): p is string => typeof p === "string" && p.length > 0);
  if (valid.length === 0) return { ok: true };
  const owned = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), inArray(pages.id, valid)));
  const ownedSet = new Set(owned.map((p) => p.id));
  for (const id of valid) {
    if (!ownedSet.has(id)) return { ok: false, error: "page_not_in_workspace" };
  }
  return { ok: true };
}

const KeyRe = /^[a-z0-9_-]{1,64}$/;
const VariantIdRe = /^[a-z0-9_-]{1,32}$/;

const VariantSchema = z.object({
  id: z.string().regex(VariantIdRe),
  label: z.string().trim().min(1).max(120),
  weight: z.coerce.number().int().min(0).max(100),
  isControl: z.coerce.boolean().default(false),
  pageId: z.string().uuid().nullable().optional(),
});

const GoalSchema = z.object({
  kind: z.enum(["click", "submit", "purchase", "custom"]),
  selector: z.string().max(200).optional(),
  formId: z.string().uuid().optional(),
  eventName: z.string().max(64).optional(),
});

const CreateSchema = z.object({
  key: z.string().regex(KeyRe, "Sólo letras, números, _, -"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  target: z.enum(["block", "page"]).default("block"),
  pageId: z.string().uuid().nullable().optional(),
  variants: z.array(VariantSchema).min(2).max(8),
  goal: GoalSchema.optional().nullable(),
  minSampleSize: z.coerce.number().int().min(10).max(1_000_000).default(100),
});

function validateVariants(variants: AbVariant[]): { ok: true } | { ok: false; error: string } {
  const ids = new Set<string>();
  for (const v of variants) {
    if (ids.has(v.id)) return { ok: false, error: "duplicate_variant_id" };
    ids.add(v.id);
  }
  const total = variants.reduce((s, v) => s + v.weight, 0);
  if (total !== 100) return { ok: false, error: "weights_must_sum_100" };
  const controls = variants.filter((v) => v.isControl).length;
  if (controls !== 1) return { ok: false, error: "exactly_one_control" };
  return { ok: true };
}

export async function createAbTestAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_input", issues: parsed.error.issues };
  }
  const data = parsed.data;
  const validation = validateVariants(data.variants);
  if (!validation.ok) return { ok: false as const, error: validation.error };

  // Cross-tenant: pageId top-level + variants[].pageId deben ser del workspace.
  const pageOwnership = await ensurePagesBelongToWorkspace(ctx.workspace.id, [
    data.pageId,
    ...data.variants.map((v) => v.pageId),
  ]);
  if (!pageOwnership.ok) return { ok: false as const, error: pageOwnership.error };

  const existing = await getAbTestByKey(ctx.workspace.id, data.key);
  if (existing) return { ok: false as const, error: "key_already_exists" };

  const created = await createAbTestRow({
    workspaceId: ctx.workspace.id,
    key: data.key,
    name: data.name,
    description: data.description ?? null,
    target: data.target,
    pageId: data.pageId ?? null,
    variants: data.variants,
    goal: data.goal ?? null,
    minSampleSize: data.minSampleSize,
    createdById: user.id,
  });
  if (!created) return { ok: false as const, error: "create_failed" };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "ab_test.created",
    targetType: "ab_test",
    targetId: created.id,
  });
  revalidatePath("/admin/ab-tests");
  return { ok: true as const, test: { id: created.id, key: created.key } };
}

const UpdateSchema = CreateSchema.partial().extend({
  id: z.string().uuid(),
});

export async function updateAbTestAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const { id, ...patch } = parsed.data;

  const existing = await getAbTest(ctx.workspace.id, id);
  if (!existing) return { ok: false as const, error: "not_found" };

  // Si se está cambiando key, verificar unicidad
  if (patch.key && patch.key !== existing.key) {
    const dup = await getAbTestByKey(ctx.workspace.id, patch.key);
    if (dup) return { ok: false as const, error: "key_already_exists" };
  }

  if (patch.variants) {
    const validation = validateVariants(patch.variants);
    if (!validation.ok) return { ok: false as const, error: validation.error };
  }

  // Cross-tenant: pageId/variants[].pageId del patch deben ser del workspace.
  const pageOwnership = await ensurePagesBelongToWorkspace(ctx.workspace.id, [
    patch.pageId,
    ...(patch.variants?.map((v) => v.pageId) ?? []),
  ]);
  if (!pageOwnership.ok) return { ok: false as const, error: pageOwnership.error };

  // No permitimos cambiar variants si hay assignments persistidos (drift) —
  // lo bloqueamos solo si el test está running. Draft sí permite.
  if (existing.status === "running" && patch.variants) {
    // Permitir cambio sólo si los IDs son los mismos (cambia label/weight)
    const oldIds = new Set(existing.variants.map((v) => v.id));
    const newIds = new Set(patch.variants.map((v) => v.id));
    if (oldIds.size !== newIds.size || ![...oldIds].every((i) => newIds.has(i))) {
      return { ok: false as const, error: "cannot_change_variant_ids_while_running" };
    }
  }

  const updated = await updateAbTestRow(ctx.workspace.id, id, patch);
  if (!updated) return { ok: false as const, error: "update_failed" };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "ab_test.updated",
    targetType: "ab_test",
    targetId: id,
  });
  revalidatePath("/admin/ab-tests");
  revalidatePath(`/admin/ab-tests/${id}`);
  return { ok: true as const };
}

export async function deleteAbTestAction(input: { id: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const idP = z.string().uuid().safeParse(input.id);
  if (!idP.success) return { ok: false as const, error: "invalid_id" };
  const ok = await deleteAbTestRow(ctx.workspace.id, idP.data);
  if (!ok) return { ok: false as const, error: "not_found" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "ab_test.deleted",
    targetType: "ab_test",
    targetId: idP.data,
  });
  revalidatePath("/admin/ab-tests");
  return { ok: true as const };
}

const StatusActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["start", "pause", "resume", "complete"]),
  winnerVariantId: z.string().regex(VariantIdRe).optional(),
});

export async function setAbTestStatusAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = StatusActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const { id, action, winnerVariantId } = parsed.data;

  const test = await getAbTest(ctx.workspace.id, id);
  if (!test) return { ok: false as const, error: "not_found" };

  if (test.variants.length < 2) return { ok: false as const, error: "needs_two_variants" };
  const totalWeight = test.variants.reduce((s, v) => s + v.weight, 0);
  if (totalWeight !== 100) return { ok: false as const, error: "weights_must_sum_100" };

  // State machine: transiciones permitidas
  //   draft     → start
  //   running   → pause | complete
  //   paused    → resume | complete
  //   completed → (terminal — sólo borrar)
  // Cualquier otra combinación devuelve `invalid_transition` para evitar
  // que un editor reabra un test cerrado y mezcle stats viejas con nuevas.
  type Tr = "start" | "pause" | "resume" | "complete";
  const allowed: Record<typeof test.status, Tr[]> = {
    draft: ["start"],
    running: ["pause", "complete"],
    paused: ["resume", "complete"],
    completed: [],
  };
  if (!allowed[test.status].includes(action)) {
    // start sobre running es no-op idempotente
    if (action === "start" && test.status === "running") return { ok: true as const };
    return {
      ok: false as const,
      error: "invalid_transition",
    };
  }

  let next: ReturnType<typeof updateAbTestRow>;
  if (action === "start") {
    next = updateAbTestRow(ctx.workspace.id, id, {
      status: "running",
      startedAt: test.startedAt ?? new Date(),
      endedAt: null,
      winnerVariantId: null,
    });
  } else if (action === "pause") {
    next = updateAbTestRow(ctx.workspace.id, id, { status: "paused" });
  } else if (action === "resume") {
    next = updateAbTestRow(ctx.workspace.id, id, { status: "running" });
  } else {
    // complete
    if (winnerVariantId && !test.variants.some((v) => v.id === winnerVariantId)) {
      return { ok: false as const, error: "winner_not_found" };
    }
    next = updateAbTestRow(ctx.workspace.id, id, {
      status: "completed",
      endedAt: new Date(),
      winnerVariantId: winnerVariantId ?? null,
    });
  }
  await next;
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: `ab_test.${action}`,
    targetType: "ab_test",
    targetId: id,
  });
  revalidatePath("/admin/ab-tests");
  revalidatePath(`/admin/ab-tests/${id}`);
  return { ok: true as const };
}
