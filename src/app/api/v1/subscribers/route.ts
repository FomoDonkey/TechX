import { createRoute } from "@/api/runtime";
import {
  CreateSubscriberSchema,
  ListSubscribersQuerySchema,
  ListSubscribersResponseSchema,
  SubscriberResourceSchema,
  createSubscriberHandler,
  listSubscribersHandler,
} from "@/api/v1/subscribers";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/subscribers",
  tag: "Subscribers",
  summary: "Lista suscriptores",
  description: "Filtros: status, q (texto en email/nombre), tag.",
  scopes: ["subscribers:read"],
  query: ListSubscribersQuerySchema,
  response: ListSubscribersResponseSchema,
  handler: listSubscribersHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/subscribers",
  tag: "Subscribers",
  summary: "Crea (o reactiva) un suscriptor",
  description:
    "Si el subscriber no existe, lo crea. Si existía y estaba unsubscribed, lo reactiva (estado pendiente confirmación). Acepta `preConfirmed=true` para saltarse el doble opt-in.",
  scopes: ["subscribers:write"],
  body: CreateSubscriberSchema,
  response: SubscriberResourceSchema,
  handler: createSubscriberHandler,
});
