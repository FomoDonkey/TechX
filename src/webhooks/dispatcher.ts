/**
 * Dispatcher de webhooks.
 *
 * Flujo:
 *  1. emit(event, payload) — encola una `webhook_delivery` por cada subscription
 *     activa que matchee el event (o "*").
 *  2. processDeliveries() — consume deliveries en estado "pending"|"retrying"
 *     con `nextAttemptAt <= now()`, las firma con HMAC y hace fetch con timeout.
 *     Reintenta con backoff exponencial hasta `maxAttempts`.
 *  3. replayDelivery(id) — duplica una delivery para reintentar manualmente.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { deleteReturningCount } from "@/db/dialect";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { safePublicFetch } from "@/lib/ssrf";
import { RETRY_DELAYS_MS, type WebhookEvent } from "@/webhooks/events";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SNIPPET = 1024;
const MAX_BATCH = 25;

// ============================================================
// Signing
// ============================================================

export function signPayload(secret: string, payload: string, timestamp: number): string {
  const h = createHmac("sha256", secret);
  h.update(`${timestamp}.${payload}`);
  return h.digest("hex");
}

export function verifySignature(
  secret: string,
  payload: string,
  timestamp: number,
  signature: string,
): boolean {
  const expected = signPayload(secret, payload, timestamp);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ============================================================
// Emit
// ============================================================

export type EmitInput = {
  workspaceId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
};

export async function emit(input: EmitInput): Promise<number> {
  if (!db) return 0;
  // 1) Disparar automations event-based (lazy import para evitar ciclo)
  void (async () => {
    try {
      const { triggerEvent } = await import("@/automations/listener");
      await triggerEvent({
        workspaceId: input.workspaceId,
        event: input.event,
        payload: input.payload,
      });
    } catch (err) {
      console.error("[automations trigger] error:", err);
    }
  })();

  // 2) Buscamos webhooks activos suscritos al evento o a "*"
  const subscriptions = await db
    .select({ id: webhooks.id, maxAttempts: webhooks.maxAttempts, events: webhooks.events })
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, input.workspaceId), eq(webhooks.active, true)));

  const matched = subscriptions.filter((s) => {
    const events = s.events ?? [];
    return events.includes("*") || events.includes(input.event);
  });
  if (matched.length === 0) return 0;

  const fullPayload = {
    event: input.event,
    workspaceId: input.workspaceId,
    timestamp: new Date().toISOString(),
    data: input.payload,
  };

  await db.insert(webhookDeliveries).values(
    matched.map((s) => ({
      workspaceId: input.workspaceId,
      webhookId: s.id,
      event: input.event,
      payload: fullPayload as object,
      status: "pending" as const,
      attempt: 0,
      maxAttempts: s.maxAttempts ?? 5,
      nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[0]!),
    })),
  );
  return matched.length;
}

/** Versión "fire-and-forget" — útil dentro de server actions. */
export function emitAsync(input: EmitInput): void {
  void emit(input).catch((err) => {
    console.error("[webhooks emit] error encolando:", err);
  });
}

// ============================================================
// Process deliveries (cron)
// ============================================================

export type ProcessResult = {
  picked: number;
  succeeded: number;
  failed: number;
  retrying: number;
  dropped: number;
};

