/**
 * Registry de actions ejecutables. Cada action recibe su step renderizado
 * (templates ya interpolados), el contexto del run y devuelve un output.
 *
 * Si lanza, el step se marca como failed y el run aborta (a menos que esté
 * dentro de un branch).
 */

import { chat } from "@/ai/provider";
import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import { collections, comments, entries, subscribers } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { slugify } from "@/lib/slug";
import { safePublicFetch } from "@/lib/ssrf";
import { and, eq } from "drizzle-orm";
import type {
  AiStep,
  DbCommentCreateStep,
  DbEntryCreateStep,
  DbEntryUpdateStep,
  DbSubscriberAddStep,
  EmailStep,
  HttpStep,
  SlackStep,
  Step,
  WebhookStep,
} from "./types";

export type ActionContext = {
  workspaceId: string;
  runId: string;
};

export type ActionResult = {
  output: unknown;
};

const HTTP_TIMEOUT_MS = 15_000;

async function execWebhook(step: WebhookStep, ctx: ActionContext): Promise<ActionResult> {
  if (!step.url) throw new Error("URL vacía");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await safePublicFetch(step.url, {
      method: step.method ?? "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "CSM-Automations/1.0",
        "x-csm-run-id": ctx.runId,
        ...(step.headers ?? {}),
      },
      body: step.body ?? "",
      signal: controller.signal,
    });
    const text = (await res.text().catch(() => "")).slice(0, 4096);
    return {
      output: { ok: res.status >= 200 && res.status < 300, status: res.status, body: text },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function execEmail(step: EmailStep, _ctx: ActionContext): Promise<ActionResult> {
  if (!step.to.includes("@")) throw new Error("Destinatario inválido");
  const isHtml = (step.format ?? "html") === "html";
  const r = await sendEmail({
    to: step.to,
    subject: step.subject,
    html: isHtml ? step.body : `<pre>${escapeHtml(step.body)}</pre>`,
    text: isHtml ? undefined : step.body,
  });
  return { output: { ok: r.ok, id: r.id, mocked: r.mocked } };
}

async function execSlack(step: SlackStep, _ctx: ActionContext): Promise<ActionResult> {
  if (!step.webhookUrl) throw new Error("Slack webhook URL vacío");
  const body: Record<string, unknown> = { text: step.text };
  if (step.channel) body.channel = step.channel;
  const res = await safePublicFetch(step.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { output: { ok: res.ok, status: res.status } };
}

async function execHttp(step: HttpStep, _ctx: ActionContext): Promise<ActionResult> {
  if (!step.url) throw new Error("URL vacía");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const init: RequestInit = {
      method: step.method ?? "GET",
      headers: { "user-agent": "CSM-Automations/1.0", ...(step.headers ?? {}) },
      signal: controller.signal,
    };
    if (step.body && step.method && step.method !== "GET") init.body = step.body;
    const res = await safePublicFetch(step.url, init);
    const text = (await res.text().catch(() => "")).slice(0, 8192);
    let parsed: unknown = text;
    if (step.parseJson !== false) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // mantener text
      }
    }
    return {
      output: {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        body: parsed,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function execAi(step: AiStep, _ctx: ActionContext): Promise<ActionResult> {
  if (!step.input) throw new Error("Input vacío");
  if (step.task === "summarize") {
    const r = await chat({
      messages: [
        {
          role: "user",
          content: `Resume este texto en 2-3 frases en español:\n\n${step.input}`,
        },
      ],
      maxTokens: 200,
      temperature: 0.3,
    });
    return { output: { summary: r.text.trim(), provider: r.provider } };
  }
  if (step.task === "classify") {
    const labels = step.labels ?? [];
    const r = await chat({
      messages: [
        {
          role: "user",
          content: `Clasifica este texto en una de estas etiquetas: ${labels.join(", ")}.\nDevuelve solo la etiqueta exacta.\n\nTexto:\n${step.input}`,
        },
      ],
      maxTokens: 30,
      temperature: 0,
    });
    const found =
      labels.find((l) => r.text.toLowerCase().includes(l.toLowerCase())) ?? labels[0] ?? "";
    return { output: { label: found, raw: r.text.trim() } };
  }
  if (step.task === "extract_json") {
    const schemaStr = step.schema ? JSON.stringify(step.schema) : "{}";
    const r = await chat({
      messages: [
        {
          role: "user",
          content: `Extrae los datos del siguiente texto siguiendo este schema JSON: ${schemaStr}.\nDevuelve solo JSON válido sin texto adicional.\n\nTexto:\n${step.input}`,
        },
      ],
      maxTokens: 600,
      temperature: 0,
    });
    const cleaned = r.text.replace(/^```json\n?|\n?```$/g, "").trim();
    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch {
      json = { error: "no_json", raw: cleaned };
    }
    return { output: json };
  }
  throw new Error(`Tarea AI desconocida: ${step.task}`);
}

async function execDbEntryCreate(
  step: DbEntryCreateStep,
  ctx: ActionContext,
): Promise<ActionResult> {
  if (!db) throw new Error("DB no disponible");
  const [coll] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(eq(collections.workspaceId, ctx.workspaceId), eq(collections.slug, step.collectionSlug)),
    )
    .limit(1);
  if (!coll) throw new Error(`Colección no encontrada: ${step.collectionSlug}`);
  const id = crypto.randomUUID();
  const fullRow = (await insertReturning(entries, {
    id,
    workspaceId: ctx.workspaceId,
    collectionId: coll.id,
    title: step.title,
    slug: slugify(step.title) || `entry-${Date.now()}`,
    bodyText: step.bodyText ?? null,
    status: step.status ?? "draft",
    fields: step.fields ?? null,
  })) as typeof entries.$inferSelect;
  const row = { id: fullRow.id, slug: fullRow.slug };
  return { output: row };
}

async function execDbEntryUpdate(
  step: DbEntryUpdateStep,
  ctx: ActionContext,
): Promise<ActionResult> {
  if (!db) throw new Error("DB no disponible");
  await db
    .update(entries)
    .set(step.patch as Partial<typeof entries.$inferInsert>)
    .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.id, step.entryId)));
  const [row] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.id, step.entryId)))
    .limit(1);
  if (!row) throw new Error("Entrada no encontrada");
  return { output: { id: row.id } };
}

