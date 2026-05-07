/**
 * Dispatcher de envíos: campaigns + drip steps. Cada destinatario produce una
 * fila en `campaign_recipients` (estado pending → sending → sent/failed) y
 * eventos en `email_events`. El cron `newsletter-process` invoca `processCampaigns`
 * y `processDripEnrollments`.
 *
 * Defensa en concurrencia: claim atómico con WHERE status='pending' RETURNING id.
 *   Si dos workers se solapan, sólo uno gana la fila — replicamos el patrón de
 *   webhooks/automations.
 */

import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { atomicClaim, atomicClaimMany, countInt } from "@/db/dialect";
import {
  type Campaign,
  type CampaignRecipient,
  type Drip,
  type Subscriber,
  type Workspace,
  campaignRecipients,
  campaigns,
  emailEvents,
  segments,
  subscribers,
  workspaces,
} from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { bodyToHtml, htmlToText, rewriteLinksForTracking } from "./compose";
import type { DripStep } from "./drip";
import { type SegmentRulesPayload, matchesRule } from "./segments";
import { recordBounce } from "./subscribers";
import { renderBroadcast, renderDripStep } from "./templates";
import { tokens } from "./tokens";
import { buildOpenPixelUrl, buildSubscribeUrls, publicOriginFromWorkspace } from "./urls";

const BATCH_SIZE = 50;
const MAX_RECIPIENTS_PER_TICK = 200;

// ============================================================
// Helpers comunes
// ============================================================

async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  if (!db) return null;
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return ws ?? null;
}

function fromAddress(
  workspace: Workspace | null,
  override?: { name?: string | null; email?: string | null },
): string {
  const fallback = process.env.RESEND_FROM ?? "CSM <noreply@csm.dev>";
  const email = override?.email?.trim() || extractEmail(fallback);
  const name = override?.name?.trim() || workspace?.name || extractName(fallback);
  return name ? `${name} <${email}>` : email;
}

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return m ? (m[1] ?? "") : addr;
}
function extractName(addr: string): string {
  const m = addr.match(/^([^<]+)</);
  return m ? (m[1] ?? "").trim() : "";
}

// ============================================================
// CAMPAIGNS — schedule + send
// ============================================================

/**
 * Construye los recipients de una campaña a partir del segment seleccionado y
 * los inserta en `campaign_recipients` con estado pending.
 *
 * Idempotencia en dos niveles:
 *  1. Read-then-write check de `count(*) > 0` — fast path para reruns claros.
 *  2. `onConflictDoNothing` sobre `(campaignId, subscriberId)` — defensa-en-
 *     profundidad si dos llamadas concurrentes pasan el check (no debería pasar
 *     porque `startCampaignSend` claim atómicamente status='sending' antes de
 *     expand, pero protegemos contra llamada directa desde otro código).
 *  3. `totalRecipients` UPDATE sólo si era 0 — evita doble-conteo si por alguna
 *     razón se llama dos veces.
 */
