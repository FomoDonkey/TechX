import { createRoute } from "@/api/runtime";
import { CollectionResourceSchema } from "@/api/schemas";
import { getCollectionHandler } from "@/api/v1/collections";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/collections/{slug}",
  tag: "Collections",
  summary: "Obtiene una colección por slug",
  scopes: ["collections:read"],
  params: z.object({ slug: z.string() }),
  response: CollectionResourceSchema,
  handler: getCollectionHandler,
});
