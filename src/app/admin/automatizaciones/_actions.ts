"use server";

import { requireUser } from "@/auth/server";
import { dryRun } from "@/automations/engine";
import {
  createAutomation,
  deleteAutomation,
  getAutomationById,
  rotateAutomationSecret,
  updateAutomation,
} from "@/automations/lib";
import { triggerManual } from "@/automations/listener";
import { getAutomationTemplate } from "@/automations/templates";
import type { Step, Trigger, TriggerType } from "@/automations/types";
import { logActivity } from "@/lib/activity";
import { isValidSlug, slugify } from "@/lib/slug";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TriggerTypeSchema = z.enum(["event", "form_submit", "cron", "webhook_in", "manual"]);

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(48).optional(),
  triggerType: TriggerTypeSchema.default("manual"),
  trigger: z.record(z.unknown()).optional(),
  templateSlug: z.string().optional(),
});

export async function createAutomationAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  const tpl = parsed.data.templateSlug
    ? getAutomationTemplate(parsed.data.templateSlug)
    : undefined;

  const triggerType: TriggerType = tpl?.definition.triggerType ?? parsed.data.triggerType;
  const trigger: Trigger = (tpl?.definition.trigger ??
    parsed.data.trigger ?? { type: triggerType }) as Trigger;
  const slug = parsed.data.slug?.trim() || slugify(parsed.data.name);
  const finalSlug = slug && isValidSlug(slug) ? slug : `auto-${Date.now().toString(36)}`;
  try {
    const created = await createAutomation({
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      slug: finalSlug,
      triggerType,
      trigger,
      conditions: tpl?.definition.conditions ?? null,
      steps: tpl?.definition.steps ?? [],
      createdById: user.id,
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "automation.created",
      targetType: "automation",
      targetId: created.id,
    });
    revalidatePath("/admin/automatizaciones");
    return { ok: true as const, id: created.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/duplicate|unique/i.test(msg)) return { ok: false as const, error: "Slug ya en uso" };
    return { ok: false as const, error: msg };
  }
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(48).optional(),
  description: z.string().max(500).nullable().optional(),
  triggerType: TriggerTypeSchema.optional(),
  trigger: z.record(z.unknown()).optional(),
  conditions: z.record(z.unknown()).nullable().optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  active: z.boolean().optional(),
  debounceMs: z.number().int().min(0).max(60_000).optional(),
});

export async function updateAutomationAction(input: z.input<typeof UpdateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.slug !== undefined) {
    if (!isValidSlug(parsed.data.slug)) return { ok: false as const, error: "Slug inválido" };
    patch.slug = parsed.data.slug;
  }
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.triggerType !== undefined) patch.triggerType = parsed.data.triggerType;
  if (parsed.data.trigger !== undefined) patch.trigger = parsed.data.trigger as unknown as Trigger;
  if (parsed.data.conditions !== undefined)
    patch.conditions = parsed.data.conditions as Parameters<
      typeof updateAutomation
    >[0]["patch"]["conditions"];
  if (parsed.data.steps !== undefined) patch.steps = parsed.data.steps as unknown as Step[];
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  if (parsed.data.debounceMs !== undefined) patch.debounceMs = parsed.data.debounceMs;
  const row = await updateAutomation({
    workspaceId: ctx.workspace.id,
    id: parsed.data.id,
    patch: patch as Parameters<typeof updateAutomation>[0]["patch"],
  });
  if (!row) return { ok: false as const, error: "No encontrada" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "automation.updated",
    targetType: "automation",
    targetId: parsed.data.id,
  });
  revalidatePath("/admin/automatizaciones");
  revalidatePath(`/admin/automatizaciones/${parsed.data.id}`);
  return { ok: true as const };
}

export async function deleteAutomationAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!z.string().uuid().safeParse(id).success) return { ok: false as const, error: "ID inválido" };
  await deleteAutomation(ctx.workspace.id, id);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "automation.deleted",
    targetType: "automation",
    targetId: id,
  });
  revalidatePath("/admin/automatizaciones");
  return { ok: true as const };
}

export async function rotateAutomationSecretAction(id: string) {
  const ctx = await requireWorkspace("admin");
  if (!z.string().uuid().safeParse(id).success) return { ok: false as const, error: "ID inválido" };
  const secret = await rotateAutomationSecret(ctx.workspace.id, id);
  if (!secret) return { ok: false as const, error: "No encontrada" };
  return { ok: true as const, secret };
}

export async function triggerManualAction(input: { id: string; payload?: unknown }) {
  const ctx = await requireWorkspace("editor");
  if (!z.string().uuid().safeParse(input.id).success)
    return { ok: false as const, error: "ID inválido" };
  const runId = await triggerManual({
    workspaceId: ctx.workspace.id,
    automationId: input.id,
    payload: input.payload,
  });
  return { ok: true as const, runId };
}

export async function dryRunAction(input: { id: string; payload?: unknown }) {
  const ctx = await requireWorkspace("editor");
  if (!z.string().uuid().safeParse(input.id).success)
    return { ok: false as const, error: "ID inválido" };
  const auto = await getAutomationById(ctx.workspace.id, input.id);
  if (!auto) return { ok: false as const, error: "No encontrada" };
  const result = await dryRun(
    {
      workspaceId: ctx.workspace.id,
      trigger: auto.trigger as Trigger,
      conditions: (auto.conditions ?? null) as Parameters<typeof dryRun>[0]["conditions"],
      actions: (auto.actions ?? []) as Step[],
    },
    "manual",
    input.payload ?? {},
  );
  return { ok: true as const, result };
}
