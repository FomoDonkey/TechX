import { createRoute } from "@/api/runtime";
import { EmptyResponseSchema, EntryResourceSchema, EntryUpdateSchema } from "@/api/schemas";
import { deleteEntryHandler, getEntryHandler, updateEntryHandler } from "@/api/v1/entries";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string() });

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/entries/{id}",
  tag: "Entries",
  summary: "Obtiene una entrada por id o slug",
  scopes: ["entries:read"],
  params: ParamsSchema,
  query: z.object({ fields: z.string().optional(), locale: z.string().optional() }),
  response: EntryResourceSchema,
  handler: getEntryHandler,
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/entries/{id}",
  tag: "Entries",
  summary: "Actualiza una entrada",
  scopes: ["entries:write"],
  params: ParamsSchema,
  body: EntryUpdateSchema,
  response: EntryResourceSchema,
  handler: updateEntryHandler,
});

export const DELETE = createRoute({
  method: "DELETE",
  path: "/api/v1/entries/{id}",
  tag: "Entries",
  summary: "Elimina una entrada",
  scopes: ["entries:delete"],
  params: ParamsSchema,
  response: EmptyResponseSchema,
  handler: deleteEntryHandler,
});
