import { createRoute } from "@/api/runtime";
import {
  CampaignDetailParams,
  CampaignStatsSchema,
  statsCampaignHandler,
} from "@/api/v1/campaigns";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/campaigns/{id}/stats",
  tag: "Campaigns",
  summary: "Métricas agregadas de una campaña",
  scopes: ["campaigns:read"],
  params: CampaignDetailParams,
  response: CampaignStatsSchema,
  handler: statsCampaignHandler,
});