export async function expandCampaignRecipients(campaignId: string): Promise<number> {
  if (!db) return 0;
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) return 0;

  // Fast path: si ya hay recipients, devolver count actual sin tocar nada.
  const [existing] = await db
    .select({ c: countInt() })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  if ((existing?.c ?? 0) > 0) return existing?.c ?? 0;

  const segmentRule = await loadSegmentRule(campaign.workspaceId, campaign.segmentId);

  // Cargar subscribers activos confirmados y filtrar
  const subs = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.workspaceId, campaign.workspaceId),
        eq(subscribers.status, "active"),
        sql`${subscribers.confirmedAt} IS NOT NULL`,
      ),
    );

  const matched = subs.filter((s) =>
    matchesRule(
      {
        status: s.status,
        locale: s.locale,
        tags: s.tags,
        source: s.source,
        email: s.email,
        name: s.name,
        createdAt: s.createdAt,
        confirmedAt: s.confirmedAt,
        lastOpenAt: s.lastOpenAt,
        lastClickAt: s.lastClickAt,
        bounceCount: s.bounceCount ?? 0,
      },
      segmentRule,
    ),
  );

  if (matched.length === 0) {
    await db
      .update(campaigns)
      .set({ totalRecipients: 0, status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.totalRecipients, 0)));
    return 0;
  }

  // Insert recipients en batch. La idempotencia ya está garantizada por el
  // fast-path `count(*) > 0` arriba; aquí pre-filtramos por (campaignId,
  // subscriberId) existentes para emular el `onConflictDoNothing` de forma
  // cross-dialect (MySQL no soporta INSERT...ON CONFLICT DO NOTHING RETURNING).
  const candidateValues = matched.map((s) => ({
    id: randomUUID(),
    workspaceId: campaign.workspaceId,
    campaignId: campaign.id,
    subscriberId: s.id,
    email: s.email,
    status: "pending" as const,
    trackingHash: randomUUID(),
  }));

  // Pre-check: subscribers ya con recipient para esta campaña.
  const existingPairs = await db
    .select({ subscriberId: campaignRecipients.subscriberId })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaign.id),
        inArray(
          campaignRecipients.subscriberId,
          candidateValues.map((v) => v.subscriberId),
        ),
      ),
    );
  const existingSet = new Set(existingPairs.map((p) => p.subscriberId));
  const values = candidateValues.filter((v) => !existingSet.has(v.subscriberId));

  let inserted = 0;
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    if (chunk.length === 0) continue;
    await db.insert(campaignRecipients).values(chunk);
    inserted += chunk.length;
  }

  // Update totalRecipients sólo si seguía en 0 — evita doble-suma si dos llamadas
  // llegaran a este punto (la primera puso un count, la segunda no debería pisarlo).
  await db
    .update(campaigns)
    .set({ totalRecipients: inserted, updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.totalRecipients, 0)));

  return inserted;
}

async function loadSegmentRule(
  workspaceId: string,
  segmentId: string | null,
): Promise<SegmentRulesPayload> {
  if (!db || !segmentId) return null;
  const [seg] = await db
    .select({ rules: segments.rules })
    .from(segments)
    .where(and(eq(segments.workspaceId, workspaceId), eq(segments.id, segmentId)))
    .limit(1);
  return (seg?.rules ?? null) as SegmentRulesPayload;
}

/**
 * Disparado por admin (Send Now) o por cron cuando scheduledAt vence.
 * Marca status='sending' y expande recipients.
 */
export async function startCampaignSend(
  campaignId: string,
): Promise<{ ok: boolean; total: number }> {
  if (!db) return { ok: false, total: 0 };

  // Claim atómico: status pasa a 'sending' sólo si era 'draft' o 'scheduled'.
  const claimed = await atomicClaim<{ id: string; status: string }>(campaigns, {
    where: eq(campaigns.id, campaignId),
    precondition: (row) => row.status === "draft" || row.status === "scheduled",
    set: { status: "sending", startedAt: new Date(), updatedAt: new Date() },
  });
  if (!claimed) return { ok: false, total: 0 };

  const total = await expandCampaignRecipients(campaignId);
  if (total === 0) {
    await db
      .update(campaigns)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }
  emitAsync({
    workspaceId:
      (
        await db
          .select({ ws: campaigns.workspaceId })
          .from(campaigns)
          .where(eq(campaigns.id, campaignId))
          .limit(1)
      )[0]?.ws ?? "",
    event: "campaign.scheduled",
    payload: { campaignId, total },
  });
  return { ok: true, total };
}

/**
 * Procesa lotes de recipients pending. Llamado por cron.
 */
export async function processCampaigns(
  maxBatch = MAX_RECIPIENTS_PER_TICK,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  if (!db) return { sent, failed };

  // 1) Promote scheduled → sending si scheduledAt venció
  const due = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "scheduled"),
        sql`${campaigns.scheduledAt} IS NOT NULL`,
        lte(campaigns.scheduledAt, new Date()),
      ),
    );
  for (const c of due) {
    await startCampaignSend(c.id);
  }

  // 2) Tomar recipients pending (cap por tick)
  const pending = await db
    .select({
      recipient: campaignRecipients,
      campaign: campaigns,
      subscriber: subscribers,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .innerJoin(subscribers, eq(subscribers.id, campaignRecipients.subscriberId))
    .where(and(eq(campaignRecipients.status, "pending"), eq(campaigns.status, "sending")))
    .limit(maxBatch);

  if (pending.length === 0) {
    // Marcar campañas finalizadas (sin pending restantes)
    await markFinishedCampaigns();
    return { sent, failed };
  }

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const ids = batch.map((b) => b.recipient.id);

    // Claim atómico para evitar doble envío. Pattern H batch: SELECT FOR UPDATE
    // + filter por precondición (status='pending') + UPDATE.
    const claimedRows = await atomicClaimMany<{ id: string; status: string }>(campaignRecipients, {
      where: inArray(campaignRecipients.id, ids),
      precondition: (row) => row.status === "pending",
      set: { status: "sending" },
    });
    const claimedSet = new Set(claimedRows.map((r) => r.id));
    const claimedBatch = batch.filter((b) => claimedSet.has(b.recipient.id));

    for (const item of claimedBatch) {
      const ok = await sendCampaignRecipient(item.campaign, item.recipient, item.subscriber);
      if (ok) sent += 1;
      else failed += 1;
    }
  }

  await markFinishedCampaigns();
  return { sent, failed };
}

