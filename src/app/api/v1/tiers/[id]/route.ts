import { createRoute } from "@/api/runtime";
import {
  DeleteTierResponseSchema,
  TierParams,
  TierResourceSchema,
  UpdateTierSchema,
  deleteTierHandler,
  getTierHandler,
  updateTierHandler,
} from "@/api/v1/tiers";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/tiers/{id}",
  tag: "Tiers",
  summary: "Detalle de un tier",
  scopes: ["tiers:read"],
  params: TierParams,
  response: TierResourceSchema,
  handler: getTierHandler,
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/tiers/{id}",
  tag: "Tiers",
  summary: "Actualiza un tier",
  scopes: ["tiers:write"],
  params: TierParams,
  body: UpdateTierSchema,
  response: TierResourceSchema,
  handler: updateTierHandler,
});

export const DELETE = createRoute({
  method: "DELETE",
  path: "/api/v1/tiers/{id}",
  tag: "Tiers",
  summary: "Borra un tier",
  description: "Las membresías que apuntaban a este tier se quedan con tier=null.",
  scopes: ["tiers:write"],
  params: TierParams,
  response: DeleteTierResponseSchema,
  handler: deleteTierHandler,
});
