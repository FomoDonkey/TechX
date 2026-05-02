/**
 * Catálogo de eventos disparables. Cada evento tiene un tipo de payload concreto.
 * El dispatcher emite por nombre; los webhooks se suscriben con events:["name"|"*"].
 */

export const WEBHOOK_EVENTS = [
  "entry.created",
  "entry.updated",
  "entry.published",
  "entry.unpublished",
  "entry.deleted",
  "page.published",
  "page.unpublished",
  "comment.created",
  "comment.approved",
  "comment.spam",
  "form.submitted",
  "media.uploaded",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "entry.created": "Entrada creada",
  "entry.updated": "Entrada actualizada",
  "entry.published": "Entrada publicada",
  "entry.unpublished": "Entrada despublicada",
  "entry.deleted": "Entrada eliminada",
  "page.published": "Página publicada",
  "page.unpublished": "Página despublicada",
  "comment.created": "Comentario creado",
  "comment.approved": "Comentario aprobado",
  "comment.spam": "Comentario marcado como spam",
  "form.submitted": "Formulario enviado",
  "media.uploaded": "Asset subido",
};

export const WEBHOOK_EVENT_GROUPS: Array<{ label: string; events: WebhookEvent[] }> = [
  {
    label: "Entradas",
    events: [
      "entry.created",
      "entry.updated",
      "entry.published",
      "entry.unpublished",
      "entry.deleted",
    ],
  },
  { label: "Páginas", events: ["page.published", "page.unpublished"] },
  { label: "Comentarios", events: ["comment.created", "comment.approved", "comment.spam"] },
  { label: "Formularios", events: ["form.submitted"] },
  { label: "Media", events: ["media.uploaded"] },
];

/** Backoff exponencial: cada índice representa el delay para ese intento. */
export const RETRY_DELAYS_MS = [
  1_000, // intento 1 → casi inmediato (cron lo recoge en próximo tick)
  5_000, // intento 2
  25_000, // intento 3
  120_000, // intento 4 (2 min)
  600_000, // intento 5 (10 min)
];