async function markFinishedCampaigns(): Promise<void> {
  if (!db) return;
  // Identificar campañas en sending sin pending restantes
  const inProgress = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.status, "sending"));
  for (const c of inProgress) {
    const [pendingCount] = await db
      .select({ c: countInt() })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, c.id),
          inArray(campaignRecipients.status, ["pending", "sending"]),
        ),
      );
    if ((pendingCount?.c ?? 0) === 0) {
      // Claim atómico: sólo actualiza si seguía en 'sending'. Si dos cron ticks
      // llegan al mismo tiempo, sólo uno emite `campaign.sent`.
      const claimed = await atomicClaim<{ id: string; status: string }>(campaigns, {
        where: eq(campaigns.id, c.id),
        precondition: (row) => row.status === "sending",
        set: { status: "sent", sentAt: new Date(), updatedAt: new Date() },
      });
      if (!claimed) continue;
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, c.id)).limit(1);
      if (campaign) {
        emitAsync({
          workspaceId: campaign.workspaceId,
          event: "campaign.sent",
          payload: {
            campaignId: campaign.id,
            sent: campaign.sent,
            opens: campaign.opens,
            clicks: campaign.clicks,
            bounced: campaign.bounced,
            failed: campaign.failed,
          },
        });
      }
    }
  }
}

async function sendCampaignRecipient(
  campaign: Campaign,
  recipient: CampaignRecipient,
  subscriber: Subscriber,
): Promise<boolean> {
  if (!db) return false;
  const ws = await getWorkspace(campaign.workspaceId);
  const origin = publicOriginFromWorkspace(ws);

  const unsubToken =
    subscriber.unsubscribeToken ?? tokens.signUnsub(subscriber.id, subscriber.workspaceId);
  const prefsToken = tokens.signPrefs(subscriber.id, subscriber.workspaceId);
  const urls = buildSubscribeUrls(origin, { unsub: unsubToken, prefs: prefsToken });

  // Preparar HTML: usa bodyHtml ya compilado (snapshot) o compila ahora
  let bodyHtml = (campaign.bodyHtml ?? "").trim();
  if (!bodyHtml && campaign.body) bodyHtml = bodyToHtml(campaign.body);

  // Reescritura de tracking
  const rewritten = rewriteLinksForTracking(bodyHtml, recipient.id, origin, "c");
  const finalHtml = renderBroadcast({
    workspaceName: ws?.name ?? "CSM",
    subject: campaign.subject,
    bodyHtml: rewritten.html,
    preheader: campaign.previewText ?? undefined,
    preferencesUrl: urls.prefs ?? "#",
    unsubscribeUrl: urls.unsub ?? "#",
    trackingPixel: buildOpenPixelUrl(origin, tokens.signOpen(recipient.id, "c")),
  });

  const text = htmlToText(finalHtml);
  const result = await sendEmail({
    from: fromAddress(ws, { name: campaign.fromName, email: campaign.fromEmail }),
    to: subscriber.email,
    subject: campaign.subject,
    html: finalHtml,
    text,
  });

  const now = new Date();
  if (result.ok) {
    await db
      .update(campaignRecipients)
      .set({
        status: "sent",
        sentAt: now,
        providerMessageId: result.id ?? null,
      })
      .where(eq(campaignRecipients.id, recipient.id));
    await db
      .update(campaigns)
      .set({ sent: sql`coalesce(${campaigns.sent}, 0) + 1`, updatedAt: now })
      .where(eq(campaigns.id, campaign.id));
    await db.insert(emailEvents).values({
      workspaceId: campaign.workspaceId,
      type: "sent",
      campaignId: campaign.id,
      recipientId: recipient.id,
      subscriberId: subscriber.id,
    });
    return true;
  }

  await db
    .update(campaignRecipients)
    .set({
      status: "failed",
      failedAt: now,
      failureReason: result.error ?? "send_failed",
    })
    .where(eq(campaignRecipients.id, recipient.id));
  await db
    .update(campaigns)
    .set({ failed: sql`coalesce(${campaigns.failed}, 0) + 1`, updatedAt: now })
    .where(eq(campaigns.id, campaign.id));
  await db.insert(emailEvents).values({
    workspaceId: campaign.workspaceId,
    type: "failed",
    campaignId: campaign.id,
    recipientId: recipient.id,
    subscriberId: subscriber.id,
    metadata: { reason: result.error ?? "send_failed" },
  });
  return false;
}

