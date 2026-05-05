"use server";

import { setModerationThresholds } from "@/ai/moderation";
import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ThresholdsSchema = z
  .object({
    spamThreshold: z.coerce.number().int().min(0).max(100),
    pendingThreshold: z.coerce.number().int().min(0).max(100),
  })
  .refine((v) => v.pendingThreshold < v.spamThreshold, {
    message: "El umbral de pending debe ser menor que el de spam",
  });

export async function saveModerationThresholdsAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = ThresholdsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await setModerationThresholds(ctx.workspace.id, parsed.data);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "settings.moderation_thresholds_changed",
    targetType: "settings",
    targetId: "moderation",
    meta: parsed.data,
  });
  revalidatePath("/admin/ajustes/seguridad/moderacion");
  return { ok: true as const };
}
