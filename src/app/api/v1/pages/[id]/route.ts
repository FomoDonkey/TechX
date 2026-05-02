import { createRoute } from "@/api/runtime";
import { PageResourceSchema } from "@/api/schemas";
import { getPageHandler } from "@/api/v1/pages";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/pages/{id}",
  tag: "Pages",
  summary: "Obtiene una página por id",
  scopes: ["pages:read"],
  params: z.object({ id: z.string().uuid() }),
  response: PageResourceSchema,
  handler: getPageHandler,
});
