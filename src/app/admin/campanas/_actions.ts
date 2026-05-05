"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { requireWorkspace } from "@/lib/workspace";
import {
  type CreateCampaignInput,
  type UpdateCampaignPatch,
  createCampaign,
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/newsletter/campaigns-lib";
import { bodyToHtml, htmlToText, rewriteLinksForTracking } from "@/newsletter/compose";
import { startCampaignSend } from "@/newsletter/dispatcher";
import { renderBroadcast } from "@/newsletter/templates";
import { tokens } from "@/newsletter/tokens";
import {
  buildOpenPixelUrl,
  buildSubscribeUrls,
  publicOriginFromWorkspace,
} from "@/newsletter/urls";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  previewText: z.string().max(200).optional(),
  fromName: z.string().max(120).optional(),
  fromEmail: z.string().email().max(200).optional(),
  replyTo: z.string().email().optional(),
  body: z.unknown().optional(),
  bodyHtml: z.string().max(500_000).optional(),
  segmentId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function createCampaignAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const data: CreateCampaignInput = {
    workspaceId: ctx.workspace.id,
    name: parsed.data.name,
    subject: parsed.data.subject,
    previewText: parsed.data.previewText,
    fromName: parsed.data.fromName,
    fromEmail: parsed.data.fromEmail,
    replyTo: parsed.data.replyTo,
    body: parsed.data.body,
    bodyHtml: parsed.data.bodyHtml,
    segmentId: parsed.data.segmentId ?? null,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    createdById: user.id,
  };

  const result = await createCampaign(data);
  if (!result.ok) return result;
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "campaign.created",
    targetType: "campaign",
    targetId: result.campaign.id,
  });
  revalidatePath("/admin/campanas");
  return { ok: true as const, campaign: result.campaign };
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    subject: z.string().min(1).max(200).optional(),
    previewText: z.string().max(200).nullable().optional(),
    fromName: z.string().max(120).nullable().optional(),
    fromEmail: z.string().email().max(200).nullable().optional(),
    replyTo: z.string().email().nullable().optional(),
    body: z.unknown().optional(),
    bodyHtml: z.string().max(500_000).nullable().optional(),
    segmentId: z.string().uuid().nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    status: z.enum(["draft", "scheduled", "paused"]).optional(),
  }),
});

export async function updateCampaignAction(input: z.input<typeof UpdateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const patch: UpdateCampaignPatch = {
    ...parsed.data.patch,
    scheduledAt:
      parsed.data.patch.scheduledAt === undefined
        ? undefined
        : parsed.data.patch.scheduledAt
          ? new Date(parsed.data.patch.scheduledAt)
          : null,
  };

  const result = await updateCampaign(ctx.workspace.id, parsed.data.id, patch);
  if (!result.ok) return result;
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "campaign.updated",
    targetType: "campaign",
    targetId: result.campaign.id,
  });
  revalidatePath("/admin/campanas");
  revalidatePath(`/admin/campanas/${parsed.data.id}`);
  return { ok: true as const, campaign: result.campaign };
}

export async function deleteCampaignAction(input: { id: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const idP = z.string().uuid().safeParse(input.id);
  if (!idP.success) return { ok: false as const, error: "invalid_id" };
  const ok = await deleteCampaign(ctx.workspace.id, idP.data);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "campaign.deleted",
    targetType: "campaign",
    targetId: idP.data,
  });
  revalidatePath("/admin/campanas");
  return { ok };
}

const SendTestSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

export async function sendTestCampaignAction(input: z.input<typeof SendTestSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = SendTestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  // Rate-limit anti-mailbomb: 20 test sends/hora por (user, workspace).
  // Sin esto, un editor comprometido podía spam-enviar emails verificados
  // a una víctima usando el dominio Resend del workspace (audit F0-F9a).
  const { consume } = await import("@/api/rate-limit");
  const rl = consume(`campaign:test:${ctx.workspace.id}:${user.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false as const, error: "rate_limited" };
  }

  const campaign = await getCampaign(ctx.workspace.id, parsed.data.id);
  if (!campaign) return { ok: false as const, error: "not_found" };

  const ws = ctx.workspace;
  const origin = publicOriginFromWorkspace(ws);
  const fakeRecipientId = `test-${Date.now()}`;
  const unsubToken = tokens.signUnsub(fakeRecipientId, ws.id);
  const prefsToken = tokens.signPrefs(fakeRecipientId, ws.id);
  const urls = buildSubscribeUrls(origin, { unsub: unsubToken, prefs: prefsToken });

  const bodyHtml =
    (campaign.bodyHtml ?? "").trim() || (campaign.body ? bodyToHtml(campaign.body) : "");
  const rewritten = rewriteLinksForTracking(bodyHtml, fakeRecipientId, origin, "c");
  const html = renderBroadcast({
    workspaceName: ws.name,
    subject: `[TEST] ${campaign.subject}`,
    bodyHtml: rewritten.html,
    preheader: campaign.previewText ?? undefined,
    preferencesUrl: urls.prefs ?? "#",
    unsubscribeUrl: urls.unsub ?? "#",
    trackingPixel: buildOpenPixelUrl(origin, tokens.signOpen(fakeRecipientId, "c")),
  });

  const result = await sendEmail({
    to: parsed.data.email,
    subject: `[TEST] ${campaign.subject}`,
    html,
    text: htmlToText(html),
  });
  if (!result.ok) return { ok: false as const, error: result.error ?? "send_failed" };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "campaign.test_sent",
    targetType: "campaign",
    targetId: campaign.id,
    meta: { to: parsed.data.email },
  });
  return { ok: true as const, mocked: result.mocked ?? false };
}

const SendSchema = z.object({ id: z.string().uuid() });

export async function sendCampaignAction(input: z.input<typeof SendSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = SendSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const campaign = await getCampaign(ctx.workspace.id, parsed.data.id);
  if (!campaign) return { ok: false as const, error: "not_found" };
  if (campaign.status === "sending" || campaign.status === "sent") {
    return { ok: false as const, error: "already_sent" };
  }

  // Marcar como scheduled para que el cron lo recoja en próximo tick
  await updateCampaign(ctx.workspace.id, campaign.id, { scheduledAt: new Date() });
  const result = await startCampaignSend(campaign.id);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "campaign.send_now",
    targetType: "campaign",
    targetId: campaign.id,
    meta: { total: result.total },
  });
  revalidatePath("/admin/campanas");
  revalidatePath(`/admin/campanas/${campaign.id}`);
  return { ok: result.ok, total: result.total };
}