// ============================================================
// DRIPS
// ============================================================

export async function sendDripStep(input: {
  workspaceId: string;
  drip: Drip;
  subscriber: Subscriber;
  step: DripStep;
  stepIndex: number;
  totalSteps: number;
  enrollmentId: string;
}): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  const ws = await getWorkspace(input.workspaceId);
  const origin = publicOriginFromWorkspace(ws);

  const recipientId = randomUUID();
  // No usamos campaign_recipients para drips (otra dimensión); pero igualmente
  // emitimos event con id sintético para tracking de open/click.

  const unsubToken =
    input.subscriber.unsubscribeToken ?? tokens.signUnsub(input.subscriber.id, input.workspaceId);
  const prefsToken = tokens.signPrefs(input.subscriber.id, input.workspaceId);
  const urls = buildSubscribeUrls(origin, { unsub: unsubToken, prefs: prefsToken });

  let bodyHtml = (input.step.bodyHtml ?? "").trim();
  if (!bodyHtml && input.step.body) bodyHtml = bodyToHtml(input.step.body);

  // Tracking links: reusamos enrollmentId como recipient para pixel/click
  const rewritten = rewriteLinksForTracking(bodyHtml, input.enrollmentId, origin, "d");

  const html = renderDripStep({
    workspaceName: ws?.name ?? "CSM",
    subject: input.step.subject,
    bodyHtml: rewritten.html,
    stepNumber: input.stepIndex + 1,
    totalSteps: input.totalSteps,
    preferencesUrl: urls.prefs ?? "#",
    unsubscribeUrl: urls.unsub ?? "#",
    trackingPixel: buildOpenPixelUrl(origin, tokens.signOpen(input.enrollmentId, "d")),
  });

  const result = await sendEmail({
    from: fromAddress(ws),
    to: input.subscriber.email,
    subject: input.step.subject,
    html,
    text: htmlToText(html),
  });

  if (!result.ok) {
    await db.insert(emailEvents).values({
      workspaceId: input.workspaceId,
      type: "failed",
      dripId: input.drip.id,
      dripEnrollmentId: input.enrollmentId,
      subscriberId: input.subscriber.id,
      metadata: { reason: result.error ?? "send_failed", stepIndex: input.stepIndex },
    });
    return { ok: false };
  }

  await db.insert(emailEvents).values({
    workspaceId: input.workspaceId,
    type: "sent",
    dripId: input.drip.id,
    dripEnrollmentId: input.enrollmentId,
    subscriberId: input.subscriber.id,
    metadata: { stepIndex: input.stepIndex, providerMessageId: result.id ?? null },
  });
  return { ok: true };
}

// ============================================================
// Eventos: open + click
// ============================================================

