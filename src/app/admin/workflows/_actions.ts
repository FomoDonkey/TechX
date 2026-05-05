"use server";

import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import {
  ALL_ENTRY_STATUSES,
  type EditorialAssignmentRole,
  type EntryStatus,
  assignToEntry,
  completeAssignment,
  createThread,
  emitNotification,
  getOrCreateCalendarToken,
  removeAssignment,
  reopenThread,
  replyToThread,
  resolveThread,
  rotateCalendarToken,
  toggleReaction,
  transitionStatus,
} from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";
import { emitAsync } from "@/webhooks/dispatcher";
import { isNull } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Ok = { ok: true };
type OkWith<T extends object> = { ok: true } & T;
type Err = { ok: false; error: string; code?: string };
type Result<T extends object | undefined = undefined> = T extends object
  ? OkWith<T> | Err
  : Ok | Err;

function fail(error: string, code?: string): Err {
  return { ok: false, error, ...(code ? { code } : {}) };
}

const TransitionSchema = z.object({
  entryId: z.string().uuid(),
  to: z.enum(["draft", "review", "approved", "scheduled", "published", "archived"] as const),
  note: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  force: z.boolean().optional(),
});

export async function transitionEntryAction(
  input: z.input<typeof TransitionSchema>,
): Promise<Result<{ status: EntryStatus; scheduledAt: string | null }>> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = TransitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const _ = ALL_ENTRY_STATUSES;
  const res = await transitionStatus({
    workspaceId: ctx.workspace.id,
    entryId: parsed.data.entryId,
    to: parsed.data.to,
    actorId: user.id,
    actorRole: ctx.role,
    note: parsed.data.note,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    force: parsed.data.force === true && (ctx.role === "admin" || ctx.role === "owner"),
  });
  if (!res.ok) return fail(res.error, res.code);
  revalidatePath("/admin/workflows");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin/contenido");
  revalidatePath(`/admin/contenido/${parsed.data.entryId}`);
  return {
    ok: true,
    status: res.data.toStatus,
    scheduledAt: res.data.scheduledAt ? res.data.scheduledAt.toISOString() : null,
  };
}

const AssignSchema = z.object({
  entryId: z.string().uuid(),
  assigneeId: z.string().min(1).max(80),
  role: z.enum(["writer", "reviewer", "approver"] as const),
  dueAt: z.string().datetime().nullable().optional(),
  slaHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable()
    .optional(),
  note: z.string().max(500).optional(),
});

export async function assignEntryAction(
  input: z.input<typeof AssignSchema>,
): Promise<Result<{ assignmentId: string }>> {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = AssignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const role = parsed.data.role as EditorialAssignmentRole;
  const res = await assignToEntry({
    workspaceId: ctx.workspace.id,
    entryId: parsed.data.entryId,
    assigneeId: parsed.data.assigneeId,
    role,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    slaHours: parsed.data.slaHours ?? null,
    note: parsed.data.note ?? null,
    actorId: user.id,
  });
  if (!res.ok) return fail(res.error, res.code);
  revalidatePath(`/admin/contenido/${parsed.data.entryId}`);
  revalidatePath("/admin/workflows");
  revalidatePath("/admin/calendario");
  return { ok: true, assignmentId: res.data.id };
}

const CompleteSchema = z.object({
  assignmentId: z.string().uuid(),
  completionKind: z.string().max(40).optional(),
});

export async function completeAssignmentAction(
  input: z.input<typeof CompleteSchema>,
): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = CompleteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const res = await completeAssignment({
    workspaceId: ctx.workspace.id,
    assignmentId: parsed.data.assignmentId,
    actorId: user.id,
    completionKind: parsed.data.completionKind,
  });
  if (!res.ok) return fail(res.error, res.code);
  revalidatePath("/admin/workflows");
  return { ok: true };
}

const RemoveSchema = z.object({ assignmentId: z.string().uuid() });

export async function removeAssignmentAction(input: z.input<typeof RemoveSchema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const res = await removeAssignment(ctx.workspace.id, parsed.data.assignmentId, user.id);
  if (!res.ok) return fail(res.error, res.code);
  revalidatePath("/admin/workflows");
  return { ok: true };
}

// -- Editorial threads --

const CreateThreadSchema = z.object({
  entryId: z.string().uuid(),
  blockId: z.string().max(64).nullable().optional(),
  body: z.string().min(1).max(8000),
});

export async function createThreadAction(
  input: z.input<typeof CreateThreadSchema>,
): Promise<Result<{ threadId: string }>> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = CreateThreadSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const res = await createThread({
    workspaceId: ctx.workspace.id,
    entryId: parsed.data.entryId,
    blockId: parsed.data.blockId ?? null,
    body: parsed.data.body,
    actorId: user.id,
  });
  if (!res.ok) return fail(res.error, res.code);
  revalidatePath(`/admin/contenido/${parsed.data.entryId}`);
  return { ok: true, threadId: res.data.thread.id };
}

const ReplySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(8000),
});

export async function replyThreadAction(input: z.input<typeof ReplySchema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = ReplySchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const res = await replyToThread({
    workspaceId: ctx.workspace.id,
    threadId: parsed.data.threadId,
    body: parsed.data.body,
    actorId: user.id,
  });
  if (!res.ok) return fail(res.error, res.code);
  return { ok: true };
}

const ThreadIdSchema = z.object({ threadId: z.string().uuid() });

