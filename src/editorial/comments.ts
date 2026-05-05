import { db } from "@/db/client";
import { atomicClaim, insertReturning } from "@/db/dialect";
import {
  type EditorialMessage,
  type EditorialThread,
  editorialMessages,
  editorialThreads,
  entries,
  entryWorkflowEvents,
  members,
  users,
  workspaces,
} from "@/db/schema";
import { sendMentionEmail } from "@/lib/email";
import { whoIsOnline } from "@/presence/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { emitNotificationsBatch } from "./notifications";
import type { EditorialResult } from "./types";

const MAX_BODY_LEN = 8000;
const MAX_MENTIONS = 20;
const MENTION_RE = /@\[([^\]]{1,64})\]\(([0-9a-f-]{8,64})\)/g;

/**
 * Extrae user IDs de menciones tipo `@[Display Name](userId)` en el body
 * y los valida contra members del workspace. Devuelve lista deduplicada
 * y limitada para evitar abuse.
 */
async function extractAndValidateMentions(workspaceId: string, body: string): Promise<string[]> {
  if (!db) return [];
  const ids = new Set<string>();
  let match: RegExpExecArray | null = MENTION_RE.exec(body);
  while (match) {
    if (match[2]) ids.add(match[2]);
    if (ids.size >= MAX_MENTIONS) break;
    match = MENTION_RE.exec(body);
  }
  if (ids.size === 0) return [];
  const list = Array.from(ids);
  const valid = await db
    .select({ id: members.userId })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), inArray(members.userId, list)));
  return valid.map((v) => v.id);
}

export type CreateThreadInput = {
  workspaceId: string;
  entryId: string;
  /** Si NULL, hilo general del entry. Si set, ancla al bloque del Tiptap. */
  blockId?: string | null;
  /** Primer mensaje del hilo (no vacío). */
  body: string;
  actorId: string;
};

/**
 * Crea un hilo + primer mensaje + emite mentions.
 * Atómico: si el primer message falla por alguna razón el thread queda huérfano,
 * pero al ser FK cascade no es problemático (el listing filtra por hasMessages).
 */
export async function createThread(
  input: CreateThreadInput,
): Promise<EditorialResult<{ thread: EditorialThread; message: EditorialMessage }>> {
  if (!db) return { ok: false, error: "Database not available" };
  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "El comentario no puede estar vacío", code: "empty" };
  if (body.length > MAX_BODY_LEN)
    return { ok: false, error: "Mensaje demasiado largo", code: "too_long" };

  const [entry] = await db
    .select({ id: entries.id, title: entries.title })
    .from(entries)
    .where(and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId)))
    .limit(1);
  if (!entry) return { ok: false, error: "Entry no encontrada", code: "not_found" };

  const blockId = input.blockId ? input.blockId.slice(0, 64) : null;

  const threadId = crypto.randomUUID();
  const thread = (await insertReturning(editorialThreads, {
    id: threadId,
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    blockId,
    createdById: input.actorId,
  })) as EditorialThread;
  if (!thread) return { ok: false, error: "No se pudo crear el hilo" };

  const mentions = await extractAndValidateMentions(input.workspaceId, body);

  const messageId = crypto.randomUUID();
  const message = (await insertReturning(editorialMessages, {
    id: messageId,
    workspaceId: input.workspaceId,
    threadId: thread.id,
    authorId: input.actorId,
    body,
    mentions: mentions.length > 0 ? mentions : null,
  })) as EditorialMessage;
  if (!message) return { ok: false, error: "No se pudo crear el mensaje" };

  await db.insert(entryWorkflowEvents).values({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    type: "comment.added",
    actorId: input.actorId,
    payload: { threadId: thread.id, blockId, mentions },
  });

  await notifyComment({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    entryTitle: entry.title,
    threadId: thread.id,
    actorId: input.actorId,
    body,
    mentions,
  });

  return { ok: true, data: { thread, message } };
}

export type ReplyInput = {
  workspaceId: string;
  threadId: string;
  body: string;
  actorId: string;
};

