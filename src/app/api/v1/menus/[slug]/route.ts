import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import { MenuDetailSchema, MenuParams, getMenuHandler } from "@/api/v1/menus";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/menus/{slug}",
  tag: "Menus",
  summary: "Obtiene un menú con items resueltos",
  description: "Devuelve el menú con cada item resuelto a su URL final (page → path, etc.).",
  scopes: ["menus:read"],
  params: MenuParams,
  response: MenuDetailSchema,
  handler: async (i) => {
    const out = await getMenuHandler(i);
    if (!out) throw new ApiError("not_found", "Menú no encontrado");
    return out;
  },
});
