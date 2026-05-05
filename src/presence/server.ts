/**
 * F10b — Presence global en el admin.
 *
 * Cada pestaña de admin abierta envía un heartbeat cada 15s con su `route`. El
 * server hace UPSERT en `presence_sessions` y NOTIFY al canal del workspace.
 * Los SSE en otras instancias reciben el NOTIFY y enviarán el delta a sus
 * clientes conectados. Cron de cleanup borra rows con `lastSeenAt < now()-5min`.
 *
 * El payload del NOTIFY lleva todo lo necesario para hidratar el peer en el
 * cliente sin un round-trip a la DB. Pero el snapshot inicial (cuando un nuevo
 * SSE conecta) sí va contra la DB para hidratar el estado actual.
 */

import { db } from "@/db/client";
import { deleteReturningCount } from "@/db/dialect";
import { presenceSessions } from "@/db/schema";
import { publishPubsub } from "@/lib/pubsub";
import { and, eq, gte, sql } from "drizzle-orm";

/** Ventana de "online": rows con lastSeenAt más reciente que esto cuentan como activos. */
export const ONLINE_WINDOW_MS = 60_000;
/** Heartbeat cada N ms desde el cliente. Ten en cuenta que ONLINE_WINDOW_MS debe ser ≥ 2x heartbeat. */
export const HEARTBEAT_MS = 15_000;

export const PRESENCE_CHANNEL = (workspaceId: string) => `presence:ws:${workspaceId}`;

const ENTRY_ROUTE_RE =
  /^\/admin\/contenido\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Extrae un entryId del path si el route es `/admin/contenido/{uuid}`.
 * Sirve para queries del tipo "quién está editando este entry".
 */
export function entryIdFromRoute(route: string): string | null {
  const m = route.match(ENTRY_ROUTE_RE);
  return m ? (m[1] ?? null) : null;
}

export type PresencePayload = {
  /** "join" | "leave" | "update" — el cliente decide cómo aplicar al map local. */
  kind: "update" | "leave";
  workspaceId: string;
  userId: string;
  clientId: string;
  route: string;
  entryId: string | null;
  user: {
    id: string;
    name: string;
    color: string;
    role: string;
    avatarUrl?: string | null;
  };
  ts: number;
};

export async function upsertHeartbeat(input: {
  workspaceId: string;
  userId: string;
  clientId: string;
  route: string;
  user: PresencePayload["user"];
}): Promise<void> {
  if (!db) return;
  const entryId = entryIdFromRoute(input.route);
  await db
    .insert(presenceSessions)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId,
      route: input.route,
      entryId,
    })
    .onConflictDoUpdate({
      target: [presenceSessions.workspaceId, presenceSessions.clientId],
      set: {
        userId: input.userId,
        route: input.route,
        entryId,
        lastSeenAt: new Date(),
      },
    });

  await publishPubsub(PRESENCE_CHANNEL(input.workspaceId), {
    kind: "update",
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId,
    route: input.route,
    entryId,
    user: input.user,
    ts: Date.now(),
  } satisfies PresencePayload);
}

export async function leavePresence(input: {
  workspaceId: string;
  userId: string;
  clientId: string;
  user: PresencePayload["user"];
}): Promise<void> {
  if (!db) return;
  await db
    .delete(presenceSessions)
    .where(
      and(
        eq(presenceSessions.workspaceId, input.workspaceId),
        eq(presenceSessions.clientId, input.clientId),
      ),
    );
  await publishPubsub(PRESENCE_CHANNEL(input.workspaceId), {
    kind: "leave",
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId,
    route: "",
    entryId: null,
    user: input.user,
    ts: Date.now(),
  } satisfies PresencePayload);
}

/**
 * Estado actual de la presencia para hidratar un cliente que acaba de
 * conectar SSE. Devuelve los rows + datos del usuario asociado (nombre, image).
 */
export async function listActivePresence(workspaceId: string): Promise<
  Array<{
    userId: string;
    clientId: string;
    route: string;
    entryId: string | null;
    lastSeenAt: number;
    user: { id: string; name: string | null; image: string | null };
  }>
> {
  if (!db) return [];
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const rows = await db
    .select({
      userId: presenceSessions.userId,
      clientId: presenceSessions.clientId,
      route: presenceSessions.route,
      entryId: presenceSessions.entryId,
      lastSeenAt: presenceSessions.lastSeenAt,
      uId: sql<string>`u.id`,
      uName: sql<string | null>`u.name`,
      uImage: sql<string | null>`u.image`,
    })
    .from(presenceSessions)
    .innerJoin(sql`users u`, sql`u.id = ${presenceSessions.userId}`)
    .where(
      and(eq(presenceSessions.workspaceId, workspaceId), gte(presenceSessions.lastSeenAt, cutoff)),
    );
  return rows.map((r) => ({
    userId: r.userId,
    clientId: r.clientId,
    route: r.route,
    entryId: r.entryId,
    lastSeenAt: r.lastSeenAt.getTime(),
    user: { id: r.uId, name: r.uName, image: r.uImage },
  }));
}

/**
 * Comprueba qué users de la lista están "online" (sesión presence con
 * `lastSeenAt > now() - 60s`). Devuelve un Set con los IDs online.
 *
 * Uso típico: al menc'ionar usuarios, los offline reciben email; los online
 * reciben sólo notification + bell SSE (no spam de email mientras están en la app).
 */
export async function whoIsOnline(workspaceId: string, userIds: string[]): Promise<Set<string>> {
  if (!db || userIds.length === 0) return new Set();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const rows = await db
    .selectDistinct({ userId: presenceSessions.userId })
    .from(presenceSessions)
    .where(
      and(eq(presenceSessions.workspaceId, workspaceId), gte(presenceSessions.lastSeenAt, cutoff)),
    );
  const online = new Set<string>();
  for (const r of rows) {
    if (userIds.includes(r.userId)) online.add(r.userId);
  }
  return online;
}

/**
 * Cleanup de filas viejas. Llamado por el cron diario (o cron 5 min en B3 si
 * lo añadimos al vercel.json). 5 min de TTL: si una pestaña murió sin disparar
 * `leave` (crash, kill -9), su row desaparece tras este sweep.
 */
export async function purgeStalePresence(): Promise<number> {
  if (!db) return 0;
  const cutoff = new Date(Date.now() - 5 * 60_000);
  return await deleteReturningCount(
    presenceSessions,
    sql`${presenceSessions.lastSeenAt} < ${cutoff}`,
  );
}
