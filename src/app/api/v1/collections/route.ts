import { createRoute } from "@/api/runtime";
import { ListCollectionsResponseSchema, listCollectionsHandler } from "@/api/v1/collections";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/collections",
  tag: "Collections",
  summary: "Lista colecciones del workspace",
  scopes: ["collections:read"],
  response: ListCollectionsResponseSchema,
  handler: listCollectionsHandler,
});
