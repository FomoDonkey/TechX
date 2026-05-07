/**
 * CRUD de webhooks + listado de deliveries (admin UI).
 */

import { randomBytes } from "node:crypto";
import { db, dialect } from "@/db/client";
import { countInt, insertReturning } from "@/db/dialect";
import { type Webhook, webhookDeliveries, webhooks } from "@/db/schema";
import { assertPublicUrl } from "@/lib/ssrf";
import type { WebhookEvent } from "@/webhooks/events";
import { and, desc, eq, sql } from "drizzle-orm";

export type WebhookListItem = Pick<
  Webhook,
  | "id"
  | "name"
  | "description"
  | "events"
  | "url"
  | "active"
  | "lastSuccessAt"
  | "lastFailureAt"
  | "createdAt"
> & {
  /** "success" | "failed" | null */
  lastDeliveryStatus: string | null;
  deliveriesTotal: number;
};

export async function listWebhooks(workspaceId: string): Promise<WebhookListItem[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      description: webhooks.description,
      events: webhooks.events,
      url: webhooks.url,
      active: webhooks.active,
      lastSuccessAt: webhooks.lastSuccessAt,
      lastFailureAt: webhooks.lastFailureAt,
      createdAt: webhooks.createdAt,
      deliveriesTotal:
        dialect === "postgres"
          ? sql<number>`(
        SELECT count(*)::int FROM ${webhookDeliveries}
        WHERE ${webhookDeliveries.webhookId} = ${webhooks.id}
      )`
          : sql<number>`(
        SELECT CAST(COUNT(*) AS SIGNED) FROM ${webhookDeliveries}
        WHERE ${webhookDeliveries.webhookId} = ${webhooks.id}
      )`,
      // `${col}::text` cast PG-only para coaccionar enum/varchar a string. En MySQL
      // las columnas string ya son string (status es varchar), no hace falta cast.
      lastDeliveryStatus:
        dialect === "postgres"
          ? sql<string | null>`(
        SELECT ${webhookDeliveries.status}::text FROM ${webhookDeliveries}
        WHERE ${webhookDeliveries.webhookId} = ${webhooks.id}
        ORDER BY ${webhookDeliveries.createdAt} DESC LIMIT 1
      )`
          : sql<string | null>`(
        SELECT ${webhookDeliveries.status} FROM ${webhookDeliveries}
        WHERE ${webhookDeliveries.webhookId} = ${webhooks.id}
        ORDER BY ${webhookDeliveries.createdAt} DESC LIMIT 1
      )`,
    })
    .from(webhooks)
    .where(eq(webhooks.workspaceId, workspaceId))
    .orderBy(desc(webhooks.createdAt));
  return rows;
}

export async function getWebhookById(workspaceId: string, id: string) {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.id, id)))
    .limit(1);
  return row ?? null;
}

export async function listDeliveries(workspaceId: string, webhookId: string, limit = 50) {
  if (!db) return [];
  return db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.workspaceId, workspaceId),
        eq(webhookDeliveries.webhookId, webhookId),
      ),
    )
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

export type CreateWebhookInput = {
  workspaceId: string;
  name: string;
  description?: string;
  url: string;
  events: WebhookEvent[] | ["*"];
  maxAttempts?: number;
  active?: boolean;
  createdById?: string | null;
};

export async function createWebhook(input: CreateWebhookInput) {
  if (!db) throw new Error("DB no configurada");
  await assertPublicUrl(input.url);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const newId = crypto.randomUUID();
  const fullRow = (await insertReturning(webhooks, {
    id: newId,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description ?? null,
    url: input.url,
    secret,
    events: input.events,
    maxAttempts: input.maxAttempts ?? 5,
    active: input.active ?? true,
    createdById: input.createdById ?? null,
  })) as Webhook;
  if (!fullRow) throw new Error("No se pudo crear el webhook");
  return { id: fullRow.id, secret };
}

export async function updateWebhook(input: {
  workspaceId: string;
  id: string;
  name?: string;
  description?: string;
  url?: string;
  events?: WebhookEvent[] | ["*"];
  maxAttempts?: number;
  active?: boolean;
}) {
  if (!db) throw new Error("DB no configurada");
  if (input.url) await assertPublicUrl(input.url);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.url !== undefined) updates.url = input.url;
  if (input.events !== undefined) updates.events = input.events;
  if (input.maxAttempts !== undefined) updates.maxAttempts = input.maxAttempts;
  if (input.active !== undefined) updates.active = input.active;
  await db
    .update(webhooks)
    .set(updates)
    .where(and(eq(webhooks.workspaceId, input.workspaceId), eq(webhooks.id, input.id)));
}

export async function deleteWebhook(workspaceId: string, id: string) {
  if (!db) throw new Error("DB no configurada");
  await db.delete(webhooks).where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.id, id)));
}

export async function rotateWebhookSecret(workspaceId: string, id: string): Promise<string> {
  if (!db) throw new Error("DB no configurada");
  const newSecret = `whsec_${randomBytes(24).toString("base64url")}`;
  await db
    .update(webhooks)
    .set({ secret: newSecret, updatedAt: new Date() })
    .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.id, id)));
  return newSecret;
}

export async function countByEvent(workspaceId: string) {
  if (!db) return new Map<string, number>();
  const rows = await db
    .select({ event: webhookDeliveries.event, n: countInt() })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.workspaceId, workspaceId))
    .groupBy(webhookDeliveries.event);
  return new Map(rows.map((r) => [r.event, r.n]));
}
