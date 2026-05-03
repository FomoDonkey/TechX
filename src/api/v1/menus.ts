import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import { getMenuBySlug, listMenus, resolveMenu } from "@/menus/lib";
import type { MenuItem } from "@/menus/types";
import { z } from "zod";

export const MenuResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  location: z.enum(["header", "footer", "sidebar", "custom"]),
  version: z.number().int(),
  isDefault: z.boolean(),
  itemCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MenuDetailSchema = MenuResourceSchema.extend({
  items: z.array(z.unknown()),
});

export const ListMenusResponseSchema = paginatedResponseSchema(MenuResourceSchema);

export async function listMenusHandler({ ctx }: { ctx: ApiContext }) {
  const rows = await listMenus(ctx.workspaceId);
  return {
    data: rows.map(serializeMenuList),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const MenuParams = z.object({ slug: z.string().min(1).max(64) });

export async function getMenuHandler({
  params,
  ctx,
}: { params: { slug: string }; ctx: ApiContext }) {
  const menu = await getMenuBySlug(ctx.workspaceId, params.slug);
  if (!menu) return null;
  const rawItems = (menu.items as unknown as MenuItem[] | null) ?? [];
  const resolved = await resolveMenu(menu.workspaceId, rawItems);
  return {
    id: menu.id,
    name: menu.name,
    slug: menu.slug,
    description: menu.description,
    location: menu.location,
    version: menu.version,
    isDefault: menu.isDefault,
    itemCount: rawItems.length,
    createdAt: menu.createdAt.toISOString(),
    updatedAt: menu.updatedAt.toISOString(),
    items: resolved,
  };
}

function serializeMenuList(m: Awaited<ReturnType<typeof listMenus>>[number]) {
  const items = (m.items as unknown as MenuItem[] | null) ?? [];
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    description: m.description,
    location: m.location,
    version: m.version,
    isDefault: m.isDefault,
    itemCount: items.length,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
