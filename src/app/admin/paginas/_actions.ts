"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import {
  createPage,
  deletePage,
  getPageById,
  getPublishedPageByPath,
  updatePage,
} from "@/lib/pages";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { emitAsync } from "@/webhooks/dispatcher";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const blockNodeZ: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.string(),
    props: z.record(z.unknown()).default({}),
    children: z.array(blockNodeZ).optional(),
    hidden: z
      .object({
        mobile: z.boolean().optional(),
        tablet: z.boolean().optional(),
        desktop: z.boolean().optional(),
      })
      .partial()
      .optional(),
  }),
);

export async function createPageFormAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const title = String(formData.get("title") ?? "").trim() || "Nueva página";
  const path = String(formData.get("path") ?? "").trim() || undefined;
  try {
    const created = await createPage({
      workspaceId: ctx.workspace.id,
      authorId: user.id,
      title,
      ...(path ? { path } : {}),
    });
    revalidatePath("/admin/paginas");
    redirect(`/admin/paginas/${created.id}`);
  } catch (err) {
    // Re-lanza redirect/notFound (digest empieza por NEXT_REDIRECT/NEXT_NOT_FOUND)
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String(err.digest).startsWith("NEXT_")
    ) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : "create-failed";
    redirect(`/admin/paginas?error=${encodeURIComponent(msg.slice(0, 80))}`);
  }
}

const SaveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  path: z.string().min(1).max(200).optional(),
  layout: z.array(blockNodeZ).optional(),
  seo: z
    .object({
      title: z.string().max(120).optional(),
      description: z.string().max(280).optional(),
      ogImage: z.string().url().optional(),
    })
    .nullable()
    .optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  isHome: z.boolean().optional(),
});

export async function savePageAction(input: z.input<typeof SaveSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (!isUuid(parsed.data.id)) return { ok: false as const, error: "ID inválido" };
  const existing = await getPageById(ctx.workspace.id, parsed.data.id);
  if (!existing) return { ok: false as const, error: "Página no encontrada" };
  try {
    const updated = await updatePage({
      workspaceId: ctx.workspace.id,
      id: parsed.data.id,
      userId: user.id,
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.path !== undefined ? { path: parsed.data.path } : {}),
      ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout as never } : {}),
      ...(parsed.data.seo !== undefined ? { seo: parsed.data.seo } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.isHome !== undefined ? { isHome: parsed.data.isHome } : {}),
    });
    revalidatePath(`/admin/paginas/${updated.id}`);
    revalidatePath("/admin/paginas");
    // Invalida ISR del catch-all para path nuevo y antiguo (rename) si la página
    // está/estaba publicada. revalidateTag son no-ops sin unstable_cache wraps;
    // confiamos en revalidatePath que sí funciona out-of-the-box con ISR.
    const wasOrIsPublished = updated.status === "published" || existing.status === "published";
    if (wasOrIsPublished) {
      if (updated.path !== existing.path) revalidatePath(existing.path);
      revalidatePath(updated.path);
      // Si la página era o es home, invalidar la raíz (app/page.tsx) también
      if (updated.isHome || existing.isHome) revalidatePath("/");
    }
    // Webhooks de transición de estado
    if (updated.status === "published" && existing.status !== "published") {
      emitAsync({
        workspaceId: ctx.workspace.id,
        event: "page.published",
        payload: {
          id: updated.id,
          path: updated.path,
          title: updated.title,
          isHome: updated.isHome,
        },
      });
    } else if (existing.status === "published" && updated.status !== "published") {
      emitAsync({
        workspaceId: ctx.workspace.id,
        event: "page.unpublished",
        payload: { id: updated.id, path: updated.path, title: updated.title },
      });
    }
    return {
      ok: true as const,
      updatedAt: updated.updatedAt.toISOString(),
      path: updated.path,
      status: updated.status,
      isHome: updated.isHome,
    };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deletePageAction(id: string) {
  const ctx = await requireWorkspace("admin");
  if (!isUuid(id)) return { ok: false as const, error: "ID inválido" };
  // Capturar path/status/isHome ANTES de borrar para poder revalidar ISR público
  const existing = await getPageById(ctx.workspace.id, id);
  await deletePage(ctx.workspace.id, id);
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "page.deleted",
    targetType: "page",
    targetId: id,
    meta: existing ? { path: existing.path, isHome: existing.isHome } : null,
  });
  revalidatePath("/admin/paginas");
  if (existing?.status === "published") {
    revalidatePath(existing.path);
    if (existing.isHome) revalidatePath("/");
  }
  return { ok: true as const };
}

export async function checkPathAvailable(input: {
  pathToCheck: string;
  excludeId?: string;
}): Promise<{ available: boolean }> {
  const ctx = await requireWorkspace("editor");
  const existing = await getPublishedPageByPath(ctx.workspace.id, input.pathToCheck);
  if (existing && existing.id !== input.excludeId) return { available: false };
  return { available: true };
}
