import { db } from "@/db/client";
import {
  type EditorialAssignmentRole,
  entries,
  entryAssignments,
  entryWorkflowEvents,
  workspaces,
} from "@/db/schema";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { emitNotificationsBatch } from "./notifications";

/**
 * Evalúa el deadline efectivo de una asignación.
 * Reglas:
 *  - dueAt explícito gana.
 *  - else: createdAt + slaHours (si slaHours).
 *  - else: NULL (sin SLA).
 */
export function effectiveDueAt(a: {
  dueAt: Date | null;
  slaHours: number | null;
  createdAt: Date;
}): Date | null {
  if (a.dueAt) return a.dueAt;
  if (a.slaHours && a.slaHours > 0) {
    return new Date(a.createdAt.getTime() + a.slaHours * 3600 * 1000);
  }
  return null;
}

export type SlaState = "ok" | "warning" | "breach";
const WARNING_THRESHOLD_HOURS = 24;

export function slaState(due: Date | null, now: Date = new Date()): SlaState {
  if (!due) return "ok";
  const ms = due.getTime() - now.getTime();
  if (ms < 0) return "breach";
  if (ms < WARNING_THRESHOLD_HOURS * 3600 * 1000) return "warning";
  return "ok";
}

/**
 * Cron-style sweep: detecta asignaciones activas con deadline pasado y emite
 * notification breach (idempotente: marcamos breach via workflow event check).
 *
 * Devuelve número de notifications creadas.
 */
export async function sweepSlaBreaches(): Promise<{ scanned: number; emitted: number }> {
  if (!db) return { scanned: 0, emitted: 0 };
  const now = new Date();

  // Asignaciones activas con due_at <= now (y slaHours-derived if dueAt null).
  const candidatesRaw = await db
    .select({
      a: entryAssignments,
      entryTitle: entries.title,
      entryAuthorId: entries.authorId,
    })
    .from(entryAssignments)
    .innerJoin(entries, eq(entries.id, entryAssignments.entryId))
    .where(
      and(
        isNull(entryAssignments.completedAt),
        or(
          lte(entryAssignments.dueAt, now),
          // Para slaHours-derived: createdAt + sla_hours hours <= now.
          // Postgres syntax: createdAt + slaHours * interval '1 hour'.
          sql`(${entryAssignments.dueAt} IS NULL AND ${entryAssignments.slaHours} IS NOT NULL AND ${entryAssignments.createdAt} + ${entryAssignments.slaHours} * interval '1 hour' <= ${now})`,
        ),
      ),
    );

  if (candidatesRaw.length === 0) return { scanned: 0, emitted: 0 };

  // Filter out assignments that already had sla.breach emitted (audit log check).
  // F9c.8a fix C3: filtrar por assignmentId IN (…) y agrupar por workspaceId
  // para no leer todo el log histórico cross-tenant.
  const ids = candidatesRaw.map((c) => c.a.id);
  const previouslyBreached = await db
    .select({ assignmentId: sql<string>`(${entryWorkflowEvents.payload}->>'assignmentId')` })
    .from(entryWorkflowEvents)
    .where(
      and(
        eq(entryWorkflowEvents.type, "sla.breach"),
        sql`(${entryWorkflowEvents.payload}->>'assignmentId') = ANY(${ids})`,
      ),
    );
  const breachedSet = new Set<string>(
    previouslyBreached.map((p) => p.assignmentId).filter(Boolean),
  );

  const newBreaches = candidatesRaw.filter((c) => !breachedSet.has(c.a.id));

  let emitted = 0;
  for (const b of newBreaches) {
    await db.insert(entryWorkflowEvents).values({
      workspaceId: b.a.workspaceId,
      entryId: b.a.entryId,
      type: "sla.breach",
      targetUserId: b.a.assigneeId,
      payload: { assignmentId: b.a.id, role: b.a.role },
    });
    const recipients = new Set<string>();
    recipients.add(b.a.assigneeId);
    if (b.entryAuthorId && b.entryAuthorId !== b.a.assigneeId) recipients.add(b.entryAuthorId);
    await emitNotificationsBatch(
      Array.from(recipients).map((uid) => ({
        workspaceId: b.a.workspaceId,
        userId: uid,
        type: "entry.sla_breach" as const,
        payload: {
          entryId: b.a.entryId,
          entryTitle: b.entryTitle,
          role: b.a.role as EditorialAssignmentRole,
          dueAt: effectiveDueAt(b.a)?.toISOString(),
        },
      })),
    );
    emitted += recipients.size;
  }

  // Avoid unused import warning.
  void workspaces;

  return { scanned: candidatesRaw.length, emitted };
}
