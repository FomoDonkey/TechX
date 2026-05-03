import { createRoute } from "@/api/runtime";
import {
  CreateSegmentSchema,
  ListSegmentsResponseSchema,
  SegmentResourceSchema,
  createSegmentHandler,
  listSegmentsHandler,
} from "@/api/v1/segments";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/segments",
  tag: "Segments",
  summary: "Lista segmentos",
  scopes: ["segments:read"],
  query: z.object({}).passthrough().optional(),
  response: ListSegmentsResponseSchema,
  handler: listSegmentsHandler,
});

export const POST = createRoute({
  method: "POST",
  path: "/api/v1/segments",
  tag: "Segments",
  summary: "Crea un segmento",
  scopes: ["segments:write"],
  body: CreateSegmentSchema,
  response: SegmentResourceSchema,
  handler: createSegmentHandler,
});
