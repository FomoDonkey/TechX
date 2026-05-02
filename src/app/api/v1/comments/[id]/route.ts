import { createRoute } from "@/api/runtime";
import { EmptyResponseSchema } from "@/api/schemas";
import { PatchCommentSchema, patchCommentHandler } from "@/api/v1/comments";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/comments/{id}",
  tag: "Comments",
  summary: "Modera un comentario (approve/spam/pending)",
  scopes: ["comments:write"],
  params: z.object({ id: z.string().uuid() }),
  body: PatchCommentSchema,
  response: EmptyResponseSchema,
  handler: patchCommentHandler,
});
