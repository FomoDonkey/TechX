/**
 * CRUD de campaigns.
 */

import { db } from "@/db/client";
import { deleteReturningCount, insertReturning } from "@/db/dialect";
import { type Campaign, campaignRecipients, campaigns, emailEvents } from "@/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { bodyToHtml } from "./compose";

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  if (!db) return [];
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, workspaceId))
    .orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(workspaceId: string, id: string): Promise<Campaign | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id)))
    .limit(1);
  return row ?? null;
}

export type CreateCampaignInput = {
  workspaceId: string;
  name: string;
  subject: string;
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  body?: unknown;
  bodyHtml?: string;
  segmentId?: string | null;
  scheduledAt?: Date | null;
  templateId?: string | null;
  createdById?: string;
};

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "db_error" };

  const compiledHtml = input.bodyHtml ?? (input.body ? bodyToHtml(input.body) : null);
  const status = input.scheduledAt ? "scheduled" : "draft";

  const id = crypto.randomUUID();
  const row = (await insertReturning(campaigns, {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    subject: input.subject,
    previewText: input.previewText ?? null,
    fromName: input.fromName ?? null,
    fromEmail: input.fromEmail ?? null,
    replyTo: input.replyTo ?? null,
    body: (input.body ?? null) as never,
    bodyHtml: compiledHtml,
    segmentId: input.segmentId ?? null,
    templateId: input.templateId ?? null,
    scheduledAt: input.scheduledAt ?? null,
    status,
    createdById: input.createdById ?? null,
  })) as Campaign;
  if (!row) return { ok: false, error: "db_error" };
  return { ok: true, campaign: row };
}

export type UpdateCampaignPatch = Partial<{
  name: string;
  subject: string;
  previewText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  body: unknown;
  bodyHtml: string | null;
  segmentId: string | null;
  scheduledAt: Date | null;
  templateId: string | null;
  status: "draft" | "scheduled" | "paused";
}>;

export async function updateCampaign(
  workspaceId: string,
  id: string,
  patch: UpdateCampaignPatch,
): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "db_error" };
  const existing = await getCampaign(workspaceId, id);
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.status === "sending" || existing.status === "sent") {
    return { ok: false, error: "campaign_locked" };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.subject !== undefined) updates.subject = patch.subject;
  if (patch.previewText !== undefined) updates.previewText = patch.previewText;
  if (patch.fromName !== undefined) updates.fromName = patch.fromName;
  if (patch.fromEmail !== undefined) updates.fromEmail = patch.fromEmail;
  if (patch.replyTo !== undefined) updates.replyTo = patch.replyTo;
  if (patch.body !== undefined) {
    updates.body = patch.body;
    updates.bodyHtml = bodyToHtml(patch.body);
  }
  if (patch.bodyHtml !== undefined && patch.body === undefined) updates.bodyHtml = patch.bodyHtml;
  if (patch.segmentId !== undefined) updates.segmentId = patch.segmentId;
  if (patch.templateId !== undefined) updates.templateId = patch.templateId;
  if (patch.scheduledAt !== undefined) {
    updates.scheduledAt = patch.scheduledAt;
    if (patch.scheduledAt && existing.status === "draft") updates.status = "scheduled";
    if (!patch.scheduledAt && existing.status === "scheduled") updates.status = "draft";
  }
  if (patch.status !== undefined) updates.status = patch.status;

  await db
    .update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id)));
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id)))
    .limit(1);
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, campaign: row };
}

export async function deleteCampaign(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const deleted = await deleteReturningCount(
    campaigns,
    and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id))!,
  );
  return deleted > 0;
}

export async function getCampaignStats(campaignId: string) {
  if (!db) return null;
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent')::int`,
      pending: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'pending')::int`,
      sending: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sending')::int`,
      bounced: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'bounced')::int`,
      failed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')::int`,
      opened: sql<number>`count(*) filter (where ${campaignRecipients.openedAt} is not null)::int`,
      clicked: sql<number>`count(*) filter (where ${campaignRecipients.clickedAt} is not null)::int`,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  return stats ?? null;
}

export async function listRecipientEvents(campaignId: string, limit = 100) {
  if (!db) return [];
  return db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.campaignId, campaignId))
    .orderBy(desc(emailEvents.createdAt))
    .limit(limit);
}
