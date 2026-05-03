import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import {
  DeleteSubscriberResponseSchema,
  SubscriberDetailParams,
  SubscriberResourceSchema,
  UpdateSubscriberSchema,
  deleteSubscriberHandler,
  getSubscriberHandler,
  updateSubscriberHandler,
} from "@/api/v1/subscribers";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/subscribers/{id}",
  tag: "Subscribers",
  summary: "Obtiene un suscriptor",
  scopes: ["subscribers:read"],
  params: SubscriberDetailParams,
  response: SubscriberResourceSchema,
  handler: async (i) => {
    const out = await getSubscriberHandler(i);
    if (!out) throw new ApiError("not_found", "Suscriptor no encontrado");
    return out;
  },
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/subscribers/{id}",
  tag: "Subscribers",
  summary: "Actualiza tags del suscriptor",
  scopes: ["subscribers:write"],
  params: SubscriberDetailParams,
  body: UpdateSubscriberSchema,
  response: SubscriberResourceSchema,
  handler: updateSubscriberHandler,
});

export const DELETE = createRoute({
  method: "DELETE",
  path: "/api/v1/subscribers/{id}",
  tag: "Subscribers",
  summary: "Elimina un suscriptor (definitivo)",
  scopes: ["subscribers:write"],
  params: SubscriberDetailParams,
  response: DeleteSubscriberResponseSchema,
  handler: deleteSubscriberHandler,
});
