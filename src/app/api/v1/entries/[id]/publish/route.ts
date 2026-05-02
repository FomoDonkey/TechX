import { createRoute } from "@/api/runtime";
import { publishEntryHandler } from "@/api/v1/entries";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/entries/{id}/publish",
  tag: "Entries",
  summary: "Publica una entrada",
  description: "Cambia el status a 'published' y dispara los webhooks correspondientes.",
  scopes: ["entries:write"],
  params: z.object({ id: z.string() }),
  response: z.object({
    ok: z.literal(true),
    published: z.number(),
    alreadyPublished: z.boolean().optional(),
  }),
  handler: publishEntryHandler,
});
