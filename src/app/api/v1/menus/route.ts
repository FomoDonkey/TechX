import { createRoute } from "@/api/runtime";
import { ListMenusResponseSchema, listMenusHandler } from "@/api/v1/menus";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/menus",
  tag: "Menus",
  summary: "Lista menús",
  description: "Lista todos los menús del workspace agrupados por ubicación.",
  scopes: ["menus:read"],
  response: ListMenusResponseSchema,
  handler: listMenusHandler,
});
