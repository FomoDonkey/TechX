"use server";

import {
  type AiProviderConfigDecrypted,
  type AiProviderId,
  deleteAiProviderConfig,
  listAiProviderConfigs,
  setAiProviderConfig,
} from "@/ai/keys";
import { type AiBudgetConfig, setAiBudget } from "@/ai/usage";
import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const BudgetSchema = z.object({
  monthlyBudgetMicros: z.coerce.number().int().min(0).max(1_000_000_000),
  alertAtPct: z.coerce.number().min(0).max(1),
  hardBlock: z.boolean(),
});

export async function saveAiBudgetAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = BudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await setAiBudget(ctx.workspace.id, parsed.data as AiBudgetConfig);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "settings.ai_budget_changed",
    targetType: "settings",
    targetId: "ai_budget",
    meta: parsed.data as Record<string, unknown>,
  });
  revalidatePath("/admin/ajustes/ia");
  return { ok: true as const };
}

const ProviderSchema = z.object({
  provider: z.enum(["anthropic", "openai", "xai", "openrouter", "ollama", "groq", "mock"]),
});

/**
 * Cambia el proveedor de IA activo del workspace. Solo el id del provider
 * se persiste en BD (`workspaces.aiProvider`). Las API keys quedan en
 * localStorage del editor (ver `providers-form.tsx`).
 */
export async function setAiProviderAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = ProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Provider inválido" };
  }
  if (!db) return { ok: false as const, error: "BD no configurada" };
  await db
    .update(workspaces)
    .set({ aiProvider: parsed.data.provider, updatedAt: new Date() })
    .where(eq(workspaces.id, ctx.workspace.id));
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "settings.ai_provider_changed",
    targetType: "settings",
    targetId: "ai_provider",
    meta: { provider: parsed.data.provider },
  });
  revalidatePath("/admin/ajustes/ia");
  return { ok: true as const };
}

const PROVIDER_ENUM = z.enum(["anthropic", "openai", "xai", "openrouter", "ollama"]);

const SaveKeySchema = z.object({
  provider: PROVIDER_ENUM,
  apiKey: z.string().max(500).optional(), // undefined = no cambiar
  model: z.string().max(120).optional(),
  baseUrl: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Guarda/actualiza la config de un provider para el workspace activo.
 * apiKey === "__clear__" borra solo la key (preserva model/baseUrl).
 * apiKey === undefined no toca la key.
 */
export async function saveAiProviderKeyAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = SaveKeySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (!db) return { ok: false as const, error: "BD no configurada" };

  await setAiProviderConfig(ctx.workspace.id, parsed.data.provider, {
    apiKey: parsed.data.apiKey,
    model: parsed.data.model,
    baseUrl: parsed.data.baseUrl,
    enabled: parsed.data.enabled,
  });

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "settings.ai_key_saved",
    targetType: "settings",
    targetId: `ai_${parsed.data.provider}`,
    meta: {
      provider: parsed.data.provider,
      // NO logamos la apiKey — solo si se actualizó (true/false).
      keyUpdated: parsed.data.apiKey !== undefined,
      model: parsed.data.model,
    },
  });

  revalidatePath("/admin/ajustes/ia");
  return { ok: true as const };
}

const DeleteKeySchema = z.object({ provider: PROVIDER_ENUM });

export async function deleteAiProviderKeyAction(input: unknown) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = DeleteKeySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Provider inválido" };
  }
  await deleteAiProviderConfig(ctx.workspace.id, parsed.data.provider);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "settings.ai_key_deleted",
    targetType: "settings",
    targetId: `ai_${parsed.data.provider}`,
    meta: { provider: parsed.data.provider },
  });
  revalidatePath("/admin/ajustes/ia");
  return { ok: true as const };
}

/**
 * Lee TODAS las configs del workspace (decryptadas). Para hidratar la UI.
 * El client component lo llama via useEffect en lugar de tener form value
 * en localStorage.
 */
export async function listAiProviderConfigsAction(): Promise<{
  ok: true;
  configs: Array<{
    provider: AiProviderId;
    hasKey: boolean;
    keyMasked: string;
    model: string;
    baseUrl: string | null;
  }>;
}> {
  const ctx = await requireWorkspace("admin");
  const all = (await listAiProviderConfigs(ctx.workspace.id)) as AiProviderConfigDecrypted[];
  return {
    ok: true,
    configs: all.map((c) => ({
      provider: c.provider,
      hasKey: c.apiKey.length > 0,
      // Solo enviamos un mask al cliente, NUNCA la key real.
      keyMasked:
        c.apiKey.length === 0
          ? ""
          : `${c.apiKey.slice(0, 4)}…${c.apiKey.slice(-4)}`,
      model: c.model,
      baseUrl: c.baseUrl,
    })),
  };
}
