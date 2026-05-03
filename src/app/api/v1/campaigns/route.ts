import { createRoute } from "@/api/runtime";
import {
  CampaignResourceSchema,
  CreateCampaignBodySchema,
  ListCampaignsResponseSchema,
  createCampaignHandler,
  listCampaignsHandler,
} from "@/api/v1/campaigns";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/campaigns",
  tag: "Campaigns",
  summary: "Lista campañas",
  scopes: ["campaigns:read"],
  query: z.object({}).passthrough().optional(),
  response: ListCampaignsResponseSchema,
  handler: listCampaignsHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/campaigns",
  tag: "Campaigns",
  summary: "Crea una campaña",
  scopes: ["campaigns:write"],
  body: CreateCampaignBodySchema,
  response: CampaignResourceSchema,
  handler: createCampaignHandler,
});
