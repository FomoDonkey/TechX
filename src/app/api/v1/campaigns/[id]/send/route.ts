import { createRoute } from "@/api/runtime";
import {
  CampaignDetailParams,
  SendCampaignResponseSchema,
  sendCampaignHandler,
} from "@/api/v1/campaigns";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/campaigns/{id}/send",
  tag: "Campaigns",
  summary: "Envía la campaña a la audiencia",
  description:
    "Marca la campaña como en envío y la pone en cola. El cron de newsletter procesa los recipients.",
  scopes: ["campaigns:write"],
  params: CampaignDetailParams,
  body: z.object({}).passthrough().optional(),
  response: SendCampaignResponseSchema,
  handler: sendCampaignHandler,
});
