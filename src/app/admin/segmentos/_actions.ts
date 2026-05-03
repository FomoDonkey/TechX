"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import {
  createSegment,
  deleteSegment,
  previewSegmentSize,
  updateSegment,
} from "@/newsletter/segments-lib";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RuleZ = z.unknown();

export async function createSegmentAction(input: { name: string; rules?: unknown }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!input.name || input.name.length > 120) return { ok: false as const, error: "invalid_name" };
  const result = await createSegment({
    workspaceId: ctx.workspace.id,
    name: input.name,
    rules: input.rules,
  });
  if (!result.ok) return result;
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "segment.created",
    targetType: "segment",
    targetId: result.segment.id,
  });
  revalidatePath("/admin/segmentos");
  return { ok: true as const, segment: result.segment };
}

export async function updateSegmentAction(input: { id: string; name?: string; rules?: unknown }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!input.id) return { ok: false as const, error: "invalid_input" };
  const result = await updateSegment(ctx.workspace.id, input.id, {
    name: input.name,
    rules: input.rules,
  });
  if (!result.ok) return result;
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "segment.updated",
    targetType: "segment",
    targetId: result.segment.id,
  });
  revalidatePath("/admin/segmentos");
  revalidatePath(`/admin/segmentos/${input.id}`);
  return { ok: true as const, segment: result.segment };
}

export async function deleteSegmentAction(input: { id: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const ok = await deleteSegment(ctx.workspace.id, input.id);
  if (!ok) return { ok: false as const, error: "not_found" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "segment.deleted",
    targetType: "segment",
    targetId: input.id,
  });
  revalidatePath("/admin/segmentos");
  return { ok: true as const };
}

export async function previewSegmentAction(input: { rules?: unknown }) {
  const ctx = await requireWorkspace("editor");
  const result = await previewSegmentSize(ctx.workspace.id, (input.rules ?? null) as never);
  return { ok: true as const, ...result };
}
