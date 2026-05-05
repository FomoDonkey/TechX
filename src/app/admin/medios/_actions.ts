"use server";

import { db } from "@/db/client";
import { media, mediaFolders } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import {
  type UpdateMediaPatch,
  createFolder,
  deleteFolder,
  deleteMedia,
  updateMedia,
} from "@/lib/media";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FolderInput = z.object({
  name: z.string().min(1).max(60),
  parentId: z.string().nullable().optional(),
});

export async function createFolderAction(input: z.infer<typeof FolderInput>) {
  const ctx = await requireWorkspace("editor");
  const parsed = FolderInput.parse(input);
  const parent = parsed.parentId && isUuid(parsed.parentId) ? parsed.parentId : null;
  let folder: Awaited<ReturnType<typeof createFolder>>;
  try {
    folder = await createFolder(ctx.workspace.id, parsed.name, parent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando carpeta";
    return { ok: false as const, error: msg };
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "folder.create",
    targetType: "folder",
    targetId: folder.id,
    meta: { name: folder.name },
  });
  revalidatePath("/admin/medios");
  return { ok: true as const, id: folder.id };
}

export async function deleteFolderAction(id: string) {
  const ctx = await requireWorkspace("editor");
  if (!isUuid(id)) return { ok: false as const, error: "ID inválido" };
  const ok = await deleteFolder(ctx.workspace.id, id);
  if (ok) {
    await logActivity({
      workspaceId: ctx.workspace.id,
      action: "folder.delete",
      targetType: "folder",
      targetId: id,
    });
    revalidatePath("/admin/medios");
  }
  return { ok };
}

export async function deleteMediaAction(ids: string[]) {
  const ctx = await requireWorkspace("editor");
  const n = await deleteMedia(ctx.workspace.id, ids);
  revalidatePath("/admin/medios");
  return { ok: true as const, deleted: n };
}

const PatchInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    alt: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    folderId: z.string().nullable().optional(),
    focalX: z.number().int().min(0).max(100).nullable().optional(),
    focalY: z.number().int().min(0).max(100).nullable().optional(),
    tagsManual: z.array(z.string().min(1).max(40)).max(40).nullable().optional(),
  }),
});

/** Verifica que un folderId pertenece al workspace. Devuelve true si OK,
 * o si folderId es null (root). */
async function folderBelongsToWorkspace(
  workspaceId: string,
  folderId: string | null | undefined,
): Promise<boolean> {
  if (!folderId) return true;
  if (!db) return false;
  if (!isUuid(folderId)) return false;
  const [row] = await db
    .select({ id: mediaFolders.id })
    .from(mediaFolders)
    .where(and(eq(mediaFolders.workspaceId, workspaceId), eq(mediaFolders.id, folderId)))
    .limit(1);
  return !!row;
}

export async function updateMediaAction(input: z.infer<typeof PatchInput>) {
  const ctx = await requireWorkspace("editor");
  const parsed = PatchInput.parse(input);
  // Anti-IDOR cross-tenant: si el patch incluye folderId, verifica que el
  // folder pertenece al workspace del actor (sin esto, editor de wsA podía
  // poner folderId de wsB en un media de wsA → estado inconsistente).
  if (parsed.patch.folderId !== undefined) {
    const ok = await folderBelongsToWorkspace(ctx.workspace.id, parsed.patch.folderId);
    if (!ok) return { ok: false as const, error: "folder_invalid" };
  }
  const next: UpdateMediaPatch = parsed.patch;
  const row = await updateMedia(ctx.workspace.id, parsed.id, next);
  if (!row) return { ok: false as const, error: "No encontrado" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "media.update",
    targetType: "media",
    targetId: row.id,
    meta: parsed.patch as Record<string, unknown>,
  });
  revalidatePath("/admin/medios");
  return { ok: true as const };
}

const MoveInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  folderId: z.string().nullable(),
});

export async function moveMediaAction(input: z.infer<typeof MoveInput>) {
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = MoveInput.parse(input);
  const target = parsed.folderId && isUuid(parsed.folderId) ? parsed.folderId : null;
  // Anti-IDOR cross-tenant: el folder destino debe pertenecer al workspace.
  const ok = await folderBelongsToWorkspace(ctx.workspace.id, target);
  if (!ok) return { ok: false as const, error: "folder_invalid" };
  await db
    .update(media)
    .set({ folderId: target })
    .where(and(eq(media.workspaceId, ctx.workspace.id), inArray(media.id, parsed.ids)));
  revalidatePath("/admin/medios");
  return { ok: true as const, moved: parsed.ids.length };
}
