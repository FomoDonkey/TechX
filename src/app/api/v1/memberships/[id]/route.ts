import { createRoute } from "@/api/runtime";
import {
  MembershipParams,
  MembershipResourceSchema,
  UpdateMembershipSchema,
  getMembershipHandler,
  updateMembershipHandler,
} from "@/api/v1/memberships";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/memberships/{id}",
  tag: "Memberships",
  summary: "Detalle de una membresía",
  scopes: ["memberships:read"],
  params: MembershipParams,
  response: MembershipResourceSchema,
  handler: getMembershipHandler,
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/memberships/{id}",
  tag: "Memberships",
  summary: "Actualiza una membresía (cambiar tier, cancelar, marcar pausada…)",
  scopes: ["memberships:write"],
  params: MembershipParams,
  body: UpdateMembershipSchema,
  response: MembershipResourceSchema,
  handler: updateMembershipHandler,
});
