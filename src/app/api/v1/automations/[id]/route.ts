import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import {
  AutomationDetailParams,
  AutomationResourceSchema,
  getAutomationHandler,
} from "@/api/v1/automations";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/automations/{id}",
  tag: "Automations",
  summary: "Obtiene una automatización",
  scopes: ["automations:read"],
  params: AutomationDetailParams,
  response: AutomationResourceSchema,
  handler: async (i) => {
    const out = await getAutomationHandler(i);
    if (!out) throw new ApiError("not_found", "No encontrada");
    return out;
  },
});
