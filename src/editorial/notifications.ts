import { db } from "@/db/client";
import {
  atomicClaim,
  atomicClaimMany,
  countInt,
  insertReturning,
  insertReturningMany,
} from "@/db/dialect";
import { type Notification, notifications } from "@/db/schema";
import { publishPubsub, subscribePubsub } from "@/lib/pubsub";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { EditorialNotificationType, NotificationPayload } from "./types";

/**
 * F10b: bus cross-instancia sobre Postgres LISTEN/NOTIFY (cierra F9c L1+L7).
 *
 * El canal por workspace se llama `notif:ws:{workspaceId}`. Cada notif se
 * publica con `userId` en el payload; los listeners locales filtran por user
 * antes de entregar a la SSE. Esto evita un canal por usuario (explosión de
 * subscripciones LISTEN en escenarios con cientos de editores).
 */
type Listener = (notif: Notification) => void;

type SerializedNotif = {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

const userListeners = new Map<string, Set<Listener>>();
const wsUnsubs = new Map<string, () => void>();
const wsRefCount = new Map<string, number>();

function bucketKey(workspaceId: string, userId: string) {
  return `${workspaceId}::${userId}`;
}

function wsChannel(workspaceId: string) {
  return `notif:ws:${workspaceId}`;
}

function deserialize(s: SerializedNotif): Notification {
  return {
    id: s.id,
    userId: s.userId,
    workspaceId: s.workspaceId,
    type: s.type,
    payload: s.payload,
    readAt: s.readAt ? new Date(s.readAt) : null,
    createdAt: new Date(s.createdAt),
  } as Notification;
}

function ensureWorkspaceListen(workspaceId: string) {
  const refs = wsRefCount.get(workspaceId) ?? 0;
  wsRefCount.set(workspaceId, refs + 1);
  if (wsUnsubs.has(workspaceId)) return;
  const unsub = subscribePubsub(wsChannel(workspaceId), (raw) => {
    let notif: SerializedNotif;
    try {
      notif = JSON.parse(raw) as SerializedNotif;
    } catch {
      return;
    }
    const set = userListeners.get(bucketKey(workspaceId, notif.userId));
    if (!set || set.size === 0) return;
    const hydrated = deserialize(notif);
    for (const fn of set) {
      try {
        fn(hydrated);
      } catch {
        /* listener crash should not affect others */
      }
    }
  });
  wsUnsubs.set(workspaceId, unsub);
}

function releaseWorkspaceListen(workspaceId: string) {
  const refs = (wsRefCount.get(workspaceId) ?? 1) - 1;
  if (refs <= 0) {
    wsRefCount.delete(workspaceId);
    const unsub = wsUnsubs.get(workspaceId);
    if (unsub) {
      unsub();
      wsUnsubs.delete(workspaceId);
    }
  } else {
    wsRefCount.set(workspaceId, refs);
  }
}

export function subscribeNotifications(
  workspaceId: string,
  userId: string,
  fn: Listener,
): () => void {
  ensureWorkspaceListen(workspaceId);
  const k = bucketKey(workspaceId, userId);
  let set = userListeners.get(k);
  if (!set) {
    set = new Set();
    userListeners.set(k, set);
  }
  set.add(fn);
  return () => {
    const cur = userListeners.get(k);
    if (cur) {
      cur.delete(fn);
      if (cur.size === 0) userListeners.delete(k);
    }
    releaseWorkspaceListen(workspaceId);
  };
}

function fanout(notif: Notification) {
  if (!notif.workspaceId) return;
  // Publicación cross-instancia. Los listeners locales se enteran por su LISTEN
  // (incluido este propio proceso — Postgres entrega NOTIFY también al emisor).
  void publishPubsub(wsChannel(notif.workspaceId), {
    id: notif.id,
    userId: notif.userId,
    workspaceId: notif.workspaceId,
    type: notif.type,
    payload: notif.payload,
    readAt: notif.readAt ? notif.readAt.toISOString() : null,
    createdAt: notif.createdAt.toISOString(),
  } satisfies SerializedNotif);
}

export type EmitInput = {
  workspaceId: string;
  userId: string;
  type: EditorialNotificationType;
  payload?: NotificationPayload;
};

export async function emitNotification(input: EmitInput): Promise<void> {
  if (!db) return;
  if (input.payload?.actorId && input.payload.actorId === input.userId) return;
  try {
    const id = crypto.randomUUID();
    const row = (await insertReturning(notifications, {
      id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: input.type,
      payload: input.payload as unknown,
    })) as Notification;
    if (row) fanout(row);
  } catch {
    /* notifications no son críticas; no rompemos el flujo principal */
  }
}

export async function emitNotificationsBatch(inputs: EmitInput[]): Promise<void> {
  if (!db || inputs.length === 0) return;
  const seen = new Set<string>();
  const filtered = inputs.filter((i) => {
    if (i.payload?.actorId && i.payload.actorId === i.userId) return false;
    const key = `${i.userId}::${i.type}::${i.payload?.entryId ?? ""}::${i.payload?.threadId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (filtered.length === 0) return;
  try {
    const items = filtered.map((i) => ({
      id: crypto.randomUUID(),
      workspaceId: i.workspaceId,
      userId: i.userId,
      type: i.type,
      payload: i.payload as unknown,
    }));
    const rows = (await insertReturningMany(notifications, items)) as Notification[];
    for (const r of rows) fanout(r);
  } catch {
    /* swallow */
  }
}

export async function listNotifications(
  workspaceId: string,
  userId: string,
  opts: { limit?: number; onlyUnread?: boolean } = {},
): Promise<{ rows: Notification[]; unread: number }> {
  if (!db) return { rows: [], unread: 0 };
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const where = opts.onlyUnread
    ? and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      )
    : and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, userId));
  const [rows, unreadRow] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ n: countInt() })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, workspaceId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      ),
  ]);
  return { rows, unread: unreadRow[0]?.n ?? 0 };
}

export async function markNotificationRead(
  workspaceId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  if (!db) return false;
  const res = await atomicClaim<{
    id: string;
    workspaceId: string;
    userId: string;
    readAt: Date | null;
  }>(notifications, {
    where: and(
      eq(notifications.id, notificationId),
      eq(notifications.workspaceId, workspaceId),
      eq(notifications.userId, userId),
    )!,
    precondition: (row) => row.readAt === null,
    set: { readAt: new Date() },
  });
  return res !== null;
}

export async function markAllNotificationsRead(
  workspaceId: string,
  userId: string,
): Promise<number> {
  if (!db) return 0;
  const res = await atomicClaimMany<{ id: string; readAt: Date | null }>(notifications, {
    where: and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, userId))!,
    precondition: (row) => row.readAt === null,
    set: { readAt: new Date() },
  });
  return res.length;
}
