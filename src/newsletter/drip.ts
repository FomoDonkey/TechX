/**
 * Drip campaigns: secuencias de emails con delays. Triggers soportados:
 *   - subscribe_confirmed   se enrolla al confirmar suscripción
 *   - tag_added             se enrolla al añadir un tag concreto
 *   - manual                admin enrolla a mano
 *
 * Schema de pasos (jsonb en `drips.steps`):
 *   [
 *     { delay: { value: 0,   unit: "minutes" }, subject: "...", bodyHtml: "...", body: tiptap-json },
 *     { delay: { value: 2,   unit: "days"    }, subject: "...", bodyHtml: "..." },
 *     { delay: { value: 1,   unit: "weeks"   }, subject: "...", bodyHtml: "..." },
 *   ]
 *
 * El cron `newsletter-process` busca enrollments con `nextRunAt <= now` y dispara
 * el step correspondiente.
 */

import { db } from "@/db/client";
import {
  type Drip,
  type DripEnrollment,
  type Subscriber,
  dripEnrollments,
  drips,
  subscribers,
} from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";

export const DripStepDelayUnitSchema = z.enum(["minutes", "hours", "days", "weeks"]);
export type DripStepDelayUnit = z.infer<typeof DripStepDelayUnitSchema>;

export const DripStepSchema = z.object({
  delay: z.object({
    value: z.number().int().min(0).max(365),
    unit: DripStepDelayUnitSchema,
  }),
  subject: z.string().min(1).max(200),
  previewText: z.string().max(200).optional(),
  body: z.unknown().optional(),
  bodyHtml: z.string().max(200_000).optional(),
});
export type DripStep = z.infer<typeof DripStepSchema>;

export const DripStepsSchema = z.array(DripStepSchema).min(1).max(20);

export const DripTriggerConfigSchema = z.object({
  tag: z.string().min(1).max(64).optional(),
});
export type DripTriggerConfig = z.infer<typeof DripTriggerConfigSchema>;

const UNIT_MS: Record<DripStepDelayUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

export function delayToMs(delay: DripStep["delay"]): number {
  return delay.value * (UNIT_MS[delay.unit] ?? 0);
}

function parseSteps(raw: unknown): DripStep[] {
  const parsed = DripStepsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}

// ============================================================
// CRUD
// ============================================================

export async function listDrips(workspaceId: string): Promise<Drip[]> {
  if (!db) return [];
  return db.select().from(drips).where(eq(drips.workspaceId, workspaceId));
}

