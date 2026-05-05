import { db } from "@/db/client";
import { atomicClaim } from "@/db/dialect";
import {
  type Collection,
  type EntryStatus,
  collections,
  entries,
  entryAssignments,
  entryWorkflowEvents,
  users,
} from "@/db/schema";
import { type Role, can } from "@/lib/workspace";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, isNull } from "drizzle-orm";
import { getActiveAssignee } from "./assignments";
import { emitNotificationsBatch } from "./notifications";
import { type EditorialResult, FORWARD_TRANSITIONS } from "./types";

/**
 * Reglas de rol mínimo por target status.
 *  - draft / archived: editor
 *  - review: author (cualquiera puede pedir review)
 *  - approved: editor (revisa) — pero si requireApprover, sólo el approver asignado
 *  - scheduled / published: editor (con guards extra de approval si aplica)
 */
const MIN_ROLE_BY_TARGET: Record<EntryStatus, Role> = {
  draft: "author",
  review: "author",
  approved: "editor",
  scheduled: "editor",
  published: "editor",
  archived: "editor",
};

export type TransitionInput = {
  workspaceId: string;
  entryId: string;
  to: EntryStatus;
  actorId: string;
  actorRole: Role;
  /** Nota opcional explicando el cambio (queda en el audit log). */
  note?: string;
  /** Solo aplicable a `scheduled`: hora a programar. */
  scheduledAt?: Date | null;
  /** Si true, ignora guards de assignee/required (sólo admin/owner). Anti-bloqueo. */
  force?: boolean;
};

export type TransitionOk = {
  fromStatus: EntryStatus;
  toStatus: EntryStatus;
  scheduledAt: Date | null;
};

/**
 * Mueve un entry de un status a otro con guards completos. Devuelve EditorialResult
 * con el detalle de la transición o un error semántico.
 *
 * Anti-race: el UPDATE final usa `WHERE status = currentStatus` para evitar dos
 * transiciones simultáneas.
 */