export async function replyToThread(input: ReplyInput): Promise<EditorialResult<EditorialMessage>> {
  if (!db) return { ok: false, error: "Database not available" };
  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "Mensaje vacío", code: "empty" };
  if (body.length > MAX_BODY_LEN)
    return { ok: false, error: "Mensaje demasiado largo", code: "too_long" };

  const [thread] = await db
    .select()
    .from(editorialThreads)
    .where(
      and(
        eq(editorialThreads.id, input.threadId),
        eq(editorialThreads.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!thread) return { ok: false, error: "Hilo no encontrado", code: "not_found" };

  const [entry] = await db
    .select({ title: entries.title })
    .from(entries)
    .where(eq(entries.id, thread.entryId))
    .limit(1);

  const mentions = await extractAndValidateMentions(input.workspaceId, body);
  const messageId = crypto.randomUUID();
  const message = (await insertReturning(editorialMessages, {
    id: messageId,
    workspaceId: input.workspaceId,
    threadId: thread.id,
    authorId: input.actorId,
    body,
    mentions: mentions.length > 0 ? mentions : null,
  })) as EditorialMessage;
  if (!message) return { ok: false, error: "No se pudo crear el mensaje" };

  // Reabrir si estaba resuelto y ahora hay nueva actividad.
  if (thread.status === "resolved") {
    await db
      .update(editorialThreads)
      .set({ status: "open", resolvedAt: null, resolvedById: null, updatedAt: new Date() })
      .where(eq(editorialThreads.id, thread.id));
  } else {
    await db
      .update(editorialThreads)
      .set({ updatedAt: new Date() })
      .where(eq(editorialThreads.id, thread.id));
  }

  await notifyComment({
    workspaceId: input.workspaceId,
    entryId: thread.entryId,
    entryTitle: entry?.title ?? "",
    threadId: thread.id,
    actorId: input.actorId,
    body,
    mentions,
  });

  return { ok: true, data: message };
}

export async function resolveThread(
  workspaceId: string,
  threadId: string,
  actorId: string,
): Promise<EditorialResult<void>> {
  if (!db) return { ok: false, error: "Database not available" };
  const claimed = await atomicClaim<{
    id: string;
    entryId: string;
    workspaceId: string;
    status: string;
  }>(editorialThreads, {
    where: and(
      eq(editorialThreads.id, threadId),
      eq(editorialThreads.workspaceId, workspaceId),
    )!,
    precondition: (row) => row.status === "open",
    set: {
      status: "resolved",
      resolvedAt: new Date(),
      resolvedById: actorId,
      updatedAt: new Date(),
    },
  });
  if (!claimed) return { ok: false, error: "Hilo no encontrado o ya resuelto" };
  await db.insert(entryWorkflowEvents).values({
    workspaceId,
    entryId: claimed.entryId,
    type: "comment.resolved",
    actorId,
    payload: { threadId },
  });
  return { ok: true, data: undefined };
}

export async function reopenThread(
  workspaceId: string,
  threadId: string,
  actorId: string,
): Promise<EditorialResult<void>> {
  if (!db) return { ok: false, error: "Database not available" };
  await db
    .update(editorialThreads)
    .set({ status: "open", resolvedAt: null, resolvedById: null, updatedAt: new Date() })
    .where(and(eq(editorialThreads.id, threadId), eq(editorialThreads.workspaceId, workspaceId)));
  const res = await db
    .select({ id: editorialThreads.id, entryId: editorialThreads.entryId })
    .from(editorialThreads)
    .where(and(eq(editorialThreads.id, threadId), eq(editorialThreads.workspaceId, workspaceId)))
    .limit(1);
  if (res.length === 0) return { ok: false, error: "Hilo no encontrado", code: "not_found" };
  // F9c.8a fix M4: audit event para reapertura.
  const r = res[0];
  if (r) {
    await db.insert(entryWorkflowEvents).values({
      workspaceId,
      entryId: r.entryId,
      type: "comment.added",
      actorId,
      payload: { threadId, action: "reopened" },
    });
  }
  return { ok: true, data: undefined };
}

export async function listThreadsForEntry(workspaceId: string, entryId: string) {
  if (!db) return [];
  const threads = await db
    .select({
      thread: editorialThreads,
      creator: { id: users.id, name: users.name, image: users.image },
    })
    .from(editorialThreads)
    .leftJoin(users, eq(users.id, editorialThreads.createdById))
    .where(
      and(eq(editorialThreads.workspaceId, workspaceId), eq(editorialThreads.entryId, entryId)),
    )
    .orderBy(desc(editorialThreads.createdAt));

  if (threads.length === 0) return [];

  const ids = threads.map((t) => t.thread.id);
  const messages = await db
    .select({
      msg: editorialMessages,
      author: { id: users.id, name: users.name, image: users.image },
    })
    .from(editorialMessages)
    .leftJoin(users, eq(users.id, editorialMessages.authorId))
    .where(inArray(editorialMessages.threadId, ids))
    .orderBy(editorialMessages.createdAt);

  return threads.map((t) => ({
    ...t.thread,
    creator: t.creator,
    messages: messages
      .filter((m) => m.msg.threadId === t.thread.id)
      .map((m) => ({ ...m.msg, author: m.author })),
  }));
}

export async function countOpenThreads(workspaceId: string, entryId: string): Promise<number> {
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(editorialThreads)
    .where(
      and(
        eq(editorialThreads.workspaceId, workspaceId),
        eq(editorialThreads.entryId, entryId),
        eq(editorialThreads.status, "open"),
      ),
    );
  return r?.n ?? 0;
}

async function notifyComment(args: {
  workspaceId: string;
  entryId: string;
  entryTitle: string;
  threadId: string;
  actorId: string;
  body: string;
  mentions: string[];
}) {
  if (!db) return;
  const _ = isNull;
  // Recipients = author + previos commenters + mentions, dedupe, sin actor.
  const [entryRow] = await db
    .select({ authorId: entries.authorId })
    .from(entries)
    .where(and(eq(entries.id, args.entryId), eq(entries.workspaceId, args.workspaceId)))
    .limit(1);
  const prevAuthors = await db
    .select({ id: editorialMessages.authorId })
    .from(editorialMessages)
    .where(eq(editorialMessages.threadId, args.threadId));

  const recipients = new Set<string>();
  if (entryRow?.authorId) recipients.add(entryRow.authorId);
  for (const m of prevAuthors) if (m.id) recipients.add(m.id);
  recipients.delete(args.actorId);

  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, args.actorId))
    .limit(1);
  const preview = args.body.length > 140 ? `${args.body.slice(0, 140)}…` : args.body;

  const inputs: Parameters<typeof emitNotificationsBatch>[0] = [];
  for (const uid of recipients) {
    inputs.push({
      workspaceId: args.workspaceId,
      userId: uid,
      type: "editorial.comment.added",
      payload: {
        entryId: args.entryId,
        entryTitle: args.entryTitle,
        threadId: args.threadId,
        actorId: args.actorId,
        actorName: actor?.name,
        messagePreview: preview,
      },
    });
  }
  // Mentions ganan: type=mention para destacar (no duplicate con comment.added).
  for (const uid of args.mentions) {
    if (uid === args.actorId) continue;
    inputs.push({
      workspaceId: args.workspaceId,
      userId: uid,
      type: "entry.mention",
      payload: {
        entryId: args.entryId,
        entryTitle: args.entryTitle,
        threadId: args.threadId,
        actorId: args.actorId,
        actorName: actor?.name,
        messagePreview: preview,
      },
    });
  }
  await emitNotificationsBatch(inputs);

  // F10b — Mentions email para los mencionados que estén OFFLINE (cierra F9b L5).
  // Si están online en el admin, ya verán la notificación en el bell SSE en
  // realtime; mandar email sería ruido. Solo email si presence dice offline.
  if (args.mentions.length > 0) {
    void emailOfflineMentions({
      workspaceId: args.workspaceId,
      entryId: args.entryId,
      entryTitle: args.entryTitle,
      threadId: args.threadId,
      actorName: actor?.name ?? "Alguien",
      preview,
      mentions: args.mentions.filter((id) => id !== args.actorId),
    }).catch(() => {
      /* email es best-effort — no rompemos el flow del comment */
    });
  }
}

