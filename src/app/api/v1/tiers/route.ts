import { createRoute } from "@/api/runtime";
import {
  CreateTierSchema,
  ListTiersQuerySchema,
  ListTiersResponseSchema,
  TierResourceSchema,
  createTierHandler,
  listTiersHandler,
} from "@/api/v1/tiers";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/tiers",
  tag: "Tiers",
  summary: "Lista tiers de membresía",
  description: "Filtros: active=true para sólo activos.",
  scopes: ["tiers:read"],
  query: ListTiersQuerySchema,
  response: ListTiersResponseSchema,
  handler: listTiersHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/tiers",
  tag: "Tiers",
  summary: "Crea un tier de membresía",
  description:
    "Si priceCents=0, el tier se marca como gratuito (sin Stripe). Para tiers de pago, usa la UI admin para sincronizar con Stripe Products+Prices.",
  scopes: ["tiers:write"],
  body: CreateTierSchema,
  response: TierResourceSchema,
  handler: createTierHandler,
});