async function execDbSubscriberAdd(
  step: DbSubscriberAddStep,
  ctx: ActionContext,
): Promise<ActionResult> {
  if (!db) throw new Error("DB no disponible");
  if (!step.email.includes("@")) throw new Error("Email inválido");
  const email = step.email.toLowerCase();
  // Comprobamos si ya existe (por unique (workspaceId, email)). Sustituye al
  // `onConflictDoNothing.returning()` Postgres-only.
  const existing = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(and(eq(subscribers.workspaceId, ctx.workspaceId), eq(subscribers.email, email)))
    .limit(1);
  if (existing[0]) {
    return { output: { id: existing[0].id, created: false } };
  }
  try {
    const id = crypto.randomUUID();
    await db.insert(subscribers).values({
      id,
      workspaceId: ctx.workspaceId,
      email,
      name: step.name_field ?? null,
      tags: step.tags ?? null,
      source: "automation",
    });
    return { output: { id, created: true } };
  } catch {
    // Race: otro proceso insertó entre nuestro SELECT y el INSERT (unique
    // violation). Re-leemos para devolver el id ganador.
    const after = await db
      .select({ id: subscribers.id })
      .from(subscribers)
      .where(and(eq(subscribers.workspaceId, ctx.workspaceId), eq(subscribers.email, email)))
      .limit(1);
    return { output: { id: after[0]?.id ?? null, created: false } };
  }
}

async function execDbCommentCreate(
  step: DbCommentCreateStep,
  ctx: ActionContext,
): Promise<ActionResult> {
  if (!db) throw new Error("DB no disponible");
  const id = crypto.randomUUID();
  const fullRow = (await insertReturning(comments, {
    id,
    workspaceId: ctx.workspaceId,
    entryId: step.entryId,
    authorName: step.authorName,
    authorEmail: step.authorEmail,
    body: step.body,
    status: "pending",
  })) as typeof comments.$inferSelect;
  const row = { id: fullRow.id };
  return { output: row };
}

export async function executeStep(step: Step, ctx: ActionContext): Promise<ActionResult> {
  switch (step.type) {
    case "webhook":
      return execWebhook(step, ctx);
    case "email":
      return execEmail(step, ctx);
    case "slack":
      return execSlack(step, ctx);
    case "ai":
      return execAi(step, ctx);
    case "http":
      return execHttp(step, ctx);
    case "db.entry.create":
      return execDbEntryCreate(step, ctx);
    case "db.entry.update":
      return execDbEntryUpdate(step, ctx);
    case "db.subscriber.add":
      return execDbSubscriberAdd(step, ctx);
    case "db.comment.create":
      return execDbCommentCreate(step, ctx);
    case "sleep":
      // El engine maneja sleep especial (defer al cron). Aquí no se debería llegar.
      throw new Error("sleep debe manejarse por el engine, no como action regular");
    case "branch":
      throw new Error("branch debe manejarse por el engine, no como action regular");
    default: {
      const _exhaust: never = step;
      throw new Error(`Tipo de step desconocido: ${(_exhaust as { type: string }).type}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
