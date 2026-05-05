import type {
  EditorialAssignmentRole,
  EditorialEventType,
  EditorialThreadStatus,
  EntryPriority,
  EntryStatus,
} from "@/db/schema";

export type {
  EditorialAssignmentRole,
  EditorialEventType,
  EditorialThreadStatus,
  EntryPriority,
  EntryStatus,
};

export type EditorialResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export const ALL_ENTRY_STATUSES: EntryStatus[] = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
];

export const STATUS_LABELS_ES: Record<EntryStatus, string> = {
  draft: "Borrador",
  review: "Revisión",
  approved: "Aprobado",
  scheduled: "Programado",
  published: "Publicado",
  archived: "Archivado",
};

export const PRIORITY_LABELS_ES: Record<EntryPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_RANK: Record<EntryPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

export const ASSIGNMENT_ROLE_LABELS_ES: Record<EditorialAssignmentRole, string> = {
  writer: "Redactor",
  reviewer: "Revisor",
  approver: "Aprobador",
};

/**
 * Workflow forward-graph. Una transición está permitida si el `from` está
 * directamente conectado al `to`. Dirección inversa (publish → draft) requiere
 * `unpublish` explícito y rol elevated; va por su propia función.
 */
export const FORWARD_TRANSITIONS: Record<EntryStatus, EntryStatus[]> = {
  draft: ["review", "scheduled", "published", "archived"],
  review: ["approved", "draft", "archived"],
  approved: ["scheduled", "published", "draft", "archived"],
  scheduled: ["published", "draft", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
};

/**
 * Notificaciones tipadas (string para tabla `notifications` existente).
 * Documento aquí los `type` que el bell sabe renderizar.
 */
export const EDITORIAL_NOTIFICATION_TYPES = [
  "entry.assigned",
  "entry.unassigned",
  "entry.mention",
  "entry.status_changed",
  "entry.sla_breach",
  "entry.due_soon",
  "editorial.comment.added",
  "editorial.comment.resolved",
] as const;

export type EditorialNotificationType = (typeof EDITORIAL_NOTIFICATION_TYPES)[number];

export type NotificationPayload = {
  entryId?: string;
  entryTitle?: string;
  threadId?: string;
  messagePreview?: string;
  fromStatus?: EntryStatus;
  toStatus?: EntryStatus;
  role?: EditorialAssignmentRole;
  actorId?: string;
  actorName?: string;
  dueAt?: string;
  workspaceSlug?: string;
};
