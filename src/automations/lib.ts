/**
 * CRUD para automations y queries del runs log.
 */

import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { deleteReturningCount, insertReturning } from "@/db/dialect";
import {
  type Automation,
  type AutomationRun,
  type AutomationStep,
  automationRuns,
  automationSteps,
  automations,
} from "@/db/schema";
import { isValidSlug, slugify } from "@/lib/slug";
import { and, count, desc, eq } from "drizzle-orm";
import type { ConditionGroup, Step, Trigger, TriggerType } from "./types";

export async function listAutomations(workspaceId: string): Promise<Automation[]> {
  if (!db) return [];
  return db
    .select()
    .from(automations)
    .where(eq(automations.workspaceId, workspaceId))
    .orderBy(desc(automations.updatedAt));
}

export async function getAutomationById(
  workspaceId: string,
  id: string,
): Promise<Automation | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getAutomationBySlug(
  workspaceId: string,
  slug: string,
): Promise<Automation | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.slug, slug)))
    .limit(1);
  return row ?? null;
}

export type CreateAutomationInput = {
  workspaceId: string;
  name: string;
  slug?: string;
  description?: string | null;
  triggerType: TriggerType;
  trigger: Trigger;
  conditions?: ConditionGroup | null;
  steps?: Step[];
  active?: boolean;
  createdById?: string | null;
};

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  if (!db) throw new Error("DB no disponible");
  let slug = input.slug?.trim() || slugify(input.name);
  if (!isValidSlug(slug)) slug = `auto-${randomBytes(3).toString("hex")}`;
  const webhookSecret = input.triggerType === "webhook_in" ? randomBytes(24).toString("hex") : null;
  const id = crypto.randomUUID();
  const row = (await insertReturning(automations, {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    slug,
    description: input.description ?? null,
    triggerType: input.triggerType,
    trigger: input.trigger as never,
    conditions: (input.conditions ?? null) as never,
    actions: (input.steps ?? []) as never,
    active: input.active ?? true,
    webhookSecret,
    createdById: input.createdById ?? null,
  })) as Automation;
  if (!row) throw new Error("No se pudo crear");
  return row;
}

export type UpdateAutomationInput = {
  workspaceId: string;
  id: string;
  patch: Partial<{
    name: string;
    slug: string;
    description: string | null;
    triggerType: TriggerType;
    trigger: Trigger;
    conditions: ConditionGroup | null;
    steps: Step[];
    active: boolean;
    debounceMs: number;
  }>;
};

export async function updateAutomation(input: UpdateAutomationInput): Promise<Automation | null> {
  if (!db) return null;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.patch.name !== undefined) set.name = input.patch.name;
  if (input.patch.slug !== undefined) set.slug = input.patch.slug;
  if (input.patch.description !== undefined) set.description = input.patch.description;
  if (input.patch.triggerType !== undefined) set.triggerType = input.patch.triggerType;
  if (input.patch.trigger !== undefined) set.trigger = input.patch.trigger;
  if (input.patch.conditions !== undefined) set.conditions = input.patch.conditions;
  if (input.patch.steps !== undefined) set.actions = input.patch.steps;
  if (input.patch.active !== undefined) set.active = input.patch.active;
  if (input.patch.debounceMs !== undefined) set.debounceMs = input.patch.debounceMs;
  await db
    .update(automations)
    .set(set)
    .where(and(eq(automations.workspaceId, input.workspaceId), eq(automations.id, input.id)));
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, input.workspaceId), eq(automations.id, input.id)))
    .limit(1);
  return row ?? null;
}

export async function deleteAutomation(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const deleted = await deleteReturningCount(
    automations,
    and(eq(automations.workspaceId, workspaceId), eq(automations.id, id))!,
  );
  return deleted > 0;
}

export async function rotateAutomationSecret(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  if (!db) return null;
  const secret = randomBytes(24).toString("hex");
  await db
    .update(automations)
    .set({ webhookSecret: secret, updatedAt: new Date() })
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.id, id)));
  const [row] = await db
    .select({ webhookSecret: automations.webhookSecret })
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.id, id)))
    .limit(1);
  return row?.webhookSecret ?? null;
}

// ============================================================
// Runs
// ============================================================

export async function listRuns(
  workspaceId: string,
  automationId: string,
  limit = 50,
): Promise<AutomationRun[]> {
  if (!db) return [];
  return db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, workspaceId),
        eq(automationRuns.automationId, automationId),
      ),
    )
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);
}

export async function getRunWithSteps(
  workspaceId: string,
  runId: string,
): Promise<{ run: AutomationRun; steps: AutomationStep[] } | null> {
  if (!db) return null;
  const [run] = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.workspaceId, workspaceId), eq(automationRuns.id, runId)))
    .limit(1);
  if (!run) return null;
  const stepsList = await db
    .select()
    .from(automationSteps)
    .where(eq(automationSteps.runId, runId))
    .orderBy(automationSteps.stepIndex);
  return { run, steps: stepsList };
}

export async function countRunsByAutomation(workspaceId: string): Promise<Record<string, number>> {
  if (!db) return {};
  const rows = await db
    .select({ automationId: automationRuns.automationId, n: count() })
    .from(automationRuns)
    .where(eq(automationRuns.workspaceId, workspaceId))
    .groupBy(automationRuns.automationId);
  return Object.fromEntries(rows.map((r) => [r.automationId, Number(r.n)]));
}
