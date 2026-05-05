import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { type Branch, branchActivity, branches } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const TOKEN_BYTES = 24;

export function generatePreviewToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Salt incluye `branchId` para que dos branches con la misma password no
 * compartan hash (defiende contra rainbow tables a nivel de DB read).
 */
export function hashPreviewPassword(password: string, branchId: string): string {
  return createHash("sha256").update(`csm:preview:${branchId}:${password}`).digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type RotateTokenInput = {
  workspaceId: string;
  branchId: string;
  actorId: string;
  password?: string | null;
  expiresAt?: Date | null;
};

export async function rotatePreviewToken(input: RotateTokenInput): Promise<{
  token: string;
  expiresAt: Date | null;
}> {
  if (!db) throw new Error("DB no configurada");
  const token = generatePreviewToken();
  const passwordHash = input.password ? hashPreviewPassword(input.password, input.branchId) : null;

  await db
    .update(branches)
    .set({
      previewToken: token,
      previewPasswordHash: passwordHash,
      previewExpiresAt: input.expiresAt ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
  const [updated] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)))
    .limit(1);
  if (!updated) throw new Error("Branch no encontrada");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    type: "branch.preview_token_rotated",
    actorId: input.actorId,
    payload: {
      hasPassword: !!passwordHash,
      expiresAt: input.expiresAt?.toISOString() ?? null,
    },
  });
  return { token, expiresAt: input.expiresAt ?? null };
}

export async function clearPreviewToken(input: {
  workspaceId: string;
  branchId: string;
  actorId: string;
}): Promise<void> {
  if (!db) return;
  await db
    .update(branches)
    .set({
      previewToken: null,
      previewPasswordHash: null,
      previewExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    type: "branch.preview_token_rotated",
    actorId: input.actorId,
    payload: { cleared: true },
  });
}

/**
 * Valida un token de preview. Devuelve la branch si es válido + activo, NULL si no.
 * Si requiere password, el caller debe pasarlo en `password`.
 */
export async function resolvePreviewBranch(input: {
  token: string;
  password?: string | null;
}): Promise<
  | {
      branch: Branch;
      reason?: never;
    }
  | {
      branch?: never;
      reason: "not-found" | "expired" | "password-required" | "wrong-password" | "branch-closed";
    }
> {
  if (!db) return { reason: "not-found" };
  if (!input.token || input.token.length < 16) return { reason: "not-found" };
  const [row] = await db
    .select()
    .from(branches)
    .where(eq(branches.previewToken, input.token))
    .limit(1);
  if (!row) return { reason: "not-found" };
  if (row.status === "merged" || row.status === "abandoned") return { reason: "branch-closed" };
  if (row.previewExpiresAt && row.previewExpiresAt.getTime() < Date.now()) {
    return { reason: "expired" };
  }
  if (row.previewPasswordHash) {
    if (!input.password) return { reason: "password-required" };
    const expected = hashPreviewPassword(input.password, row.id);
    if (!constantTimeEqualHex(expected, row.previewPasswordHash)) {
      return { reason: "wrong-password" };
    }
  }
  return { branch: row };
}

/** Best-effort tracking de hits — no bloquea response. */
export async function bumpPreviewView(branchId: string): Promise<void> {
  if (!db) return;
  await db
    .update(branches)
    .set({ previewViews: sql`${branches.previewViews} + 1` })
    .where(eq(branches.id, branchId));
}
