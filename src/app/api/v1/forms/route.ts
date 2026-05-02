import { createRoute } from "@/api/runtime";
import { ListFormsQuerySchema, ListFormsResponseSchema, listFormsHandler } from "@/api/v1/forms";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/forms",
  tag: "Forms",
  summary: "Lista formularios",
  description: "Lista los formularios del workspace. Filtros opcionales por status y q.",
  scopes: ["forms:read"],
  query: ListFormsQuerySchema,
  response: ListFormsResponseSchema,
  handler: listFormsHandler,
});