export async function recordOpen(opts: {
  recipientId?: string;
  enrollmentId?: string;
  ipHash?: string;
  userAgent?: string;
}): Promise<void> {
  if (!db) return;
  const now = new Date();

  if (opts.recipientId) {
    const [rec] = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, opts.recipientId))
      .limit(1);
    if (!rec) return;

    const isFirstOpen = !rec.openedAt;
    await db
      .update(campaignRecipients)
      .set({
        openedAt: rec.openedAt ?? now,
        openCount: sql`coalesce(${campaignRecipients.openCount}, 0) + 1`,
        status: rec.status === "sent" || rec.status === "sending" ? "sent" : rec.status,
      })
      .where(eq(campaignRecipients.id, rec.id));

    await db
      .update(campaigns)
      .set({
        opens: sql`coalesce(${campaigns.opens}, 0) + 1`,
        uniqueOpens: isFirstOpen
          ? sql`coalesce(${campaigns.uniqueOpens}, 0) + 1`
          : campaigns.uniqueOpens,
        updatedAt: now,
      })
      .where(eq(campaigns.id, rec.campaignId));

    await db
      .update(subscribers)
      .set({ lastOpenAt: now, updatedAt: now })
      .where(eq(subscribers.id, rec.subscriberId));

    await db.insert(emailEvents).values({
      workspaceId: rec.workspaceId,
      type: "open",
      campaignId: rec.campaignId,
      recipientId: rec.id,
      subscriberId: rec.subscriberId,
      ipHash: opts.ipHash ?? null,
      userAgent: opts.userAgent ?? null,
    });
    return;
  }

  if (opts.enrollmentId) {
    const { dripEnrollments } = await import("@/db/schema");
    const [enr] = await db
      .select()
      .from(dripEnrollments)
      .where(eq(dripEnrollments.id, opts.enrollmentId))
      .limit(1);
    if (!enr) return;
    await db
      .update(subscribers)
      .set({ lastOpenAt: now, updatedAt: now })
      .where(eq(subscribers.id, enr.subscriberId));
    await db.insert(emailEvents).values({
      workspaceId: enr.workspaceId,
      type: "open",
      dripId: enr.dripId,
      dripEnrollmentId: enr.id,
      subscriberId: enr.subscriberId,
      ipHash: opts.ipHash ?? null,
      userAgent: opts.userAgent ?? null,
    });
  }
}

export async function recordClick(opts: {
  recipientId: string;
  url: string;
  ipHash?: string;
  userAgent?: string;
}): Promise<void> {
  if (!db) return;
  const now = new Date();
  const [rec] = await db
    .select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.id, opts.recipientId))
    .limit(1);
  if (!rec) return;

  const isFirstClick = !rec.clickedAt;
  await db
    .update(campaignRecipients)
    .set({
      clickedAt: rec.clickedAt ?? now,
      clickCount: sql`coalesce(${campaignRecipients.clickCount}, 0) + 1`,
    })
    .where(eq(campaignRecipients.id, rec.id));
  await db
    .update(campaigns)
    .set({
      clicks: sql`coalesce(${campaigns.clicks}, 0) + 1`,
      uniqueClicks: isFirstClick
        ? sql`coalesce(${campaigns.uniqueClicks}, 0) + 1`
        : campaigns.uniqueClicks,
      updatedAt: now,
    })
    .where(eq(campaigns.id, rec.campaignId));
  await db
    .update(subscribers)
    .set({ lastClickAt: now, updatedAt: now })
    .where(eq(subscribers.id, rec.subscriberId));
  await db.insert(emailEvents).values({
    workspaceId: rec.workspaceId,
    type: "click",
    campaignId: rec.campaignId,
    recipientId: rec.id,
    subscriberId: rec.subscriberId,
    url: opts.url,
    ipHash: opts.ipHash ?? null,
    userAgent: opts.userAgent ?? null,
  });
}

// ============================================================
// Bounce (provider webhook futura — mock por ahora)
// ============================================================

export async function recordBounceForRecipient(opts: {
  recipientId: string;
  reason?: string;
}): Promise<void> {
  if (!db) return;
  const [rec] = await db
    .select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.id, opts.recipientId))
    .limit(1);
  if (!rec) return;
  // Idempotente: si ya estaba bounced, no incrementamos contadores ni metemos
  // duplicado en email_events. El webhook del provider puede entregar 2x.
  if (rec.status === "bounced") return;
  const now = new Date();
  const claimed = await atomicClaim<{ id: string; status: string }>(campaignRecipients, {
    where: eq(campaignRecipients.id, rec.id),
    precondition: (row) => row.status !== "bounced",
    set: { status: "bounced", bouncedAt: now, failureReason: opts.reason ?? null },
  });
  if (!claimed) return;
  await db
    .update(campaigns)
    .set({ bounced: sql`coalesce(${campaigns.bounced}, 0) + 1`, updatedAt: now })
    .where(eq(campaigns.id, rec.campaignId));
  await db.insert(emailEvents).values({
    workspaceId: rec.workspaceId,
    type: "bounce",
    campaignId: rec.campaignId,
    recipientId: rec.id,
    subscriberId: rec.subscriberId,
    metadata: { reason: opts.reason ?? null },
  });
  await recordBounce(rec.subscriberId, rec.workspaceId, opts.reason);
}
