"use server";

import {
  createApiKey,
  deleteApiKey,
  invalidateKeyCache,
  revokeApiKey,
  rotateApiKey,
} from "@/api/keys";
import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SCOPE_REGEX = /^([a-z]+|\*):([a-z]+|\*)$|^\*$/;

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  scopes: z.array(z.string().regex(SCOPE_REGEX)).min(1).max(50),
  rateLimit: z.number().int().min(1).max(100_000).default(1000),
  environment: z.enum(["live", "test"]).default("live"),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function createKeyAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const created = await createApiKey({
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      scopes: parsed.data.scopes,
      rateLimit: parsed.data.rateLimit,
      environment: parsed.data.environment,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: user.id,
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "apikey.created",
      targetType: "api_key",
      targetId: created.id,
      meta: { name: parsed.data.name, environment: parsed.data.environment },
    });
    revalidatePath("/admin/api-keys");
    return { ok: true as const, ...created };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function rotateKeyAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  try {
    const rotated = await rotateApiKey(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "apikey.rotated",
      targetType: "api_key",
      targetId: id,
    });
    revalidatePath("/admin/api-keys");
    return { ok: true as const, ...rotated };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function revokeKeyAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  try {
    await revokeApiKey(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "apikey.revoked",
      targetType: "api_key",
      targetId: id,
    });
    invalidateKeyCache();
    revalidatePath("/admin/api-keys");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteKeyAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  try {
    await deleteApiKey(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "apikey.deleted",
      targetType: "api_key",
      targetId: id,
    });
    revalidatePath("/admin/api-keys");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
