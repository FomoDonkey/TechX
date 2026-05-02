import { createRoute } from "@/api/runtime";
import { ListTaxonomiesResponseSchema, listTaxonomiesHandler } from "@/api/v1/taxonomies";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/taxonomies",
  tag: "Taxonomies",
  summary: "Lista taxonomías y sus términos",
  scopes: ["taxonomies:read"],
  response: ListTaxonomiesResponseSchema,
  handler: listTaxonomiesHandler,
});
