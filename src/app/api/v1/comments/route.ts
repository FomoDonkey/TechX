import { createRoute } from "@/api/runtime";
import {
  ListCommentsQuerySchema,
  ListCommentsResponseSchema,
  listCommentsHandler,
} from "@/api/v1/comments";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/comments",
  tag: "Comments",
  summary: "Lista comentarios del workspace",
  scopes: ["comments:read"],
  query: ListCommentsQuerySchema,
  response: ListCommentsResponseSchema,
  handler: listCommentsHandler,
});