export async function processDeliveries(maxBatch: number = MAX_BATCH): Promise<ProcessResult> {
  if (!db) return { picked: 0, succeeded: 0, failed: 0, retrying: 0, dropped: 0 };

  // Pick up + claim atómico: marcamos las elegibles como "retrying" para evitar dobles.
  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          or(eq(webhookDeliveries.status, "pending"), eq(webhookDeliveries.status, "retrying")),
          lte(webhookDeliveries.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(webhookDeliveries.nextAttemptAt)
      .limit(maxBatch)
      .for("update", { skipLocked: true });
    if (candidates.length === 0) return [];
    const ids = candidates.map((c) => c.id);
    await tx
      .update(webhookDeliveries)
      .set({ status: "retrying", updatedAt: new Date() })
      .where(inArray(webhookDeliveries.id, ids));
    return tx.select().from(webhookDeliveries).where(inArray(webhookDeliveries.id, ids));
  });

  let succeeded = 0;
  let failed = 0;
  let retrying = 0;
  let dropped = 0;

  for (const delivery of claimed) {
    // Doble filtro defensivo: id Y workspaceId. La FK con cascade impide huérfanas
    // pero un bug en algún emit que viole el invariante no debe causar leak.
    const [hook] = await db
      .select({ url: webhooks.url, secret: webhooks.secret, active: webhooks.active })
      .from(webhooks)
      .where(
        and(eq(webhooks.id, delivery.webhookId), eq(webhooks.workspaceId, delivery.workspaceId)),
      )
      .limit(1);
    if (!hook || !hook.active) {
      await db
        .update(webhookDeliveries)
        .set({ status: "dropped", updatedAt: new Date(), error: "Webhook inactivo o eliminado" })
        .where(eq(webhookDeliveries.id, delivery.id));
      dropped++;
      continue;
    }

    const result = await sendOne({
      url: hook.url,
      secret: hook.secret,
      payload: delivery.payload as Record<string, unknown>,
      eventId: delivery.eventId,
      event: delivery.event,
    });

    const newAttempt = delivery.attempt + 1;
    if (result.ok) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "success",
          statusCode: result.statusCode,
          responseSnippet: result.responseSnippet,
          durationMs: result.durationMs,
          attempt: newAttempt,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await db
        .update(webhooks)
        .set({ lastSuccessAt: new Date() })
        .where(eq(webhooks.id, delivery.webhookId));
      succeeded++;
    } else if (newAttempt >= delivery.maxAttempts) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "failed",
          statusCode: result.statusCode ?? null,
          responseSnippet: result.responseSnippet ?? null,
          durationMs: result.durationMs,
          error: result.error ?? null,
          attempt: newAttempt,
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await db
        .update(webhooks)
        .set({ lastFailureAt: new Date() })
        .where(eq(webhooks.id, delivery.webhookId));
      failed++;
    } else {
      const nextDelay = RETRY_DELAYS_MS[newAttempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      await db
        .update(webhookDeliveries)
        .set({
          status: "retrying",
          statusCode: result.statusCode ?? null,
          responseSnippet: result.responseSnippet ?? null,
          durationMs: result.durationMs,
          error: result.error ?? null,
          attempt: newAttempt,
          nextAttemptAt: new Date(Date.now() + nextDelay),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      retrying++;
    }
  }

  return {
    picked: claimed.length,
    succeeded,
    failed,
    retrying,
    dropped,
  };
}

// ============================================================
// Send one delivery
// ============================================================

type SendResult = {
  ok: boolean;
  statusCode?: number;
  responseSnippet?: string;
  durationMs: number;
  error?: string;
};

async function sendOne(input: {
  url: string;
  secret: string;
  payload: Record<string, unknown>;
  eventId: string;
  event: string;
}): Promise<SendResult> {
  const startedAt = Date.now();
  const body = JSON.stringify(input.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(input.secret, body, timestamp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await safePublicFetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "CSM-Webhooks/1.0",
        "x-csm-event": input.event,
        "x-csm-event-id": input.eventId,
        "x-csm-timestamp": String(timestamp),
        "x-csm-signature": signature,
      },
      body,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, MAX_RESPONSE_SNIPPET);
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      statusCode: res.status,
      responseSnippet: snippet,
      durationMs: Date.now() - startedAt,
      ...(ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: message.slice(0, 500),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// Replay (reentrega manual desde UI)
// ============================================================

export async function replayDelivery(workspaceId: string, deliveryId: string): Promise<void> {
  if (!db) return;
  const [original] = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(eq(webhookDeliveries.workspaceId, workspaceId), eq(webhookDeliveries.id, deliveryId)),
    )
    .limit(1);
  if (!original) return;
  await db.insert(webhookDeliveries).values({
    workspaceId,
    webhookId: original.webhookId,
    event: original.event,
    payload: original.payload as object,
    status: "pending",
    attempt: 0,
    maxAttempts: original.maxAttempts,
    nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[0]!),
  });
}

/** Test directo (sin guardar delivery), útil para /webhooks/{id}/test. */
export async function testWebhook(input: {
  url: string;
  secret: string;
  event: WebhookEvent;
  payload?: Record<string, unknown>;
}): Promise<SendResult> {
  return sendOne({
    url: input.url,
    secret: input.secret,
    eventId: crypto.randomUUID(),
    event: input.event,
    payload: {
      event: input.event,
      timestamp: new Date().toISOString(),
      test: true,
      data: input.payload ?? { hello: "world" },
    },
  });
}

// Helper exportable para descartar pendings antiguas
export async function pruneOldDeliveries(daysOld = 30) {
  if (!db) return 0;
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return await deleteReturningCount(
    webhookDeliveries,
    and(
      sql`${webhookDeliveries.createdAt} < ${cutoff}`,
      or(
        eq(webhookDeliveries.status, "success"),
        eq(webhookDeliveries.status, "failed"),
        eq(webhookDeliveries.status, "dropped"),
      ),
    )!,
  );
}
