/**
 * Tipos de un Automation visual.
 *
 * Una Automation = trigger + (conditions) + lista ordenada de steps.
 * Cada step ejecuta una Action y persiste su input/output en automation_steps.
 * Los outputs de steps anteriores son referenciables vía template strings:
 * `{{steps.0.output.foo}}` o `{{trigger.payload.bar}}`.
 */

import type { WebhookEvent } from "@/webhooks/events";

export type TriggerType = "event" | "form_submit" | "cron" | "webhook_in" | "manual";

export type Trigger =
  | { type: "event"; event: WebhookEvent | "*" }
  | { type: "form_submit"; formId: string }
  | { type: "cron"; schedule: string }
  | { type: "webhook_in" }
  | { type: "manual" };

/** Una condición que se evalúa contra el contexto actual. */
export type Condition = {
  /** Path JSON-pointer-ish: "trigger.payload.score" o "steps.0.output.ok". */
  path: string;
  op: "eq" | "neq" | "gt" | "lt" | "contains" | "empty" | "not_empty" | "in";
  value?: unknown;
};

export type ConditionGroup = {
  all?: Condition[];
  any?: Condition[];
};

/** Tipos de step soportados. */
export type StepType =
  | "webhook"
  | "email"
  | "slack"
  | "ai"
  | "http"
  | "db.entry.create"
  | "db.entry.update"
  | "db.subscriber.add"
  | "db.comment.create"
  | "sleep"
  | "branch";

export type WebhookStep = {
  id: string;
  name?: string;
  type: "webhook";
  /** URL pública (validada SSRF en runtime). Soporta {{templates}}. */
  url: string;
  /** Método. Default POST. */
  method?: "POST" | "PUT" | "PATCH";
  /** Headers extra. */
  headers?: Record<string, string>;
  /** Body string o JSON. {{templates}} interpolados. */
  body?: string;
};

export type EmailStep = {
  id: string;
  name?: string;
  type: "email";
  to: string;
  subject: string;
  body: string;
  /** "html" o "text". Default html. */
  format?: "html" | "text";
};

export type SlackStep = {
  id: string;
  name?: string;
  type: "slack";
  /** Incoming webhook URL de Slack. */
  webhookUrl: string;
  text: string;
  channel?: string;
};

export type AiStep = {
  id: string;
  name?: string;
  type: "ai";
  /** "summarize" | "extract_json" | "classify". */
  task: "summarize" | "extract_json" | "classify";
  input: string;
  /** Para extract_json: schema esperado. */
  schema?: Record<string, unknown>;
  /** Para classify: lista de etiquetas. */
  labels?: string[];
};

export type HttpStep = {
  id: string;
  name?: string;
  type: "http";
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  /** Si responde JSON, lo parseamos al output. Default true. */
  parseJson?: boolean;
};

export type DbEntryCreateStep = {
  id: string;
  name?: string;
  type: "db.entry.create";
  collectionSlug: string;
  title: string;
  bodyText?: string;
  status?: "draft" | "published";
  fields?: Record<string, unknown>;
};

export type DbEntryUpdateStep = {
  id: string;
  name?: string;
  type: "db.entry.update";
  entryId: string;
  patch: Record<string, unknown>;
};

export type DbSubscriberAddStep = {
  id: string;
  name?: string;
  type: "db.subscriber.add";
  email: string;
  name_field?: string;
  tags?: string[];
};

export type DbCommentCreateStep = {
  id: string;
  name?: string;
  type: "db.comment.create";
  entryId: string;
  authorName: string;
  authorEmail: string;
  body: string;
};

export type SleepStep = {
  id: string;
  name?: string;
  type: "sleep";
  ms: number;
};

export type BranchStep = {
  id: string;
  name?: string;
  type: "branch";
  /** Si las condiciones se cumplen, ejecutamos `then`; si no, `else`. */
  conditions: ConditionGroup;
  then: Step[];
  else?: Step[];
};

export type Step =
  | WebhookStep
  | EmailStep
  | SlackStep
  | AiStep
  | HttpStep
  | DbEntryCreateStep
  | DbEntryUpdateStep
  | DbSubscriberAddStep
  | DbCommentCreateStep
  | SleepStep
  | BranchStep;

export type AutomationDefinition = {
  triggerType: TriggerType;
  trigger: Trigger;
  conditions?: ConditionGroup;
  steps: Step[];
};

export const STEP_LABELS: Record<StepType, string> = {
  webhook: "Webhook HTTP",
  email: "Enviar email",
  slack: "Enviar a Slack",
  ai: "IA",
  http: "HTTP fetch",
  "db.entry.create": "Crear entrada",
  "db.entry.update": "Actualizar entrada",
  "db.subscriber.add": "Suscribir email",
  "db.comment.create": "Crear comentario",
  sleep: "Esperar",
  branch: "Si / Si no",
};

export const STEP_GROUPS: Array<{ label: string; types: StepType[] }> = [
  {
    label: "Notificar",
    types: ["webhook", "email", "slack"],
  },
  {
    label: "Inteligencia",
    types: ["ai"],
  },
  {
    label: "Datos",
    types: ["db.entry.create", "db.entry.update", "db.subscriber.add", "db.comment.create"],
  },
  {
    label: "Control",
    types: ["sleep", "branch", "http"],
  },
];

/** Catálogo de triggers para la UI. */
export const TRIGGER_TYPES: Array<{
  value: TriggerType;
  label: string;
  description: string;
}> = [
  {
    value: "event",
    label: "Evento de la plataforma",
    description: "Entrada publicada, comentario creado, media subido…",
  },
  {
    value: "form_submit",
    label: "Envío de formulario",
    description: "Cuando llega una submission en un form concreto",
  },
  {
    value: "cron",
    label: "Programado (cron)",
    description: "Ejecuta en un horario recurrente",
  },
  {
    value: "webhook_in",
    label: "Webhook entrante",
    description: "Trigger via POST a /api/automations/{id}/trigger",
  },
  {
    value: "manual",
    label: "Manual",
    description: "Lanzar a mano desde el admin",
  },
];
