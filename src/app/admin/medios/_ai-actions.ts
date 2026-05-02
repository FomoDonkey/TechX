"use server";

import { type GeneratedImage, generateAltText, generateImage, generateTags } from "@/ai/vision";
import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { ingestUpload } from "@/lib/media";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function loadAsset(workspaceId: string, id: string) {
  if (!db) return null;
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function regenerateAltAction(id: string) {
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const asset = await loadAsset(ctx.workspace.id, id);
  if (!asset) return { ok: false as const, error: "No encontrado" };
  const alt = await generateAltText({
    url: asset.url,
    filename: asset.filename,
    dominantColor: asset.dominantColor,
    width: asset.width,
    height: asset.height,
    mime: asset.mime,
  });
  await db
    .update(media)
    .set({ alt })
    .where(and(eq(media.id, id), eq(media.workspaceId, ctx.workspace.id)));
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "media.alt.regenerate",
    targetType: "media",
    targetId: id,
    meta: { alt },
  });
  revalidatePath("/admin/medios");
  return { ok: true as const, alt };
}

export async function regenerateTagsAction(id: string) {
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const asset = await loadAsset(ctx.workspace.id, id);
  if (!asset) return { ok: false as const, error: "No encontrado" };
  const tags = await generateTags({
    url: asset.url,
    filename: asset.filename,
    dominantColor: asset.dominantColor,
    width: asset.width,
    height: asset.height,
    mime: asset.mime,
  });
  await db
    .update(media)
    .set({ aiTags: tags })
    .where(and(eq(media.id, id), eq(media.workspaceId, ctx.workspace.id)));
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "media.tags.regenerate",
    targetType: "media",
    targetId: id,
    meta: { tags },
  });
  revalidatePath("/admin/medios");
  return { ok: true as const, tags };
}

const GenerateInput = z.object({
  prompt: z.string().min(3).max(500),
  ratio: z.enum(["1:1", "16:9", "9:16", "4:3"]).default("1:1"),
});

export async function generateImageAction(input: z.infer<typeof GenerateInput>) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  const parsed = GenerateInput.parse(input);

  let img: GeneratedImage;
  try {
    img = await generateImage({ prompt: parsed.prompt, ratio: parsed.ratio });
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error generando" };
  }

  const row = await ingestUpload({
    workspaceId: ctx.workspace.id,
    uploadedById: user?.id ?? null,
    folderId: null,
    filename: img.filename,
    mime: img.mime,
    buffer: img.buffer,
  });

  // Marcar el alt con el prompt como punto de partida.
  if (db) {
    await db
      .update(media)
      .set({ alt: parsed.prompt.slice(0, 200) })
      .where(and(eq(media.id, row.id), eq(media.workspaceId, ctx.workspace.id)));
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user?.id ?? null,
    action: "media.generate",
    targetType: "media",
    targetId: row.id,
    meta: { prompt: parsed.prompt, source: img.source },
  });

  revalidatePath("/admin/medios");
  return { ok: true as const, id: row.id };
}