export async function transitionStatus(
  input: TransitionInput,
): Promise<EditorialResult<TransitionOk>> {
  if (!db) return { ok: false, error: "Database not available" };

  // 1) Cargar entry + collection.
  const [row] = await db
    .select({ entry: entries, collection: collections })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .where(and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId)))
    .limit(1);
  if (!row) return { ok: false, error: "Entry no encontrada", code: "not_found" };
  const entry = row.entry;
  const collection = row.collection as Collection;

  if (entry.status === input.to) {
    return { ok: false, error: "El estado ya es el solicitado", code: "noop" };
  }

  // F9c.8a/9a fix H2/H5: entries en branch ≠ main no pueden saltar a approved/
  // scheduled/published — el path de publicación es el merge a main (F9b).
  // Para review/draft/archived sí permitimos transitions intra-branch (workflow editorial
  // dentro de la rama es válido). El audit trail de la branch se promueve al merge
  // (ver C-4 fix en branches/merge.ts).
  if (
    entry.branchId !== null &&
    (input.to === "approved" || input.to === "scheduled" || input.to === "published")
  ) {
    return {
      ok: false,
      error: "Las entradas en una branch no se pueden aprobar/publicar — primero mergea a main",
      code: "branch_publish_blocked",
    };
  }

  // 2) Rol mínimo.
  const minRole = MIN_ROLE_BY_TARGET[input.to];
  if (!input.force && !can(input.actorRole, minRole)) {
    return { ok: false, error: `Requiere rol >= ${minRole}`, code: "forbidden" };
  }

  // 3) Forward graph válido (a no ser que force).
  const allowed = FORWARD_TRANSITIONS[entry.status];
  if (!input.force && !allowed.includes(input.to)) {
    return {
      ok: false,
      error: `Transición ${entry.status} → ${input.to} no permitida`,
      code: "invalid_transition",
    };
  }

  const cfg = (collection.workflowConfig ?? {}) as {
    requireReviewer?: boolean;
    requireApprover?: boolean;
    skipReview?: boolean;
    allowSelfApprove?: boolean;
  };

  // 4) Guards específicos.
  // 4a) draft → review requiere reviewer si configurado.
  if (!input.force && input.to === "review" && cfg.requireReviewer) {
    const reviewer = await getActiveAssignee(input.workspaceId, input.entryId, "reviewer");
    if (!reviewer) {
      return {
        ok: false,
        error: "Esta colección requiere asignar un revisor antes de mandar a revisión",
        code: "missing_reviewer",
      };
    }
  }

  // 4b) review → approved: el actor debe ser approver asignado o admin (claim atómico abajo).
  if (!input.force && input.to === "approved") {
    if (cfg.requireApprover) {
      const approver = await getActiveAssignee(input.workspaceId, input.entryId, "approver");
      if (!approver) {
        return {
          ok: false,
          error: "Esta colección requiere asignar un aprobador",
          code: "missing_approver",
        };
      }
      if (approver.assigneeId !== input.actorId && !can(input.actorRole, "admin")) {
        return {
          ok: false,
          error: "Sólo el aprobador asignado puede aprobar",
          code: "not_assigned_approver",
        };
      }
      // Self-approve guard.
      if (
        cfg.allowSelfApprove === false &&
        entry.authorId &&
        entry.authorId === approver.assigneeId &&
        !can(input.actorRole, "admin")
      ) {
        return {
          ok: false,
          error: "El autor no puede aprobar su propia entrada",
          code: "self_approve_blocked",
        };
      }
    }
    // Lock atómico para evitar doble-approve concurrente.
    const lockRes = await atomicClaim<{
      id: string;
      workspaceId: string;
      lockedForApprovalAt: Date | null;
    }>(entries, {
      where: and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId))!,
      precondition: (row) => row.lockedForApprovalAt === null,
      set: {
        lockedForApprovalAt: new Date(),
        lockedForApprovalById: input.actorId,
      },
    });
    if (!lockRes) {
      return {
        ok: false,
        error: "Otro aprobador está procesando esta entrada",
        code: "lock_conflict",
      };
    }
  }

  // 4c) scheduled requiere scheduledAt en el futuro.
  let nextScheduledAt: Date | null = entry.scheduledAt ?? null;
  if (input.to === "scheduled") {
    const candidate = input.scheduledAt ?? entry.scheduledAt;
    if (!candidate) {
      return {
        ok: false,
        error: "Debes elegir fecha de publicación",
        code: "missing_scheduled_at",
      };
    }
    if (!input.force && candidate.getTime() <= Date.now()) {
      return {
        ok: false,
        error: "La fecha programada debe estar en el futuro",
        code: "scheduled_in_past",
      };
    }
    nextScheduledAt = candidate;
  }

  // 4d) skipReview.
  if (!input.force && cfg.skipReview && entry.status === "draft" && input.to === "review") {
    return {
      ok: false,
      error: "Esta colección omite revisión — pasa directo a programado/publicado",
      code: "review_skipped_collection",
    };
  }

  // 5) UPDATE atómico con guard de status actual.
  const setPayload: Record<string, unknown> = {
    status: input.to,
    updatedAt: new Date(),
    updatedById: input.actorId,
  };
  if (input.to === "scheduled") setPayload.scheduledAt = nextScheduledAt;
  if (input.to === "published") setPayload.publishedAt = new Date();
  // Liberar lock cuando salimos de approved/review.
  if (input.to !== "approved") {
    setPayload.lockedForApprovalAt = null;
    setPayload.lockedForApprovalById = null;
  }

  const updated = await atomicClaim<{ id: string; status: EntryStatus }>(entries, {
    where: and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId))!,
    precondition: (row) => row.status === entry.status,
    set: setPayload,
  });
  if (!updated) {
    // F9c.8a fix M7: si pusimos lock en 4b y la transición falló por race,
    // liberar el lock para no dejar la entry congelada.
    if (input.to === "approved") {
      await db
        .update(entries)
        .set({ lockedForApprovalAt: null, lockedForApprovalById: null })
        .where(
          and(
            eq(entries.id, input.entryId),
            eq(entries.workspaceId, input.workspaceId),
            eq(entries.lockedForApprovalById, input.actorId),
          ),
        );
    }
    return { ok: false, error: "Otro usuario cambió el estado primero", code: "race" };
  }

  // 6) Audit + notificaciones.
  await db.insert(entryWorkflowEvents).values({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    type: "status.changed",
    fromStatus: entry.status,
    toStatus: input.to,
    actorId: input.actorId,
    payload: input.note
      ? { note: input.note, force: input.force === true }
      : { force: input.force === true },
  });

  // F9c.9a fix C-3: emitir webhook event para integraciones externas (Slack, n8n, …).
  if (input.to === "review") {
    emitAsync({
      workspaceId: input.workspaceId,
      event: "entry.review_requested",
      payload: {
        id: input.entryId,
        title: entry.title,
        fromStatus: entry.status,
        actorId: input.actorId,
      },
    });
  } else if (input.to === "approved") {
    emitAsync({
      workspaceId: input.workspaceId,
      event: "entry.approved",
      payload: {
        id: input.entryId,
        title: entry.title,
        fromStatus: entry.status,
        actorId: input.actorId,
      },
    });
  }

  // Notify: author + reviewers + approvers (no actor).
  await notifyStatusChange({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    entryTitle: entry.title,
    fromStatus: entry.status,
    toStatus: input.to,
    actorId: input.actorId,
  });

  return {
    ok: true,
    data: { fromStatus: entry.status, toStatus: input.to, scheduledAt: nextScheduledAt },
  };
}

