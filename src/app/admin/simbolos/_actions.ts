"use server";

import { logActivity } from "@/lib/activity";
import { createSymbol, deleteSymbol, getSymbolById, updateSymbol } from "@/lib/symbols";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const blockNodeZ: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.string(),
    props: z.record(z.unknown()).default({}),
    children: z.array(blockNodeZ).optional(),
  }),
);

export async function createSymbolFormAction(formData: FormData): Promise<void> {
  const ctx = await requireWorkspace("editor");
  const name = String(formData.get("name") ?? "").trim() || "Nuevo símbolo";
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const created = await createSymbol({
    workspaceId: ctx.workspace.id,
    name,
    description,
    layout: [],
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    action: "symbol.created",
    targetType: "symbol",
    targetId: created.id,
    meta: { name },
  });
  revalidatePath("/admin/simbolos");
  redirect(`/admin/simbolos/${created.id}`);
}

const SaveSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(280).nullable().optional(),
  layout: z.array(blockNodeZ).optional(),
});

export async function saveSymbolAction(input: z.input<typeof SaveSchema>) {
  const ctx = await requireWorkspace("editor");
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (!isUuid(parsed.data.id)) return { ok: false as const, error: "ID inválido" };
  const existing = await getSymbolById(ctx.workspace.id, parsed.data.id);
  if (!existing) return { ok: false as const, error: "Símbolo no encontrado" };
  try {
    const updated = await updateSymbol({
      workspaceId: ctx.workspace.id,
      id: parsed.data.id,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout as never } : {}),
    });
    revalidatePath(`/admin/simbolos/${updated.id}`);
    revalidatePath("/admin/simbolos");
    // Cualquier página que use el símbolo verá el cambio en su next ISR fetch
    revalidatePath("/", "layout");
    return { ok: true as const, updatedAt: updated.updatedAt.toISOString() };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteSymbolAction(id: string) {
  const ctx = await requireWorkspace("admin");
  if (!isUuid(id)) return { ok: false as const, error: "ID inválido" };
  await deleteSymbol(ctx.workspace.id, id);
  revalidatePath("/admin/simbolos");
  return { ok: true as const };
}
