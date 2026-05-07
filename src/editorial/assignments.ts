import { db } from "@/db/client";
import { atomicClaim, countInt, insertReturning } from "@/db/dialect";
import {
  type EditorialAssignmentRole,
  type EntryAssignment,
  entries,
  entryAssignments,
  entryWorkflowEvents,
  members,
  users,
} from "@/db/schema";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, isNull, sql } from "drizzle-orm";
import { emitNotification } from "./notifications";
import type { EditorialResult } from "./types";

export type AssignmentWithUser = EntryAssignment & {
  assignee: { id: string; name: string; email: string; image: string | null } | null;
};

/**
 * Lista las asignaciones (activas y completadas) de un entry, joineadas con users.
 */
export async function listEntryAssignments(
  workspaceId: string,
  entryId: string,
): Promise<AssignmentWithUser[]> {
  if (!db) return [];
  const rows = await db
    .select({
      a: entryAssignments,
      u: { id: users.id, name: users.name, email: users.email, image: users.image },
    })
    .from(entryAssignments)
    .leftJoin(users, eq(users.id, entryAssignments.assigneeId))
    .where(
      and(eq(entryAssignments.workspaceId, workspaceId), eq(entryAssignments.entryId, entryId)),
    )
    .orderBy(entryAssignments.createdAt);
  return rows.map((r) => ({ ...r.a, assignee: r.u }));
}

/**
 * Lista todas las asignaciones activas de un usuario en un workspace
 * (para "Mis tareas" en el dashboard / sidebar del editor).
 */
export async function listUserActiveAssignments(workspaceId: string, userId: string) {
  if (!db) return [];
  return db
    .select({
      assignment: entryAssignments,
      entry: {
        id: entries.id,
        title: entries.title,
        slug: entries.slug,
        status: entries.status,
        priority: entries.priority,
        scheduledAt: entries.scheduledAt,
        dueAt: entries.dueAt,
        collectionId: entries.collectionId,
      },
    })
    .from(entryAssignments)
    .innerJoin(entries, eq(entries.id, entryAssignments.entryId))
    .where(
      and(
        eq(entryAssignments.workspaceId, workspaceId),
        eq(entryAssignments.assigneeId, userId),
        isNull(entryAssignments.completedAt),
      ),
    )
    .orderBy(entryAssignments.dueAt, entryAssignments.createdAt);
}

async function userBelongsToWorkspace(workspaceId: string, userId: string): Promise<boolean> {
  if (!db) return false;
  const [row] = await db
    .select({ ws: members.workspaceId })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
    .limit(1);
  return !!row;
}

export type CreateAssignmentInput = {
  workspaceId: string;
  entryId: string;
  assigneeId: string;
  role: EditorialAssignmentRole;
  dueAt?: Date | null;
  slaHours?: number | null;
  note?: string | null;
  actorId: string;
};

/**
 * Crea (o reemplaza) la asignación activa de un (entry, role). Si ya existía
 * una activa, la marca como `completedAt=now() completionKind="superseded"`
 * para liberar el slot del unique index parcial.
 *
 * Multi-tenant: valida que tanto entry como assignee pertenecen al workspace.
 */
export async function assignToEntry(
  input: CreateAssignmentInput,
): Promise<EditorialResult<EntryAssignment>> {
  if (!db) return { ok: false, error: "Database not available" };
  // 1) Validar entry pertenece al ws.
  const [entry] = await db
    .select({ id: entries.id, title: entries.title })
    .from(entries)
    .where(and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId)))
    .limit(1);
  if (!entry) return { ok: false, error: "Entry no encontrada", code: "not_found" };

  // 2) Validar assignee es miembro del ws.
  const isMember = await userBelongsToWorkspace(input.workspaceId, input.assigneeId);
  if (!isMember)
    return { ok: false, error: "Usuario no pertenece al workspace", code: "forbidden" };

  // 3) Liberar slot anterior (si existe) — atómico.
  await db
    .update(entryAssignments)
    .set({ completedAt: new Date(), completionKind: "superseded", updatedAt: new Date() })
    .where(
      and(
        eq(entryAssignments.entryId, input.entryId),
        eq(entryAssignments.role, input.role),
        isNull(entryAssignments.completedAt),
      ),
    );

  // 4) Insertar nueva asignación.
  const newId = crypto.randomUUID();
  const created = (await insertReturning(entryAssignments, {
    id: newId,
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    assigneeId: input.assigneeId,
    role: input.role,
    dueAt: input.dueAt ?? null,
    slaHours: input.slaHours ?? null,
    note: input.note ?? null,
    createdById: input.actorId,
  })) as EntryAssignment;

  if (!created) return { ok: false, error: "No se pudo crear la asignación" };

  // 5) Audit + notification.
  await db.insert(entryWorkflowEvents).values({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    type: "assignment.added",
    actorId: input.actorId,
    targetUserId: input.assigneeId,
    payload: { role: input.role, slaHours: input.slaHours, dueAt: input.dueAt },
  });

  await emitNotification({
    workspaceId: input.workspaceId,
    userId: input.assigneeId,
    type: "entry.assigned",
    payload: {
      entryId: input.entryId,
      entryTitle: entry.title,
      role: input.role,
      actorId: input.actorId,
      dueAt: input.dueAt ? input.dueAt.toISOString() : undefined,
    },
  });

  // F9c.9a fix C-3: emitir webhook event para integraciones externas.
  emitAsync({
    workspaceId: input.workspaceId,
    event: "entry.assigned",
    payload: {
      id: input.entryId,
      title: entry.title,
      assigneeId: input.assigneeId,
      role: input.role,
      dueAt: input.dueAt ? input.dueAt.toISOString() : null,
      slaHours: input.slaHours ?? null,
      actorId: input.actorId,
    },
  });

  return { ok: true, data: created };
}