async function notifyStatusChange(args: {
  workspaceId: string;
  entryId: string;
  entryTitle: string;
  fromStatus: EntryStatus;
  toStatus: EntryStatus;
  actorId: string;
}) {
  if (!db) return;
  // Recipients: authorId + assignees activos (writer/reviewer/approver) — dedupe.
  const [entryRow] = await db
    .select({ authorId: entries.authorId })
    .from(entries)
    .where(and(eq(entries.id, args.entryId), eq(entries.workspaceId, args.workspaceId)))
    .limit(1);
  const assignees = await db
    .select({ id: entryAssignments.assigneeId })
    .from(entryAssignments)
    .where(
      and(
        eq(entryAssignments.entryId, args.entryId),
        eq(entryAssignments.workspaceId, args.workspaceId),
        isNull(entryAssignments.completedAt),
      ),
    );
  const userIds = new Set<string>();
  if (entryRow?.authorId) userIds.add(entryRow.authorId);
  for (const a of assignees) userIds.add(a.id);
  userIds.delete(args.actorId);
  if (userIds.size === 0) return;
  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, args.actorId))
    .limit(1);
  await emitNotificationsBatch(
    Array.from(userIds).map((uid) => ({
      workspaceId: args.workspaceId,
      userId: uid,
      type: "entry.status_changed" as const,
      payload: {
        entryId: args.entryId,
        entryTitle: args.entryTitle,
        fromStatus: args.fromStatus,
        toStatus: args.toStatus,
        actorId: args.actorId,
        actorName: actor?.name,
      },
    })),
  );
}

/**
 * Lista los eventos de workflow de un entry (timeline).
 */
export async function listEntryEvents(workspaceId: string, entryId: string) {
  if (!db) return [];
  return db
    .select({
      event: entryWorkflowEvents,
      actor: { id: users.id, name: users.name, image: users.image },
    })
    .from(entryWorkflowEvents)
    .leftJoin(users, eq(users.id, entryWorkflowEvents.actorId))
    .where(
      and(
        eq(entryWorkflowEvents.workspaceId, workspaceId),
        eq(entryWorkflowEvents.entryId, entryId),
      ),
    )
    .orderBy(entryWorkflowEvents.createdAt);
}
