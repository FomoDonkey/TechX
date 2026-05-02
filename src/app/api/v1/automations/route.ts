import { createRoute } from "@/api/runtime";
import { ListAutomationsResponseSchema, listAutomationsHandler } from "@/api/v1/automations";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/automations",
  tag: "Automations",
  summary: "Lista automatizaciones",
  scopes: ["automations:read"],
  response: ListAutomationsResponseSchema,
  handler: listAutomationsHandler,
});