export type CompleteAssignmentInput = {
  workspaceId: string;
  assignmentId: string;
  actorId: string;
  /** Texto libre: "approved" / "rejected" / "completed" / etc. */
  completionKind?: string;
};

export async function completeAssignment(
  input: CompleteAssignmentInput,
): Promise<EditorialResult<void>> {
  if (!db) return { ok: false, error: "Database not available" };
  // Sólo el assignee puede completar (o un admin via otro flujo).
  const [a] = await db
    .select()
    .from(entryAssignments)
    .where(
      and(
        eq(entryAssignments.id, input.assignmentId),
        eq(entryAssignments.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!a) return { ok: false, error: "Asignación no encontrada", code: "not_found" };
  if (a.completedAt) return { ok: false, error: "Ya completada", code: "already_done" };
  if (a.assigneeId !== input.actorId) {
    return { ok: false, error: "Sólo el asignado puede completar", code: "forbidden" };
  }

  const res = await atomicClaim<{ id: string; completedAt: Date | null }>(entryAssignments, {
    where: eq(entryAssignments.id, input.assignmentId),
    precondition: (row) => row.completedAt === null,
    set: {
      completedAt: new Date(),
      completionKind: input.completionKind ?? "completed",
      updatedAt: new Date(),
    },
  });
  if (!res) return { ok: false, error: "No se pudo completar (race?)" };

  await db.insert(entryWorkflowEvents).values({
    workspaceId: input.workspaceId,
    entryId: a.entryId,
    type: "assignment.completed",
    actorId: input.actorId,
    targetUserId: a.assigneeId,
    payload: { role: a.role, completionKind: input.completionKind ?? "completed" },
  });

  return { ok: true, data: undefined };
}

export async function removeAssignment(
  workspaceId: string,
  assignmentId: string,
  actorId: string,
): Promise<EditorialResult<void>> {
  if (!db) return { ok: false, error: "Database not available" };
  const [a] = await db
    .select()
    .from(entryAssignments)
    .where(
      and(eq(entryAssignments.id, assignmentId), eq(entryAssignments.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!a) return { ok: false, error: "Asignación no encontrada", code: "not_found" };

  await db
    .delete(entryAssignments)
    .where(
      and(eq(entryAssignments.id, assignmentId), eq(entryAssignments.workspaceId, workspaceId)),
    );

  await db.insert(entryWorkflowEvents).values({
    workspaceId,
    entryId: a.entryId,
    type: "assignment.removed",
    actorId,
    targetUserId: a.assigneeId,
    payload: { role: a.role },
  });

  await emitNotification({
    workspaceId,
    userId: a.assigneeId,
    type: "entry.unassigned",
    payload: { entryId: a.entryId, role: a.role, actorId },
  });

  emitAsync({
    workspaceId,
    event: "entry.unassigned",
    payload: { id: a.entryId, assigneeId: a.assigneeId, role: a.role, actorId },
  });

  return { ok: true, data: undefined };
}

/**
 * Helper: dado un entry, devuelve el assignee activo de un rol.
 */
export async function getActiveAssignee(
  workspaceId: string,
  entryId: string,
  role: EditorialAssignmentRole,
): Promise<EntryAssignment | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(entryAssignments)
    .where(
      and(
        eq(entryAssignments.workspaceId, workspaceId),
        eq(entryAssignments.entryId, entryId),
        eq(entryAssignments.role, role),
        isNull(entryAssignments.completedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Cuenta asignaciones activas de un usuario (para workload UI).
 */
export async function countActiveAssignmentsByUser(workspaceId: string) {
  if (!db) return [] as Array<{ userId: string; count: number }>;
  const rows = await db
    .select({
      userId: entryAssignments.assigneeId,
      count: countInt(),
    })
    .from(entryAssignments)
    .where(and(eq(entryAssignments.workspaceId, workspaceId), isNull(entryAssignments.completedAt)))
    .groupBy(entryAssignments.assigneeId);
  return rows;
}
