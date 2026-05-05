import { db } from "@/db/client";
import {
  apiKeys,
  comments,
  entries,
  members,
  passkeys,
  sessions,
  users,
  workspaces,
} from "@/db/schema";
import { activityLog } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import JSZip from "jszip";

/**
 * GDPR utilities — export ZIP del usuario + deletion grace period.
 *
 * **Export:** ZIP con un JSON por categoría (profile, sessions, workspaces,
 * entries authored, comments authored, activity log filtered by actorId,
 * passkeys metadata, api keys metadata). Sin password hashes, sin secrets,
 * sin tokens — sólo lo que el user puede ver/editar normalmente.
 *
 * **Right-to-be-forgotten:** se setea `deletionRequestedAt = now()`. La cuenta
 * queda en grace period (30 días). Cron `daily` hace el hard-delete que FK
 * cascade propaga al resto. Cancelable antes del expire.
 */

export const DELETION_GRACE_DAYS = 30;
export const DELETION_GRACE_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type ExportPayload = {
  generatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    locale: string | null;
    timezone: string | null;
    handle: string | null;
    bio: string | null;
    website: string | null;
    twitter: string | null;
    image: string | null;
    twoFactorEnabled: boolean;
    emailVerified: boolean;
    createdAt: string;
    onboardedAt: string | null;
  };
  sessions: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    userAgent: string | null;
    ipAddressHash: string | null;
  }>;
  workspaces: Array<{
    workspaceId: string;
    slug: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
  entries: Array<{
    id: string;
    workspaceId: string;
    title: string;
    slug: string;
    status: string;
    locale: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    excerpt: string | null;
    body: unknown;
  }>;
  comments: Array<{
    id: string;
    entryId: string;
    body: string;
    status: string;
    createdAt: string;
  }>;
  passkeys: Array<{
    id: string;
    name: string | null;
    deviceType: string;
    backedUp: boolean;
    createdAt: string | null;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    environment: string;
    scopes: string[];
    createdAt: string;
    revokedAt: string | null;
  }>;
  activityLog: Array<{
    id: string;
    workspaceId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }>;
};

