/**
 * Listener: cuando ocurren eventos en la plataforma (webhook events, form
 * submissions), busca automations matching y dispara runs.
 *
 * Llamado desde:
 *   - src/forms/submit.ts → triggerFormSubmit()
 *   - src/webhooks/dispatcher.ts → triggerEventForAutomations()
 */

import { db } from "@/db/client";
import { automations } from "@/db/schema";
import type { WebhookEvent } from "@/webhooks/events";
import { and, eq } from "drizzle-orm";
import { startRun } from "./engine";
import type { Trigger } from "./types";

export async function triggerEvent(input: {
  workspaceId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
}): Promise<{ matched: number; started: string[] }> {
  if (!db) return { matched: 0, started: [] };
  const subs = await db
    .select({
      id: automations.id,
      trigger: automations.trigger,
      triggerType: automations.triggerType,
    })
    .from(automations)
    .where(
      and(
        eq(automations.workspaceId, input.workspaceId),
        eq(automations.active, true),
        eq(automations.triggerType, "event"),
      ),
    );

  const matched = subs.filter((s) => {
    const t = s.trigger as Trigger;
    if (t.type !== "event") return false;
    return t.event === "*" || t.event === input.event;
  });

  const started: string[] = [];
  for (const m of matched) {
    const id = await startRun({
      workspaceId: input.workspaceId,
      automationId: m.id,
      triggerEvent: input.event,
      triggerPayload: input.payload,
    });
    if (id) started.push(id);
  }
  return { matched: matched.length, started };
}

export async function triggerFormSubmit(input: {
  workspaceId: string;
  formId: string;
  submissionId: string;
  data: Record<string, unknown>;
}): Promise<{ matched: number; started: string[] }> {
  if (!db) return { matched: 0, started: [] };
  const subs = await db
    .select({ id: automations.id, trigger: automations.trigger })
    .from(automations)
    .where(
      and(
        eq(automations.workspaceId, input.workspaceId),
        eq(automations.active, true),
        eq(automations.triggerType, "form_submit"),
      ),
    );

  const matched = subs.filter((s) => {
    const t = s.trigger as Trigger;
    return t.type === "form_submit" && t.formId === input.formId;
  });

  const payload = {
    formId: input.formId,
    submissionId: input.submissionId,
    data: input.data,
  };
  const started: string[] = [];
  for (const m of matched) {
    const id = await startRun({
      workspaceId: input.workspaceId,
      automationId: m.id,
      triggerEvent: "form.submitted",
      triggerPayload: payload,
    });
    if (id) started.push(id);
  }
  return { matched: matched.length, started };
}

/** Disparado por trigger manual desde el admin. */
export async function triggerManual(input: {
  workspaceId: string;
  automationId: string;
  payload?: unknown;
}): Promise<string | null> {
  return startRun({
    workspaceId: input.workspaceId,
    automationId: input.automationId,
    triggerEvent: "manual",
    triggerPayload: input.payload,
  });
}

/** Disparado por POST a /api/automations/[id]/trigger con secret HMAC. */
export async function triggerWebhookIn(input: {
  workspaceId: string;
  automationId: string;
  payload: unknown;
}): Promise<string | null> {
  return startRun({
    workspaceId: input.workspaceId,
    automationId: input.automationId,
    triggerEvent: "webhook.in",
    triggerPayload: input.payload,
  });
}
