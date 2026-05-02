import { createRoute } from "@/api/runtime";
import { ListPagesQuerySchema, ListPagesResponseSchema, listPagesHandler } from "@/api/v1/pages";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/pages",
  tag: "Pages",
  summary: "Lista páginas del builder",
  scopes: ["pages:read"],
  query: ListPagesQuerySchema,
  response: ListPagesResponseSchema,
  handler: listPagesHandler,
});
