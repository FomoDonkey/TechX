import { createRoute } from "@/api/runtime";
import {
  CreateMembershipSchema,
  ListMembershipsQuerySchema,
  ListMembershipsResponseSchema,
  MembershipResourceSchema,
  createMembershipHandler,
  listMembershipsHandler,
} from "@/api/v1/memberships";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/memberships",
  tag: "Memberships",
  summary: "Lista membresías",
  description: "Filtros: status, tierId, paginación con limit/offset.",
  scopes: ["memberships:read"],
  query: ListMembershipsQuerySchema,
  response: ListMembershipsResponseSchema,
  handler: listMembershipsHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/memberships",
  tag: "Memberships",
  summary: "Concede una membresía manualmente",
  description:
    "Idempotente sobre (workspace, email): si ya existe la actualiza. Útil para imports y grants VIP.",
  scopes: ["memberships:write"],
  body: CreateMembershipSchema,
  response: MembershipResourceSchema,
  handler: createMembershipHandler,
});
