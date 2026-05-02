/**
 * Plantillas pre-built de automations. Importables desde el admin.
 */

import type { AutomationDefinition } from "./types";

export type AutomationTemplate = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: "publishing" | "engagement" | "moderation" | "growth";
  definition: AutomationDefinition;
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    slug: "slack-on-publish",
    name: "Avisar a Slack al publicar",
    description: "Cuando se publica una entrada, manda un mensaje al canal de Slack del equipo.",
    icon: "💬",
    category: "publishing",
    definition: {
      triggerType: "event",
      trigger: { type: "event", event: "entry.published" },
      steps: [
        {
          id: "s1",
          type: "slack",
          name: "Notificar a Slack",
          webhookUrl: "https://hooks.slack.com/services/REEMPLAZA",
          text: "📝 Nueva publicación: *{{trigger.payload.title}}* — /{{trigger.payload.slug}}",
        },
      ],
    },
  },
  {
    slug: "email-on-form-submit",
    name: "Email al recibir un envío",
    description: "Manda un email automático al recibir cualquier envío de un form.",
    icon: "📧",
    category: "engagement",
    definition: {
      triggerType: "form_submit",
      trigger: { type: "form_submit", formId: "REEMPLAZA-CON-FORM-ID" },
      steps: [
        {
          id: "s1",
          type: "email",
          name: "Email a tí",
          to: "tu@email.com",
          subject: "Nuevo envío en el formulario",
          body: "<h2>Nueva submission</h2><pre>{{trigger.payload.data}}</pre>",
        },
      ],
    },
  },
  {
    slug: "ai-classify-comment",
    name: "Clasificar comentario con IA",
    description: "Cuando llega un comentario, lo clasifica con IA y lo marca como spam si procede.",
    icon: "🤖",
    category: "moderation",
    definition: {
      triggerType: "event",
      trigger: { type: "event", event: "comment.created" },
      steps: [
        {
          id: "s1",
          type: "ai",
          name: "Clasificar",
          task: "classify",
          input: "{{trigger.payload.body}}",
          labels: ["legítimo", "spam", "ofensivo"],
        },
        {
          id: "s2",
          type: "branch",
          name: "Si es spam",
          conditions: { all: [{ path: "steps.0.output.label", op: "eq", value: "spam" }] },
          // biome-ignore lint/suspicious/noThenProperty: branch shape mirrors if/then/else, not Promise
          then: [
            {
              id: "s2a",
              type: "webhook",
              name: "Notificar al admin",
              url: "https://example.com/spam-detected",
              body: '{"comment":"{{trigger.payload.body}}"}',
            },
          ],
        },
      ],
    },
  },
  {
    slug: "subscribe-from-form",
    name: "Suscribir al newsletter desde form",
    description: "Cuando se rellena un form de contacto con email, lo añade a suscriptores.",
    icon: "📨",
    category: "growth",
    definition: {
      triggerType: "form_submit",
      trigger: { type: "form_submit", formId: "REEMPLAZA-CON-FORM-ID" },
      steps: [
        {
          id: "s1",
          type: "db.subscriber.add",
          name: "Suscribir",
          email: "{{trigger.payload.data.email}}",
          name_field: "{{trigger.payload.data.nombre}}",
          tags: ["form-contacto"],
        },
      ],
    },
  },
  {
    slug: "summary-on-publish",
    name: "Resumen IA al publicar",
    description: "Genera un resumen IA de la entrada y lo guarda como excerpt vía DB update.",
    icon: "✨",
    category: "publishing",
    definition: {
      triggerType: "event",
      trigger: { type: "event", event: "entry.published" },
      steps: [
        {
          id: "s1",
          type: "ai",
          name: "Resumir",
          task: "summarize",
          input: "{{trigger.payload.bodyText}}",
        },
        {
          id: "s2",
          type: "db.entry.update",
          name: "Guardar excerpt",
          entryId: "{{trigger.payload.id}}",
          patch: { excerpt: "{{steps.0.output.summary}}" },
        },
      ],
    },
  },
];

export function getAutomationTemplate(slug: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.slug === slug);
}