async function emailOfflineMentions(args: {
  workspaceId: string;
  entryId: string;
  entryTitle: string;
  threadId: string;
  actorName: string;
  preview: string;
  mentions: string[];
}): Promise<void> {
  if (!db || args.mentions.length === 0) return;

  const onlineSet = await whoIsOnline(args.workspaceId, args.mentions);
  const offline = args.mentions.filter((id) => !onlineSet.has(id));
  if (offline.length === 0) return;

  // Cargamos email + name de los offline + nombre del workspace en paralelo.
  const [recipients, [ws]] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(inArray(users.id, offline)),
    db
      .select({ name: workspaces.name, slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, args.workspaceId))
      .limit(1),
  ]);
  const wsName = ws?.name ?? "tu workspace";

  // Base URL: en serverless conviene usar el host del request, pero como esto
  // se ejecuta server-side fuera del request, leemos el env de Vercel.
  // `NEXT_PUBLIC_APP_URL` o `VERCEL_URL` con fallback "" → relativa funciona si
  // el cliente abre el email en la misma máquina (rare). Para emails reales
  // siempre absoluta: VERCEL_URL.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const url = `${baseUrl}/admin/contenido/${args.entryId}`;

  await Promise.all(
    recipients
      .filter((r) => !!r.email)
      .map((r) =>
        sendMentionEmail({
          to: r.email,
          recipientName: r.name,
          actorName: args.actorName,
          workspaceName: wsName,
          entryTitle: args.entryTitle,
          preview: args.preview,
          url,
        }).catch(() => {
          /* per-email failure no afecta a otros */
        }),
      ),
  );
}
