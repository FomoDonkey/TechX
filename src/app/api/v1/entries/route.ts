import { createRoute } from "@/api/runtime";
import { EntryCreateSchema, EntryResourceSchema } from "@/api/schemas";
import {
  ListEntriesQuerySchema,
  ListEntriesResponseSchema,
  createEntryHandler,
  listEntriesHandler,
} from "@/api/v1/entries";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/entries",
  tag: "Entries",
  summary: "Lista entradas",
  description:
    "Lista entradas del workspace asociado a la API key. Soporta paginación cursor (`?cursor=`), filtros (`?where[field][op]=value`), orden (`?sort=-publishedAt,title`), selección de campos (`?fields=title,slug`) y query libre (`?q=`).",
  scopes: ["entries:read"],
  query: ListEntriesQuerySchema,
  response: ListEntriesResponseSchema,
  handler: listEntriesHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/entries",
  tag: "Entries",
  summary: "Crea una entrada",
  description: "Crea una nueva entrada en la colección especificada (default: posts).",
  scopes: ["entries:write"],
  body: EntryCreateSchema,
  response: EntryResourceSchema,
  handler: createEntryHandler,
});
