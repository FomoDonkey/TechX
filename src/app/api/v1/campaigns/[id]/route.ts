import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import {
  CampaignDetailParams,
  CampaignResourceSchema,
  DeleteCampaignResponseSchema,
  UpdateCampaignBodySchema,
  deleteCampaignHandler,
  getCampaignHandler,
  updateCampaignHandler,
} from "@/api/v1/campaigns";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/campaigns/{id}",
  tag: "Campaigns",
  summary: "Obtiene una campaña",
  scopes: ["campaigns:read"],
  params: CampaignDetailParams,
  response: CampaignResourceSchema,
  handler: async (i) => {
    const out = await getCampaignHandler(i);
    if (!out) throw new ApiError("not_found", "Campaña no encontrada");
    return out;
  },
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/campaigns/{id}",
  tag: "Campaigns",
  summary: "Actualiza una campaña",
  scopes: ["campaigns:write"],
  params: CampaignDetailParams,
  body: UpdateCampaignBodySchema,
  response: CampaignResourceSchema,
  handler: updateCampaignHandler,
});

export const DELETE = createRoute({
  method: "DELETE",
  path: "/api/v1/campaigns/{id}",
  tag: "Campaigns",
  summary: "Elimina una campaña",
  scopes: ["campaigns:write"],
  params: CampaignDetailParams,
  response: DeleteCampaignResponseSchema,
  handler: deleteCampaignHandler,
});
