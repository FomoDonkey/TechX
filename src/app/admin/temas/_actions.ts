"use server";

import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { DEFAULT_THEME_SLUG } from "@/themes/builtins";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

const applySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
});

export async function applyThemeAction(
  input: z.infer<typeof applySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tema no válido" };
  const { slug } = parsed.data;
  if (!db) return { ok: false, error: "Base de datos no configurada" };
  await db
    .update(workspaces)
    .set({ activeThemeSlug: slug, updatedAt: new Date() })
    .where(eq(workspaces.id, ctx.workspace.id));
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "theme.apply",
    targetType: "theme",
    targetId: slug,
    meta: { slug },
  });
  revalidateTag(`workspace:${ctx.workspace.id}:theme`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/temas");
  return { ok: true };
}

export async function resetActiveThemeAction(): Promise<{ ok: true }> {
  await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!db) return { ok: true };
  await db
    .update(workspaces)
    .set({ activeThemeSlug: DEFAULT_THEME_SLUG, updatedAt: new Date() })
    .where(eq(workspaces.id, ctx.workspace.id));
  revalidatePath("/", "layout");
  revalidatePath("/admin/temas");
  return { ok: true };
}
