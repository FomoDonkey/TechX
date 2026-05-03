import { ApiError } from "@/api/errors";
import { createRoute } from "@/api/runtime";
import {
  DeleteSegmentResponseSchema,
  SegmentDetailParams,
  SegmentResourceSchema,
  UpdateSegmentSchema,
  deleteSegmentHandler,
  getSegmentHandler,
  updateSegmentHandler,
} from "@/api/v1/segments";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/segments/{id}",
  tag: "Segments",
  summary: "Obtiene un segmento",
  scopes: ["segments:read"],
  params: SegmentDetailParams,
  response: SegmentResourceSchema,
  handler: async (i) => {
    const out = await getSegmentHandler(i);
    if (!out) throw new ApiError("not_found", "Segmento no encontrado");
    return out;
  },
});

export const PATCH = createRoute({
  method: "PATCH",
  path: "/api/v1/segments/{id}",
  tag: "Segments",
  summary: "Actualiza un segmento",
  scopes: ["segments:write"],
  params: SegmentDetailParams,
  body: UpdateSegmentSchema,
  response: SegmentResourceSchema,
  handler: updateSegmentHandler,
});

export const DELETE = createRoute({
  method: "DELETE",
  path: "/api/v1/segments/{id}",
  tag: "Segments",
  summary: "Elimina un segmento",
  scopes: ["segments:write"],
  params: SegmentDetailParams,
  response: DeleteSegmentResponseSchema,
  handler: deleteSegmentHandler,
});
