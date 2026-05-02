import { createRoute } from "@/api/runtime";
import {
  FormDetailParams,
  ListSubmissionsQuerySchema,
  ListSubmissionsResponseSchema,
  listSubmissionsHandler,
} from "@/api/v1/forms";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/forms/{id}/submissions",
  tag: "Forms",
  summary: "Lista envíos de un formulario",
  description:
    "Devuelve las submissions del formulario. Filtra por status y soporta paginación cursor.",
  scopes: ["submissions:read"],
  params: FormDetailParams,
  query: ListSubmissionsQuerySchema,
  response: ListSubmissionsResponseSchema,
  handler: listSubmissionsHandler,
});
