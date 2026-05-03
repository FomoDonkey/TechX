import { createRoute } from "@/api/runtime";
import {
  SubscriberDetailParams,
  SubscriberResourceSchema,
  unsubscribeSubscriberHandler,
} from "@/api/v1/subscribers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/subscribers/{id}/unsubscribe",
  tag: "Subscribers",
  summary: "Da de baja a un suscriptor",
  scopes: ["subscribers:write"],
  params: SubscriberDetailParams,
  body: z.object({}).passthrough().optional(),
  response: SubscriberResourceSchema,
  handler: unsubscribeSubscriberHandler,
});
