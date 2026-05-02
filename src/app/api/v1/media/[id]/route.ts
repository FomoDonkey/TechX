import { createRoute } from "@/api/runtime";
import { MediaResourceSchema } from "@/api/schemas";
import { getMediaHandler } from "@/api/v1/media";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/media/{id}",
  tag: "Media",
  summary: "Obtiene un asset por id",
  scopes: ["media:read"],
  params: z.object({ id: z.string().uuid() }),
  response: MediaResourceSchema,
  handler: getMediaHandler,
});
