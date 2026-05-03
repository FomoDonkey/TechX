"use server";

import { getCurrentUser } from "@/auth/server";
import { requireWorkspace } from "@/lib/workspace";
import {
  createMenu,
  deleteMenu,
  ensureUniqueSlug,
  getMenuById,
  slugify,
  updateMenu,
} from "@/menus/lib";
import { MENU_LOCATIONS, type MenuItem, MenuItemsSchema } from "@/menus/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LocationSchema = z.enum(MENU_LOCATIONS as readonly [string, ...string[]]);

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).optional(),
  description: z.string().max(280).optional(),
  location: LocationSchema,
  isDefault: z.boolean().optional(),
});

export async function createMenuAction(input: z.infer<typeof CreateInput>) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  const data = CreateInput.parse(input);
  const baseSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!baseSlug) throw new Error("Slug inválido");
  const finalSlug = await ensureUniqueSlug(ctx.workspace.id, baseSlug);
  const menu = await createMenu({
    workspaceId: ctx.workspace.id,
    name: data.name,
    slug: finalSlug,
    description: data.description,
    location: data.location as never,
    isDefault: data.isDefault,
    createdById: user?.id ?? null,
  });
  revalidatePath("/admin/menus");
  return { id: menu.id };
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(280).optional(),
  location: LocationSchema.optional(),
  items: MenuItemsSchema.optional(),
  isDefault: z.boolean().optional(),
});

export async function updateMenuAction(input: z.infer<typeof UpdateInput>) {
  const ctx = await requireWorkspace("editor");
  const data = UpdateInput.parse(input);
  await updateMenu({
    workspaceId: ctx.workspace.id,
    id: data.id,
    name: data.name,
    description: data.description,
    location: data.location as never,
    items: data.items as MenuItem[] | undefined,
    isDefault: data.isDefault,
  });
  revalidatePath("/admin/menus");
  revalidatePath(`/admin/menus/${data.id}`);
  return { ok: true };
}

export async function deleteMenuAction(id: string) {
  const ctx = await requireWorkspace("admin");
  z.string().uuid().parse(id);
  const existing = await getMenuById(ctx.workspace.id, id);
  if (!existing) throw new Error("Menú no encontrado");
  await deleteMenu(ctx.workspace.id, id);
  revalidatePath("/admin/menus");
  return { ok: true };
}