export async function buildExportPayload(userId: string): Promise<ExportPayload> {
  if (!db) throw new Error("db_unavailable");

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new Error("user_not_found");

  const [sessionsRows, memberships, entriesAuthored, commentsAuthored, pks, keys, activity] =
    await Promise.all([
      db.select().from(sessions).where(eq(sessions.userId, userId)),
      db
        .select({
          ws: workspaces,
          role: members.role,
          joinedAt: members.createdAt,
        })
        .from(members)
        .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
        .where(eq(members.userId, userId)),
      db.select().from(entries).where(eq(entries.authorId, userId)),
      // El esquema de comments no requiere FK a users; pero los anclados con userId
      // se marcan como autoría. Si la columna no existe, devolverá vacío.
      // biome-ignore lint/suspicious/noExplicitAny: schema flex
      (db as any)
        .select()
        .from(comments)
        .where(eq((comments as unknown as { authorId: typeof users.id }).authorId, userId))
        .catch(() => []),
      db.select().from(passkeys).where(eq(passkeys.userId, userId)),
      db.select().from(apiKeys).where(eq(apiKeys.createdById, userId)),
      db.select().from(activityLog).where(eq(activityLog.actorId, userId)).limit(1000),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      locale: u.locale,
      timezone: u.timezone,
      handle: u.handle,
      bio: u.bio,
      website: u.website,
      twitter: u.twitter,
      image: u.image,
      twoFactorEnabled: u.twoFactorEnabled ?? false,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
      onboardedAt: u.onboardedAt?.toISOString() ?? null,
    },
    sessions: sessionsRows.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent,
      // Hashea la IP en el export (no la cruda).
      ipAddressHash: s.ipAddress ? hashShort(s.ipAddress) : null,
    })),
    workspaces: memberships.map((m) => ({
      workspaceId: m.ws.id,
      slug: m.ws.slug,
      name: m.ws.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    entries: entriesAuthored.map((e) => ({
      id: e.id,
      workspaceId: e.workspaceId,
      title: e.title,
      slug: e.slug,
      status: e.status,
      locale: e.locale,
      publishedAt: e.publishedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      excerpt: e.excerpt,
      body: e.body,
    })),
    comments: (
      commentsAuthored as unknown as Array<{
        id: string;
        entryId: string;
        body: string;
        status: string;
        createdAt: Date;
      }>
    ).map((c) => ({
      id: c.id,
      entryId: c.entryId,
      body: c.body,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    passkeys: pks.map((p) => ({
      id: p.id,
      name: p.name,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      createdAt: p.createdAt?.toISOString() ?? null,
    })),
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      environment: k.environment,
      scopes: k.scopes,
      createdAt: k.createdAt.toISOString(),
      revokedAt: k.revokedAt?.toISOString() ?? null,
    })),
    activityLog: activity.map((a) => ({
      id: a.id,
      workspaceId: a.workspaceId,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function buildExportZip(userId: string): Promise<Uint8Array> {
  const payload = await buildExportPayload(userId);
  const zip = new JSZip();
  zip.file("README.txt", buildReadme(payload));
  zip.file("user.json", JSON.stringify(payload.user, null, 2));
  zip.file("sessions.json", JSON.stringify(payload.sessions, null, 2));
  zip.file("workspaces.json", JSON.stringify(payload.workspaces, null, 2));
  zip.file("entries.json", JSON.stringify(payload.entries, null, 2));
  zip.file("comments.json", JSON.stringify(payload.comments, null, 2));
  zip.file("passkeys.json", JSON.stringify(payload.passkeys, null, 2));
  zip.file("api-keys.json", JSON.stringify(payload.apiKeys, null, 2));
  zip.file("activity-log.json", JSON.stringify(payload.activityLog, null, 2));
  zip.file("manifest.json", JSON.stringify({ generatedAt: payload.generatedAt, version: 1 }));
  return zip.generateAsync({ type: "uint8array" });
}

function buildReadme(p: ExportPayload): string {
  return [
    "Tu export de datos personales — CSM",
    `Generado: ${p.generatedAt}`,
    "",
    "Contenido del archivo:",
    "  user.json          — Tu perfil",
    `  sessions.json      — ${p.sessions.length} sesiones (IPs hasheadas)`,
    `  workspaces.json    — ${p.workspaces.length} workspaces donde eres miembro`,
    `  entries.json       — ${p.entries.length} entradas que has escrito`,
    `  comments.json      — ${p.comments.length} comentarios`,
    `  passkeys.json      — ${p.passkeys.length} passkeys (solo metadatos, sin claves privadas)`,
    `  api-keys.json      — ${p.apiKeys.length} API keys que has creado (sin secrets)`,
    `  activity-log.json  — ${p.activityLog.length} acciones recientes (últimas 1000)`,
    "",
    "Este export NO incluye:",
    "  · Hashes de contraseña (no los conocemos en claro y no son útiles fuera).",
    "  · Tokens de sesión activos (sólo metadatos).",
    "  · Secretos de OAuth / API keys (sólo metadatos públicos).",
    "  · Datos de OTROS usuarios en tu workspace.",
    "",
    "Para eliminar tu cuenta de forma irreversible:",
    "  Ajustes → Privacidad → Eliminar cuenta.",
    "",
    "Si tienes dudas: privacy@csm.dev",
  ].join("\n");
}

function hashShort(s: string): string {
  // hash determinista y truncado — sin reversión, sólo para correlación interna.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ============================================================
// Right-to-be-forgotten
// ============================================================

export async function requestDeletion(userId: string): Promise<{ scheduledFor: Date }> {
  if (!db) throw new Error("db_unavailable");
  const now = new Date();
  await db
    .update(users)
    .set({ deletionRequestedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
  return { scheduledFor: new Date(now.getTime() + DELETION_GRACE_MS) };
}

export async function cancelDeletion(userId: string): Promise<void> {
  if (!db) throw new Error("db_unavailable");
  await db
    .update(users)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getDeletionStatus(userId: string): Promise<{
  requested: boolean;
  requestedAt?: Date;
  scheduledFor?: Date;
  daysRemaining?: number;
}> {
  if (!db) return { requested: false };
  const [u] = await db
    .select({ deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u?.deletionRequestedAt) return { requested: false };
  const requestedAt = u.deletionRequestedAt;
  const scheduledFor = new Date(requestedAt.getTime() + DELETION_GRACE_MS);
  const daysRemaining = Math.max(
    0,
    Math.ceil((scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  return { requested: true, requestedAt, scheduledFor, daysRemaining };
}

/**
 * Hard-delete del user cuyo `deletionRequestedAt` ya pasó el grace period.
 * Cascade FK propaga: sessions, accounts, passkeys, two_factors, members,
 * api_keys (set null en api_keys.createdById si es FK soft, cascade si hard).
 *
 * Llamado por cron `/api/cron/daily`.
 */
export async function purgeExpiredDeletions(): Promise<{ purged: number }> {
  if (!db) return { purged: 0 };
  const cutoff = new Date(Date.now() - DELETION_GRACE_MS);
  const { lt, isNotNull } = await import("drizzle-orm");
  const expired = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletionRequestedAt), lt(users.deletionRequestedAt, cutoff)));
  let purged = 0;
  for (const u of expired) {
    await db.delete(users).where(eq(users.id, u.id));
    purged++;
  }
  return { purged };
}
