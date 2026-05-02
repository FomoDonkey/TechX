import { createRoute } from "@/api/runtime";
import { ListMediaQuerySchema, ListMediaResponseSchema, listMediaHandler } from "@/api/v1/media";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/media",
  tag: "Media",
  summary: "Lista assets de la biblioteca de medios",
  scopes: ["media:read"],
  query: ListMediaQuerySchema,
  response: ListMediaResponseSchema,
  handler: listMediaHandler,
});
