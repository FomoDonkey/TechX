import { createRoute } from "@/api/runtime";
import {
  ListRedirectsQuerySchema,
  ListRedirectsResponseSchema,
  listRedirectsHandler,
} from "@/api/v1/redirects";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/redirects",
  tag: "Redirects",
  summary: "Lista redirecciones",
  description: "Devuelve las reglas de redirección del workspace con filtros opcionales.",
  scopes: ["redirects:read"],
  query: ListRedirectsQuerySchema,
  response: ListRedirectsResponseSchema,
  handler: listRedirectsHandler,
});
