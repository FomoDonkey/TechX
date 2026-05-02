import { createRoute } from "@/api/runtime";
import {
  AutomationDetailParams,
  ListRunsResponseSchema,
  listRunsHandler,
} from "@/api/v1/automations";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/automations/{id}/runs",
  tag: "Automations",
  summary: "Lista runs de una automatización",
  scopes: ["runs:read"],
  params: AutomationDetailParams,
  response: ListRunsResponseSchema,
  handler: listRunsHandler,
});
