/**
 * Server-side helpers para realtime collab editing.
 *
 * Diseño:
 * - `collab_snapshots` guarda el merged Y.Doc binary state por entry (1:1).
 * - `collab_updates` log de updates incrementales (N:1) hasta que el snapshotter los compacta.
 * - Updates se publican via Postgres LISTEN/NOTIFY canal `collab:entry:{entryId}` para
 *   fanout cross-instancia. Los receptores skipean su propio `clientId`.
 * - `awareness` (presence/cursors) NO se persiste — sólo se publica al canal
 *   `collab:awareness:{entryId}`.
 *
 * El snapshotter NO corre en este módulo: es un job in-memory disparado tras N updates
 * acumulados. Para evitar concurrencia, cualquier instancia que lo dispare hace un
 * `SELECT ... FOR UPDATE SKIP LOCKED` style merge. En esta primera versión simplificamos:
 * compacta in-memory + UPDATE optimista + DELETE de rows ya consolidados.
 */

import { db } from "@/db/client";
import { collabSnapshots, collabUpdates, entries } from "@/db/schema";
import { publishPubsub } from "@/lib/pubsub";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import * as Y from "yjs";

export const COLLAB_UPDATE_CHANNEL = (entryId: string) => `collab:up:${entryId}`;
export const COLLAB_AWARENESS_CHANNEL = (entryId: string) => `collab:aw:${entryId}`;

// Cap defensivo. Y.js individual update es ~10-200 bytes; ponemos 64KB como máximo
// permisivo para garantizar tolerancia a paste de imágenes inline o snapshots iniciales.
export const MAX_UPDATE_BYTES = 64 * 1024;

const SNAPSHOT_THRESHOLD_UPDATES = 50; // tras N updates pendientes, compactar
const SNAPSHOT_THRESHOLD_MS = 30_000; // o tras 30s sin compactar
const lastSnapshotAt = new Map<string, number>();
const updatesSinceSnapshot = new Map<string, number>();
const compactInflight = new Set<string>();

export type CollabAccess = {
  workspaceId: string;
  /** El entry existe y pertenece al workspace. */
  ok: boolean;
};

export async function checkEntryAccess(entryId: string, workspaceId: string): Promise<boolean> {
  if (!db) return false;
  const [row] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.workspaceId, workspaceId)))
    .limit(1);
  return !!row;
}

/**
 * Devuelve el state inicial para un cliente que se conecta.
 * - `snapshot`: base64 del Y.Doc compactado (puede ser null si nunca se compactó).
 * - `updates`: array de base64 de updates posteriores al snapshot.
 * - `bodyJson`: el `entries.body` actual (Tiptap JSON) — el cliente lo usa SOLO si
 *   no hay snapshot ni updates (primer cliente que abre collab) para sembrar el doc.
 */
export async function loadInitialState(entryId: string, workspaceId: string) {
  if (!db) {
    return { snapshot: null as string | null, updates: [] as string[], bodyJson: null as unknown };
  }
  const [snap] = await db
    .select({ state: collabSnapshots.state, updatedAt: collabSnapshots.updatedAt })
    .from(collabSnapshots)
    .where(and(eq(collabSnapshots.entryId, entryId), eq(collabSnapshots.workspaceId, workspaceId)))
    .limit(1);

  // Updates posteriores al snapshot (si lo hay) o todos.
  const conds = [eq(collabUpdates.entryId, entryId), eq(collabUpdates.workspaceId, workspaceId)];
  // Si hay snapshot, traemos sólo updates posteriores; si no, todos.
  const ups = snap
    ? await db
        .select({ update: collabUpdates.update })
        .from(collabUpdates)
        .where(and(...conds, sql`${collabUpdates.createdAt} > ${snap.updatedAt}`))
        .orderBy(asc(collabUpdates.createdAt))
    : await db
        .select({ update: collabUpdates.update })
        .from(collabUpdates)
        .where(and(...conds))
        .orderBy(asc(collabUpdates.createdAt));

  // Si no hay nada todavía, también mandamos el `entries.body` para sembrar el doc.
  let bodyJson: unknown = null;
  if (!snap && ups.length === 0) {
    const [row] = await db
      .select({ body: entries.body })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.workspaceId, workspaceId)))
      .limit(1);
    bodyJson = row?.body ?? null;
  }

  return {
    snapshot: snap?.state ?? null,
    updates: ups.map((u) => u.update),
    bodyJson,
  };
}

export type AppendInput = {
  entryId: string;
  workspaceId: string;
  userId: string | null;
  clientId: string;
  /** base64 del binary update Y.js. */
  update: string;
};

