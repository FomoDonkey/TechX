/**
 * Auth de MIEMBRO (separada del admin Better-Auth).
 *
 * Modelo:
 *   - El miembro se identifica por (workspaceId, email).
 *   - Magic link one-shot: random 32B → hash sha256 en `member_magic_links`.
 *   - Sesión: random 32B → hash sha256 en `member_sessions`. Cookie es SOLO el
 *     token plano (no contiene workspaceId — sería editable). El workspaceId
 *     queda almacenado en la fila de `member_sessions` y se compara contra el
 *     workspace activo del request en `getCurrentMemberSession`.
 *   - TTL: magic link 15 min, sesión 30 días.
 *
 * Throttle: 5 magic links / hora por (workspaceId, email) y rate cap por (ip, ws).
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { memberMagicLinks, memberSessions } from "@/db/schema";
import { env } from "@/env";
import { and, eq, gte, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";

export const MEMBER_COOKIE = "csm.member";
const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 min
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 d
const MAX_MAGIC_LINKS_PER_HOUR_PER_EMAIL = 5;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,256}$/;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

function ipHashFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown").slice(0, 64);
  return sha256Hex(`${env.AUTH_SECRET}:${ip}`).slice(0, 32);
}

// ============================================================
// MAGIC LINKS
// ============================================================
export type CreateMagicLinkResult =
  | { ok: true; token: string }
  | { ok: false; reason: "rate_limited" | "no_db" };

export async function createMagicLink(input: {
  workspaceId: string;
  email: string;
  redirectTo?: string;
  ipHash?: string;
}): Promise<CreateMagicLinkResult> {
  if (!db) return { ok: false, reason: "no_db" };
  const email = input.email.trim().toLowerCase();

  // Throttle: 5 / hora por (ws, email)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberMagicLinks)
    .where(
      and(
        eq(memberMagicLinks.workspaceId, input.workspaceId),
        eq(memberMagicLinks.email, email),
        gte(memberMagicLinks.createdAt, oneHourAgo),
      ),
    );
  const recentCount = recent[0]?.count ?? 0;
  if (recentCount >= MAX_MAGIC_LINKS_PER_HOUR_PER_EMAIL) {
    return { ok: false, reason: "rate_limited" };
  }

  const token = randomToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000);

  await db.insert(memberMagicLinks).values({
    workspaceId: input.workspaceId,
    email,
    tokenHash,
    redirectTo: input.redirectTo ?? null,
    expiresAt,
    ipHash: input.ipHash ?? null,
  });

  return { ok: true, token };
}

/** Consume un magic link y devuelve { workspaceId, email, redirectTo } si válido. */
export async function consumeMagicLink(token: string): Promise<{
  workspaceId: string;
  email: string;
  redirectTo: string | null;
} | null> {
  if (!db) return null;
  if (typeof token !== "string" || token.length < 20 || token.length > 256) return null;
  const tokenHash = sha256Hex(token);

  // Atomic: claim row only if not used and not expired.
  const now = new Date();
  const claimed = await db
    .update(memberMagicLinks)
    .set({ usedAt: now })
    .where(
      and(
        eq(memberMagicLinks.tokenHash, tokenHash),
        sql`${memberMagicLinks.usedAt} IS NULL`,
        gte(memberMagicLinks.expiresAt, now),
      ),
    )
    .returning({
      workspaceId: memberMagicLinks.workspaceId,
      email: memberMagicLinks.email,
      redirectTo: memberMagicLinks.redirectTo,
    });

  return claimed[0] ?? null;
}

// ============================================================
// SESSIONS
// ============================================================
export type CreateSessionInput = {
  workspaceId: string;
  email: string;
  userAgent?: string | null;
  ipHash?: string | null;
};

export async function createMemberSession(input: CreateSessionInput): Promise<string> {
  if (!db) throw new Error("DB no disponible");
  const token = randomToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(memberSessions).values({
    workspaceId: input.workspaceId,
    email: input.email.trim().toLowerCase(),
    tokenHash,
    userAgent: input.userAgent ?? null,
    ipHash: input.ipHash ?? null,
    expiresAt,
  });

  // El cookie es SOLO el token plano (sin workspaceId — sería editable).
  // El workspaceId se guarda en la fila DB y se valida en getCurrentMemberSession.
  return token;
}

export type MemberSessionRow = {
  id: string;
  workspaceId: string;
  email: string;
  expiresAt: Date;
};

export async function loadMemberSessionByCookie(value: string): Promise<MemberSessionRow | null> {
  if (!db) return null;
  if (!TOKEN_RE.test(value)) return null;
  const tokenHash = sha256Hex(value);
  const now = new Date();

  const rows = await db
    .select({
      id: memberSessions.id,
      workspaceId: memberSessions.workspaceId,
      email: memberSessions.email,
      expiresAt: memberSessions.expiresAt,
    })
    .from(memberSessions)
    .where(and(eq(memberSessions.tokenHash, tokenHash), gte(memberSessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // bump lastSeenAt async (no await — best-effort, swallow errors).
  void db
    .update(memberSessions)
    .set({ lastSeenAt: now })
    .where(eq(memberSessions.id, row.id))
    .catch(() => null);

  return row;
}

export async function revokeMemberSessionByCookie(value: string): Promise<void> {
  if (!db) return;
  if (!TOKEN_RE.test(value)) return;
  const tokenHash = sha256Hex(value);
  await db.delete(memberSessions).where(eq(memberSessions.tokenHash, tokenHash));
}

// ============================================================
// Cookie helpers (Server-side)
// ============================================================
export async function setMemberCookie(cookieValue: string): Promise<void> {
  const jar = await cookies();
  jar.set(MEMBER_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearMemberCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(MEMBER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Lee la sesión actual desde cookies. Si la sesión es de OTRO workspace
 * que el activo en la request, devuelve null (defensa multi-tenant).
 */
export async function getCurrentMemberSession(
  workspaceId: string,
): Promise<MemberSessionRow | null> {
  const jar = await cookies();
  const value = jar.get(MEMBER_COOKIE)?.value;
  if (!value) return null;
  const session = await loadMemberSessionByCookie(value);
  if (!session) return null;
  if (session.workspaceId !== workspaceId) return null;
  return session;
}

/**
 * Devuelve `ipHash` para la request actual (read-only). Útil para crear
 * magic links sin pasar el header explícitamente.
 */
export async function currentIpHash(): Promise<string> {
  const h = await headers();
  return ipHashFromHeaders(h);
}

/**
 * Garbage collection helper (cron). Borra:
 *  - Sesiones expiradas
 *  - Magic links expirados
 *  - Magic links USADOS hace más de 1h (mantenemos 1h para auditoría inmediata
 *    de reusos sospechosos / soporte; después se purgan).
 */
export async function purgeExpiredMemberAuth(): Promise<{ sessions: number; magic: number }> {
  if (!db) return { sessions: 0, magic: 0 };
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const sessions = await db
    .delete(memberSessions)
    .where(sql`${memberSessions.expiresAt} < ${now}`)
    .returning({ id: memberSessions.id });
  const magic = await db
    .delete(memberMagicLinks)
    .where(
      sql`${memberMagicLinks.expiresAt} < ${now} OR (${memberMagicLinks.usedAt} IS NOT NULL AND ${memberMagicLinks.usedAt} < ${oneHourAgo})`,
    )
    .returning({ id: memberMagicLinks.id });
  return { sessions: sessions.length, magic: magic.length };
}