export async function resolveThreadAction(input: z.input<typeof ThreadIdSchema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = ThreadIdSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const res = await resolveThread(ctx.workspace.id, parsed.data.threadId, user.id);
  if (!res.ok) return fail(res.error, res.code);
  return { ok: true };
}

export async function reopenThreadAction(input: z.input<typeof ThreadIdSchema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = ThreadIdSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const res = await reopenThread(ctx.workspace.id, parsed.data.threadId, user.id);
  if (!res.ok) return fail(res.error, res.code);
  return { ok: true };
}

// -- Schedule / due / priority quick actions (used by Calendar DnD) --

const RescheduleSchema = z.object({
  entryId: z.string().uuid(),
  scheduledAt: z.string().datetime().nullable(),
});

export async function rescheduleEntryAction(
  input: z.input<typeof RescheduleSchema>,
): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = RescheduleSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  if (!db) return fail("DB no disponible");
  const next = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  // Si la entry estaba "scheduled" y next < now, rechazar (ambigüedad — el cron publicaría).
  // F9c.9a fix H-4: solo entries en main. Reschedule/meta de forks debe pasar
  // por el editor de la branch (que materializa el COW correctamente).
  const [row] = await db
    .select({ status: entries.status, title: entries.title, authorId: entries.authorId })
    .from(entries)
    .where(
      and(
        eq(entries.id, parsed.data.entryId),
        eq(entries.workspaceId, ctx.workspace.id),
        isNull(entries.branchId),
      ),
    )
    .limit(1);
  if (!row) return fail("Entry no encontrada en main", "not_found");
  if (
    row.status === "scheduled" &&
    next &&
    next.getTime() <= Date.now() + 60_000 // 60s slack
  ) {
    return fail("La fecha programada debe ser al menos 1 minuto en el futuro", "scheduled_in_past");
  }
  await db
    .update(entries)
    .set({ scheduledAt: next, updatedAt: new Date(), updatedById: user.id })
    .where(and(eq(entries.id, parsed.data.entryId), eq(entries.workspaceId, ctx.workspace.id)));
  // Audit silently.
  if (row.authorId && row.authorId !== user.id) {
    await emitNotification({
      workspaceId: ctx.workspace.id,
      userId: row.authorId,
      type: "entry.status_changed",
      payload: {
        entryId: parsed.data.entryId,
        entryTitle: row.title,
        actorId: user.id,
      },
    });
  }
  // F9c.9a fix C-3: webhook entry.rescheduled.
  emitAsync({
    workspaceId: ctx.workspace.id,
    event: "entry.rescheduled",
    payload: {
      id: parsed.data.entryId,
      title: row.title,
      scheduledAt: next ? next.toISOString() : null,
      actorId: user.id,
    },
  });
  revalidatePath("/admin/calendario");
  return { ok: true };
}

const UpdateMetaSchema = z.object({
  entryId: z.string().uuid(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"] as const).optional(),
});

export async function updateEntryMetaAction(
  input: z.input<typeof UpdateMetaSchema>,
): Promise<Result> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const parsed = UpdateMetaSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  if (!db) return fail("DB no disponible");
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedById: user.id };
  if (parsed.data.dueAt !== undefined) {
    set.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  }
  if (parsed.data.priority) set.priority = parsed.data.priority;
  if (Object.keys(set).length <= 2) return { ok: true };
  // F9c.9a fix H-4: solo entries en main.
  await db
    .update(entries)
    .set(set)
    .where(
      and(
        eq(entries.id, parsed.data.entryId),
        eq(entries.workspaceId, ctx.workspace.id),
        isNull(entries.branchId),
      ),
    );
  const upd = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.id, parsed.data.entryId),
        eq(entries.workspaceId, ctx.workspace.id),
        isNull(entries.branchId),
      ),
    )
    .limit(1);
  if (upd.length === 0) return fail("Entry no encontrada en main", "not_found");
  revalidatePath("/admin/calendario");
  revalidatePath(`/admin/contenido/${parsed.data.entryId}`);
  return { ok: true };
}

// -- iCal token --

export async function getCalendarTokenAction(): Promise<
  Result<{ token: string; rotatedAt: string | null }>
> {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");
  const t = await getOrCreateCalendarToken(ctx.workspace.id, user.id);
  return { ok: true, token: t.token, rotatedAt: t.rotatedAt?.toISOString() ?? null };
}

export async function rotateCalendarTokenAction(): Promise<
  Result<{ token: string; rotatedAt: string | null }>
> {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");
  const t = await rotateCalendarToken(ctx.workspace.id, user.id);
  return { ok: true, token: t.token, rotatedAt: t.rotatedAt?.toISOString() ?? null };
}

const ReactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(8),
});

/**
 * F10b — toggle realtime de reactions emoji sobre un mensaje editorial.
 * Idempotente: si ya existía la (messageId, userId, emoji) la borra; si no, la crea.
 * Publica al canal del workspace para fanout cross-instancia.
 */
export async function toggleReactionAction(
  input: z.input<typeof ReactionSchema>,
): Promise<Result<{ added: boolean }>> {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");
  const parsed = ReactionSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const res = await toggleReaction({
    workspaceId: ctx.workspace.id,
    userId: user.id,
    userName: user.name ?? user.email ?? null,
    messageId: parsed.data.messageId,
    emoji: parsed.data.emoji,
  });
  if (!res.ok) return fail(res.error);
  return { ok: true, added: res.added };
}
