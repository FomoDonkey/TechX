"use server";

import { logActivity } from "@/lib/activity";
import {
  createCollection,
  deleteCollection,
  getCollectionById,
  isReservedCollectionSlug,
  updateCollection,
} from "@/lib/collections";
import { collectionSchemaSchema } from "@/lib/fields";
import { isValidSlug, slugify } from "@/lib/slug";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createInputSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().optional(),
  icon: z.string().max(40).optional(),
  description: z.string().max(280).optional(),
  isSingleton: z.boolean().optional(),
});

export async function createCollectionFormAction(formData: FormData) {
  const ctx = await requireWorkspace("editor");
  const parsed = createInputSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    icon: String(formData.get("icon") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    isSingleton: formData.get("isSingleton") === "on",
  });
  if (!parsed.success) {
    redirect("/admin/colecciones?error=invalid");
  }

  const slugBase = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.name);
  if (parsed.data.slug && !isValidSlug(slugBase)) {
    redirect("/admin/colecciones?error=slug");
  }
  if (isReservedCollectionSlug(slugBase)) {
    redirect("/admin/colecciones?error=reserved");
  }

  try {
    const created = await createCollection({
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      slug: slugBase,
      icon: parsed.data.icon ?? "layers",
      description: parsed.data.description,
      isSingleton: parsed.data.isSingleton ?? false,
      schema: { fields: [] },
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      action: "collection.created",
      targetType: "collection",
      targetId: created.id,
      meta: { name: created.name, slug: created.slug },
    });
    revalidatePath("/admin/colecciones");
    redirect(`/admin/colecciones/${created.id}`);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String(err.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    redirect(`/admin/colecciones?error=${encodeURIComponent("create-failed")}`);
  }
}

const updateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(40).nullable().optional(),
  description: z.string().max(280).nullable().optional(),
  isSingleton: z.boolean().optional(),
  schema: collectionSchemaSchema.optional(),
});

export async function updateCollectionAction(input: z.input<typeof updateInputSchema>) {
  const ctx = await requireWorkspace("editor");
  const parsed = updateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }
  if (!isUuid(parsed.data.id)) return { ok: false as const, error: "ID inválido" };

  const existing = await getCollectionById(ctx.workspace.id, parsed.data.id);
  if (!existing) return { ok: false as const, error: "Colección no encontrada" };
  if (
    existing.isBuiltin &&
    parsed.data.isSingleton !== undefined &&
    parsed.data.isSingleton !== existing.isSingleton
  ) {
    return { ok: false as const, error: "No se puede cambiar el tipo de una colección builtin" };
  }

  try {
    const updated = await updateCollection({
      workspaceId: ctx.workspace.id,
      id: parsed.data.id,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.isSingleton !== undefined ? { isSingleton: parsed.data.isSingleton } : {}),
      ...(parsed.data.schema !== undefined ? { schema: parsed.data.schema } : {}),
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      action: "collection.updated",
      targetType: "collection",
      targetId: updated.id,
      meta: { name: updated.name },
    });
    revalidatePath(`/admin/colecciones/${updated.id}`);
    revalidatePath("/admin/colecciones");
    return { ok: true as const, collection: updated };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function deleteCollectionAction(id: string) {
  const ctx = await requireWorkspace("admin");
  if (!isUuid(id)) return { ok: false as const, error: "ID inválido" };
  try {
    await deleteCollection(ctx.workspace.id, id);
    await logActivity({
      workspaceId: ctx.workspace.id,
      action: "collection.deleted",
      targetType: "collection",
      targetId: id,
    });
    revalidatePath("/admin/colecciones");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