export async function getDrip(workspaceId: string, id: string): Promise<Drip | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(drips)
    .where(and(eq(drips.workspaceId, workspaceId), eq(drips.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createDrip(input: {
  workspaceId: string;
  name: string;
  description?: string;
  triggerType?: "subscribe_confirmed" | "tag_added" | "manual";
  triggerConfig?: DripTriggerConfig;
  steps?: DripStep[];
  createdById?: string;
}): Promise<Drip | null> {
  if (!db) return null;
  const stepsParsed = input.steps ? DripStepsSchema.safeParse(input.steps) : null;
  const steps = stepsParsed?.success ? stepsParsed.data : null;
  const [row] = await db
    .insert(drips)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      triggerType: input.triggerType ?? "subscribe_confirmed",
      triggerConfig: (input.triggerConfig ?? null) as never,
      steps: (steps ?? []) as never,
      status: "draft",
      createdById: input.createdById ?? null,
    })
    .returning();
  return row ?? null;
}

export async function updateDrip(
  workspaceId: string,
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    triggerType: "subscribe_confirmed" | "tag_added" | "manual";
    triggerConfig: DripTriggerConfig | null;
    steps: DripStep[];
    status: "draft" | "active" | "paused";
  }>,
): Promise<Drip | null> {
  if (!db) return null;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.triggerType !== undefined) updates.triggerType = patch.triggerType;
  if (patch.triggerConfig !== undefined) updates.triggerConfig = patch.triggerConfig;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.steps !== undefined) {
    const parsed = DripStepsSchema.safeParse(patch.steps);
    if (parsed.success) updates.steps = parsed.data;
  }
  const [row] = await db
    .update(drips)
    .set(updates)
    .where(and(eq(drips.workspaceId, workspaceId), eq(drips.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteDrip(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const result = await db
    .delete(drips)
    .where(and(eq(drips.workspaceId, workspaceId), eq(drips.id, id)))
    .returning({ id: drips.id });
  return result.length > 0;
}

// ============================================================
// Enrollment
// ============================================================

export async function enrollSubscriber(input: {
  workspaceId: string;
  dripId: string;
  subscriberId: string;
  startDelayMs?: number;
}): Promise<DripEnrollment | null> {
  if (!db) return null;
  const drip = await getDrip(input.workspaceId, input.dripId);
  if (!drip) return null;
  const steps = parseSteps(drip.steps);
  if (steps.length === 0) return null;

  const firstDelay = steps[0]?.delay ? delayToMs(steps[0].delay) : 0;
  const nextRunAt = new Date(Date.now() + (input.startDelayMs ?? 0) + firstDelay);

  // Si ya existe un enrollment activo, no duplicamos.
  const [existing] = await db
    .select()
    .from(dripEnrollments)
    .where(
      and(
        eq(dripEnrollments.dripId, input.dripId),
        eq(dripEnrollments.subscriberId, input.subscriberId),
      ),
    )
    .limit(1);
  if (existing && existing.status === "active") return existing;

  if (existing) {
    // Re-activamos
    const [updated] = await db
      .update(dripEnrollments)
      .set({
        status: "active",
        currentStep: 0,
        nextRunAt,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
      })
      .where(eq(dripEnrollments.id, existing.id))
      .returning();
    return updated ?? null;
  }

  const [row] = await db
    .insert(dripEnrollments)
    .values({
      workspaceId: input.workspaceId,
      dripId: input.dripId,
      subscriberId: input.subscriberId,
      currentStep: 0,
      nextRunAt,
      status: "active",
    })
    .returning();

  if (row) {
    await db
      .update(drips)
      .set({ enrolledTotal: sql`coalesce(${drips.enrolledTotal}, 0) + 1` })
      .where(eq(drips.id, input.dripId));
  }
  return row ?? null;
}

export async function cancelEnrollmentsForSubscriber(
  subscriberId: string,
  reason: string,
): Promise<number> {
  if (!db) return 0;
  const rows = await db
    .update(dripEnrollments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason,
    })
    .where(
      and(eq(dripEnrollments.subscriberId, subscriberId), eq(dripEnrollments.status, "active")),
    )
    .returning({ id: dripEnrollments.id });
  return rows.length;
}

export async function autoEnrollOnConfirm(sub: Subscriber): Promise<void> {
  if (!db) return;
  const eligible = await db
    .select()
    .from(drips)
    .where(
      and(
        eq(drips.workspaceId, sub.workspaceId),
        eq(drips.status, "active"),
        eq(drips.triggerType, "subscribe_confirmed"),
      ),
    );
  for (const d of eligible) {
    await enrollSubscriber({
      workspaceId: sub.workspaceId,
      dripId: d.id,
      subscriberId: sub.id,
    });
  }
}

export async function autoEnrollOnTagAdded(sub: Subscriber, tag: string): Promise<void> {
  if (!db) return;
  const eligible = await db
    .select()
    .from(drips)
    .where(
      and(
        eq(drips.workspaceId, sub.workspaceId),
        eq(drips.status, "active"),
        eq(drips.triggerType, "tag_added"),
      ),
    );
  for (const d of eligible) {
    const cfg = (d.triggerConfig ?? {}) as DripTriggerConfig;
    if (cfg.tag && cfg.tag !== tag) continue;
    await enrollSubscriber({
      workspaceId: sub.workspaceId,
      dripId: d.id,
      subscriberId: sub.id,
    });
  }
}

// ============================================================
// Procesador (cron tick)
// ============================================================

export type DripProcessResult = {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
};

export async function processDripEnrollments(maxBatch = 25): Promise<DripProcessResult> {
  const result: DripProcessResult = { processed: 0, completed: 0, failed: 0, skipped: 0 };
  if (!db) return result;

  // Claim enrollments listos: status=active + nextRunAt <= now
  const due = await db
    .select({
      enrollment: dripEnrollments,
      drip: drips,
      subscriber: subscribers,
    })
    .from(dripEnrollments)
    .innerJoin(drips, eq(drips.id, dripEnrollments.dripId))
    .innerJoin(subscribers, eq(subscribers.id, dripEnrollments.subscriberId))
    .where(
      and(
        eq(dripEnrollments.status, "active"),
        lte(dripEnrollments.nextRunAt, new Date()),
        eq(drips.status, "active"),
      ),
    )
    .limit(maxBatch);

  if (due.length === 0) return result;

  const { sendDripStep } = await import("./dispatcher");

  for (const { enrollment, drip, subscriber } of due) {
    if (subscriber.status !== "active" || !subscriber.confirmedAt) {
      // skip — el subscriber no está activo, cancelamos enrollment
      await db
        .update(dripEnrollments)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "subscriber_inactive" })
        .where(eq(dripEnrollments.id, enrollment.id));
      result.skipped += 1;
      continue;
    }

    const steps = parseSteps(drip.steps);
    const stepIdx = enrollment.currentStep;
    const step = steps[stepIdx];
    if (!step) {
      // sin más pasos → completar
      await db
        .update(dripEnrollments)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(dripEnrollments.id, enrollment.id));
      await db
        .update(drips)
        .set({ completedTotal: sql`coalesce(${drips.completedTotal}, 0) + 1` })
        .where(eq(drips.id, drip.id));
      result.completed += 1;
      continue;
    }

    const sendResult = await sendDripStep({
      workspaceId: drip.workspaceId,
      drip,
      subscriber,
      step,
      stepIndex: stepIdx,
      totalSteps: steps.length,
      enrollmentId: enrollment.id,
    });

    if (!sendResult.ok) {
      result.failed += 1;
      // Opcional: backoff exponencial si transient. Por ahora sólo posponemos 1h.
      const retryAt = new Date(Date.now() + 60 * 60 * 1000);
      await db
        .update(dripEnrollments)
        .set({ nextRunAt: retryAt })
        .where(eq(dripEnrollments.id, enrollment.id));
      continue;
    }

    // Avanzar al siguiente paso
    const nextIdx = stepIdx + 1;
    const nextStep = steps[nextIdx];
    if (!nextStep) {
      await db
        .update(dripEnrollments)
        .set({ status: "completed", completedAt: new Date(), currentStep: nextIdx })
        .where(eq(dripEnrollments.id, enrollment.id));
      await db
        .update(drips)
        .set({ completedTotal: sql`coalesce(${drips.completedTotal}, 0) + 1` })
        .where(eq(drips.id, drip.id));
      result.completed += 1;
    } else {
      const nextRunAt = new Date(Date.now() + delayToMs(nextStep.delay));
      await db
        .update(dripEnrollments)
        .set({ currentStep: nextIdx, nextRunAt })
        .where(eq(dripEnrollments.id, enrollment.id));
      result.processed += 1;
    }
  }

  return result;
}