/**
 * Persiste un update y lo broadcastea al canal del entry.
 * Tras suficientes updates dispara compactación en background.
 */
export async function appendUpdate(input: AppendInput): Promise<void> {
  if (!db) return;
  await db.insert(collabUpdates).values({
    entryId: input.entryId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId,
    update: input.update,
  });
  await publishPubsub(COLLAB_UPDATE_CHANNEL(input.entryId), {
    clientId: input.clientId,
    update: input.update,
    userId: input.userId,
  });

  // Bookkeeping para compaction.
  const cur = (updatesSinceSnapshot.get(input.entryId) ?? 0) + 1;
  updatesSinceSnapshot.set(input.entryId, cur);
  const last = lastSnapshotAt.get(input.entryId) ?? 0;
  if (cur >= SNAPSHOT_THRESHOLD_UPDATES || Date.now() - last > SNAPSHOT_THRESHOLD_MS) {
    void compactSnapshot(input.entryId, input.workspaceId).catch(() => {});
  }
}

/**
 * Publica un awareness update efímero (presence/cursors). NO se persiste.
 */
export async function publishAwareness(opts: {
  entryId: string;
  clientId: string;
  /** base64 del awareness binary update. */
  update: string;
  user: { id: string; name: string; color: string; role: string; avatarUrl?: string };
}): Promise<void> {
  await publishPubsub(COLLAB_AWARENESS_CHANNEL(opts.entryId), {
    clientId: opts.clientId,
    update: opts.update,
    user: opts.user,
  });
}

/**
 * Compacta los updates pendientes en un nuevo snapshot.
 * Concurrencia: usamos un Set in-memory por entryId para evitar dobles compactaciones
 * dentro de la misma instancia. Entre instancias, dos compactaciones simultáneas
 * son benignas — el último UPDATE gana, el state es CRDT-equivalente, y los DELETE
 * usan `lte(snapshotTimestamp)` que es idempotente.
 */
async function compactSnapshot(entryId: string, workspaceId: string): Promise<void> {
  if (!db) return;
  if (compactInflight.has(entryId)) return;
  compactInflight.add(entryId);
  try {
    // Cargar snapshot actual + todos los updates posteriores.
    const [snap] = await db
      .select({ state: collabSnapshots.state, updatedAt: collabSnapshots.updatedAt })
      .from(collabSnapshots)
      .where(
        and(eq(collabSnapshots.entryId, entryId), eq(collabSnapshots.workspaceId, workspaceId)),
      )
      .limit(1);

    const conds = [eq(collabUpdates.entryId, entryId), eq(collabUpdates.workspaceId, workspaceId)];
    const ups = snap
      ? await db
          .select({ update: collabUpdates.update, createdAt: collabUpdates.createdAt })
          .from(collabUpdates)
          .where(and(...conds, sql`${collabUpdates.createdAt} > ${snap.updatedAt}`))
          .orderBy(asc(collabUpdates.createdAt))
      : await db
          .select({ update: collabUpdates.update, createdAt: collabUpdates.createdAt })
          .from(collabUpdates)
          .where(and(...conds))
          .orderBy(asc(collabUpdates.createdAt));

    const last = ups[ups.length - 1];
    if (!last) return;

    const doc = new Y.Doc();
    if (snap) Y.applyUpdate(doc, base64ToUint8(snap.state));
    for (const u of ups) {
      Y.applyUpdate(doc, base64ToUint8(u.update));
    }
    const merged = Y.encodeStateAsUpdate(doc);
    const mergedB64 = uint8ToBase64(merged);
    const cutoff = last.createdAt;

    await db
      .insert(collabSnapshots)
      .values({
        entryId,
        workspaceId,
        state: mergedB64,
        bytes: merged.byteLength,
      })
      .onConflictDoUpdate({
        target: collabSnapshots.entryId,
        set: {
          state: mergedB64,
          bytes: merged.byteLength,
          updatedAt: new Date(),
        },
      });

    // GC: borramos updates ya consolidados (createdAt <= cutoff). Los más nuevos
    // que llegasen entre el read y el delete se conservan para la siguiente compaction.
    await db
      .delete(collabUpdates)
      .where(
        and(
          eq(collabUpdates.entryId, entryId),
          eq(collabUpdates.workspaceId, workspaceId),
          lte(collabUpdates.createdAt, cutoff),
        ),
      );

    lastSnapshotAt.set(entryId, Date.now());
    updatesSinceSnapshot.set(entryId, 0);
  } finally {
    compactInflight.delete(entryId);
  }
}

// ---- helpers binary ↔ base64 ----
export function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function uint8ToBase64(u8: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(u8).toString("base64");
  }
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i] ?? 0);
  return btoa(s);
}
