"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { httpUrlSchema } from "@/lib/safe-url";
import { requireWorkspace } from "@/lib/workspace";
import { replayDelivery, testWebhook } from "@/webhooks/dispatcher";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/webhooks/events";
import { createWebhook, deleteWebhook, rotateWebhookSecret, updateWebhook } from "@/webhooks/lib";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const EventArraySchema = z
  .array(z.string())
  .refine(
    (arr) =>
      arr.includes("*") || arr.every((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)),
    "Algunos eventos no son válidos",
  );

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  url: httpUrlSchema(),
  events: EventArraySchema,
  maxAttempts: z.number().int().min(1).max(10).default(5),
  active: z.boolean().default(true),
});

export async function createWebhookAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const created = await createWebhook({
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      url: parsed.data.url,
      events: parsed.data.events as WebhookEvent[] | ["*"],
      maxAttempts: parsed.data.maxAttempts,
      active: parsed.data.active,
      createdById: user.id,
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "webhook.created",
      targetType: "webhook",
      targetId: created.id,
    });
    revalidatePath("/admin/webhooks");
    return { ok: true as const, ...created };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  url: httpUrlSchema().optional(),
  events: EventArraySchema.optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  active: z.boolean().optional(),
});

export async function updateWebhookAction(input: z.input<typeof UpdateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await updateWebhook({
      workspaceId: ctx.workspace.id,
      id: parsed.data.id,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.url !== undefined ? { url: parsed.data.url } : {}),
      ...(parsed.data.events !== undefined
        ? { events: parsed.data.events as WebhookEvent[] | ["*"] }
        : {}),
      ...(parsed.data.maxAttempts !== undefined ? { maxAttempts: parsed.data.maxAttempts } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "webhook.updated",
      targetType: "webhook",
      targetId: parsed.data.id,
    });
    revalidatePath("/admin/webhooks");
    revalidatePath(`/admin/webhooks/${parsed.data.id}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteWebhookAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  try {
    await deleteWebhook(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "webhook.deleted",
      targetType: "webhook",
      targetId: id,
    });
    revalidatePath("/admin/webhooks");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function rotateSecretAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  try {
    const newSecret = await rotateWebhookSecret(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "webhook.secret_rotated",
      targetType: "webhook",
      targetId: id,
    });
    revalidatePath(`/admin/webhooks/${id}`);
    return { ok: true as const, secret: newSecret };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

const TestSchema = z.object({
  id: z.string().uuid(),
  event: z.enum(WEBHOOK_EVENTS),
  payload: z.record(z.unknown()).optional(),
});

export async function testWebhookAction(input: z.input<typeof TestSchema>) {
  const ctx = await requireWorkspace("admin");
  const parsed = TestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  // Carga el secret + url de la DB, no del cliente (seguridad)
  const { getWebhookById } = await import("@/webhooks/lib");
  const wh = await getWebhookById(ctx.workspace.id, parsed.data.id);
  if (!wh) return { ok: false as const, error: "Webhook no encontrado" };
  const result = await testWebhook({
    url: wh.url,
    secret: wh.secret,
    event: parsed.data.event,
    ...(parsed.data.payload !== undefined ? { payload: parsed.data.payload } : {}),
  });
  return { ok: true as const, result };
}

export async function replayDeliveryAction(deliveryId: string) {
  const ctx = await requireWorkspace("admin");
  if (!z.string().uuid().safeParse(deliveryId).success) {
    return { ok: false as const, error: "ID inválido" };
  }
  await replayDelivery(ctx.workspace.id, deliveryId);
  revalidatePath("/admin/webhooks");
  return { ok: true as const };
}
