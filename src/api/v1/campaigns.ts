import { ApiError } from "@/api/errors";
import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import type { Campaign } from "@/db/schema";
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignStats,
  listCampaigns,
  updateCampaign,
} from "@/newsletter/campaigns-lib";
import { startCampaignSend } from "@/newsletter/dispatcher";
import { z } from "zod";

export const CampaignResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subject: z.string(),
  previewText: z.string().nullable(),
  fromName: z.string().nullable(),
  fromEmail: z.string().nullable(),
  status: z.enum(["draft", "scheduled", "sending", "sent", "paused", "failed"]),
  segmentId: z.string().uuid().nullable(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  totalRecipients: z.number().int().nullable(),
  sent: z.number().int().nullable(),
  opens: z.number().int().nullable(),
  clicks: z.number().int().nullable(),
  uniqueOpens: z.number().int().nullable(),
  uniqueClicks: z.number().int().nullable(),
  bounced: z.number().int().nullable(),
  failed: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListCampaignsResponseSchema = paginatedResponseSchema(CampaignResourceSchema);

function serialize(c: Campaign | null): z.infer<typeof CampaignResourceSchema> | null {
  if (!c) return null;
  const iso = (d: Date | string | null | undefined) =>
    d instanceof Date ? d.toISOString() : (d ?? null);
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    previewText: c.previewText,
    fromName: c.fromName,
    fromEmail: c.fromEmail,
    status: c.status as never,
    segmentId: c.segmentId,
    scheduledAt: iso(c.scheduledAt),
    sentAt: iso(c.sentAt),
    totalRecipients: c.totalRecipients,
    sent: c.sent,
    opens: c.opens,
    clicks: c.clicks,
    uniqueOpens: c.uniqueOpens,
    uniqueClicks: c.uniqueClicks,
    bounced: c.bounced,
    failed: c.failed,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
  };
}

export async function listCampaignsHandler({ ctx }: { ctx: ApiContext }) {
  const rows = await listCampaigns(ctx.workspaceId);
  return {
    data: rows.map((c) => serialize(c)!),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const CampaignDetailParams = z.object({ id: z.string().uuid() });

export async function getCampaignHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const c = await getCampaign(ctx.workspaceId, params.id);
  if (!c) return null;
  return serialize(c);
}

export const CreateCampaignBodySchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  previewText: z.string().max(200).optional(),
  fromName: z.string().max(120).optional(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  bodyHtml: z.string().max(500_000).optional(),
  segmentId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function createCampaignHandler({
  body,
  ctx,
}: {
  body: z.infer<typeof CreateCampaignBodySchema>;
  ctx: ApiContext;
}) {
  const result = await createCampaign({
    workspaceId: ctx.workspaceId,
    name: body.name,
    subject: body.subject,
    previewText: body.previewText,
    fromName: body.fromName,
    fromEmail: body.fromEmail,
    replyTo: body.replyTo,
    bodyHtml: body.bodyHtml,
    segmentId: body.segmentId ?? null,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
  });
  if (!result.ok) throw new ApiError("validation_error", result.error);
  return serialize(result.campaign);
}

export const UpdateCampaignBodySchema = CreateCampaignBodySchema.partial().extend({
  status: z.enum(["draft", "scheduled", "paused"]).optional(),
});

export async function updateCampaignHandler({
  params,
  body,
  ctx,
}: {
  params: { id: string };
  body: z.infer<typeof UpdateCampaignBodySchema>;
  ctx: ApiContext;
}) {
  const result = await updateCampaign(ctx.workspaceId, params.id, {
    ...body,
    scheduledAt:
      body.scheduledAt === undefined
        ? undefined
        : body.scheduledAt
          ? new Date(body.scheduledAt)
          : null,
  });
  if (!result.ok) {
    if (result.error === "not_found") throw new ApiError("not_found", "Campaña no encontrada");
    if (result.error === "campaign_locked") throw new ApiError("conflict", "Campaña ya enviada");
    throw new ApiError("validation_error", result.error);
  }
  return serialize(result.campaign);
}

export async function deleteCampaignHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const ok = await deleteCampaign(ctx.workspaceId, params.id);
  if (!ok) throw new ApiError("not_found", "Campaña no encontrada");
  return { ok: true, id: params.id };
}

export const SendCampaignResponseSchema = z.object({
  ok: z.boolean(),
  total: z.number().int(),
});

export async function sendCampaignHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const c = await getCampaign(ctx.workspaceId, params.id);
  if (!c) throw new ApiError("not_found", "Campaña no encontrada");
  if (c.status === "sending" || c.status === "sent") {
    throw new ApiError("conflict", "Campaña ya enviada");
  }
  await updateCampaign(ctx.workspaceId, c.id, { scheduledAt: new Date() });
  const result = await startCampaignSend(c.id);
  return { ok: result.ok, total: result.total };
}

export const CampaignStatsSchema = z.object({
  total: z.number().int(),
  sent: z.number().int(),
  pending: z.number().int(),
  sending: z.number().int(),
  bounced: z.number().int(),
  failed: z.number().int(),
  opened: z.number().int(),
  clicked: z.number().int(),
});

export async function statsCampaignHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const c = await getCampaign(ctx.workspaceId, params.id);
  if (!c) throw new ApiError("not_found", "Campaña no encontrada");
  const stats = await getCampaignStats(c.id);
  return {
    total: stats?.total ?? 0,
    sent: stats?.sent ?? 0,
    pending: stats?.pending ?? 0,
    sending: stats?.sending ?? 0,
    bounced: stats?.bounced ?? 0,
    failed: stats?.failed ?? 0,
    opened: stats?.opened ?? 0,
    clicked: stats?.clicked ?? 0,
  };
}

export const DeleteCampaignResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string().uuid(),
});
