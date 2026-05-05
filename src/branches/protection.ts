/**
 * Reglas de protección avanzadas para branches.
 *
 * Cierra la deuda F9b L1: hasta ahora `branches.isProtected` sólo gateaba
 * borrado/merge a role>=admin. F10a parte 2 bloque 3 añade un objeto
 * `protectionConfig` jsonb con cuatro reglas opcionales que deben pasar antes
 * de que `mergeBranch` proceda. Cada regla devuelve un blocker descriptivo
 * que la UI usa para mostrar checklist.
 *
 * Política de blockers:
 * - Una regla `requireReviewers: 0` ó `requireApprovers: 0` se considera
 *   inactiva (no es blocker aunque haya 0 reviewers).
 * - `requireCommentsResolved: true` exige que TODOS los `branch_comments`
 *   con status='open' estén resueltos antes del merge.
 * - `requireStatusApproved: true` exige que TODAS las entries del branch
 *   estén en status `approved`, `scheduled` o `published` (no `draft`/`review`).
 *
 * Bypass admin: el caller pasa `actorRole`. Si es `owner` o `admin` y
 * `protectionConfig.allowAdminBypass` es true (futuro), se ignora el blocker.
 * En esta versión NO permitimos bypass — la regla aplica a todos. Política
 * que un admin podría querer cambiar en futuro: por ahora "force = abandon
 * + remerge sin protección" es la vía de escape.
 */

import { db } from "@/db/client";
import {
  type EditorialAssignmentRole,
  branchComments,
  branches,
  entries,
  entryAssignments,
} from "@/db/schema";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

export type BranchProtectionConfig = {
  requireReviewers: number;
  requireApprovers: number;
  requireCommentsResolved: boolean;
  requireStatusApproved: boolean;
};

export const DEFAULT_PROTECTION_CONFIG: BranchProtectionConfig = {
  requireReviewers: 0,
  requireApprovers: 0,
  requireCommentsResolved: false,
  requireStatusApproved: false,
};

export type ProtectionBlocker = {
  /** Identificador estable para que la UI pueda mostrar icono/agrupar. */
  rule: "reviewers" | "approvers" | "comments_resolved" | "status_approved" | "is_protected";
  /** Mensaje legible en español. */
  message: string;
  /** Datos adicionales (counts, etc.) para que la UI haga drill-down. */
  meta?: Record<string, unknown>;
};

export type ProtectionEvaluation = {
  ok: boolean;
  blockers: ProtectionBlocker[];
  /** Cómo está configurada la branch al momento de evaluar. */
  config: BranchProtectionConfig;
};

/**
 * Evalúa todas las reglas de protección de la branch y devuelve la lista
 * de blockers. `ok: true` cuando blockers está vacío.
 *
 * Idempotente, sin mutaciones. Se invoca desde `mergeBranch` (gate) y desde
 * la UI de `/admin/branches/[id]` (preview de blockers para el merge).
 */
export async function evaluateBranchProtection(
  workspaceId: string,
  branchId: string,
): Promise<ProtectionEvaluation> {
  if (!db) {
    return { ok: true, blockers: [], config: DEFAULT_PROTECTION_CONFIG };
  }

  const [branch] = await db
    .select({
      id: branches.id,
      isProtected: branches.isProtected,
      protectionConfig: branches.protectionConfig,
    })
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.id, branchId)))
    .limit(1);

  if (!branch) {
    return { ok: true, blockers: [], config: DEFAULT_PROTECTION_CONFIG };
  }

  const config: BranchProtectionConfig = {
    ...DEFAULT_PROTECTION_CONFIG,
    ...(branch.protectionConfig ?? {}),
  };

  const blockers: ProtectionBlocker[] = [];

  // Recolección de IDs de entries del branch — base para 3 reglas.
  const branchEntries = await db
    .select({ id: entries.id, status: entries.status })
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), eq(entries.branchId, branchId)));
  const branchEntryIds = branchEntries.map((e) => e.id);

  // 1. requireReviewers: ¿hay al menos N reviewers asignados (algún entry)?
  if (config.requireReviewers > 0) {
    const reviewerCount = await countActiveAssignees({
      workspaceId,
      entryIds: branchEntryIds,
      role: "reviewer",
    });
    if (reviewerCount < config.requireReviewers) {
      blockers.push({
        rule: "reviewers",
        message: `Faltan reviewers: hay ${reviewerCount} de ${config.requireReviewers} requeridos`,
        meta: { current: reviewerCount, required: config.requireReviewers },
      });
    }
  }

  // 2. requireApprovers
  if (config.requireApprovers > 0) {
    const approverCount = await countActiveAssignees({
      workspaceId,
      entryIds: branchEntryIds,
      role: "approver",
    });
    if (approverCount < config.requireApprovers) {
      blockers.push({
        rule: "approvers",
        message: `Faltan approvers: hay ${approverCount} de ${config.requireApprovers} requeridos`,
        meta: { current: approverCount, required: config.requireApprovers },
      });
    }
  }

  // 3. requireCommentsResolved
  if (config.requireCommentsResolved) {
    const [openCount] = await db
      .select({ n: count() })
      .from(branchComments)
      .where(
        and(
          eq(branchComments.workspaceId, workspaceId),
          eq(branchComments.branchId, branchId),
          eq(branchComments.status, "open"),
        ),
      );
    const n = openCount?.n ?? 0;
    if (n > 0) {
      blockers.push({
        rule: "comments_resolved",
        message: `Hay ${n} comentario${n === 1 ? "" : "s"} sin resolver`,
        meta: { open: n },
      });
    }
  }

  // 4. requireStatusApproved
  if (config.requireStatusApproved) {
    const APPROVED_STATUSES = new Set(["approved", "scheduled", "published"]);
    const notReady = branchEntries.filter((e) => !APPROVED_STATUSES.has(e.status));
    if (notReady.length > 0) {
      blockers.push({
        rule: "status_approved",
        message: `Hay ${notReady.length} entr${notReady.length === 1 ? "ada" : "adas"} sin aprobar`,
        meta: { count: notReady.length, statuses: notReady.map((e) => e.status) },
      });
    }
  }

  return { ok: blockers.length === 0, blockers, config };
}

async function countActiveAssignees(input: {
  workspaceId: string;
  entryIds: string[];
  role: EditorialAssignmentRole;
}): Promise<number> {
  if (!db) return 0;
  if (input.entryIds.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`COUNT(DISTINCT ${entryAssignments.assigneeId})::int` })
    .from(entryAssignments)
    .where(
      and(
        eq(entryAssignments.workspaceId, input.workspaceId),
        inArray(entryAssignments.entryId, input.entryIds),
        eq(entryAssignments.role, input.role),
        isNull(entryAssignments.completedAt),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Persiste un nuevo `protectionConfig` para una branch. Reemplaza el actual
 * en su totalidad — null para borrar las reglas y dejar la branch sin
 * protección avanzada.
 */
export async function setBranchProtectionConfig(input: {
  workspaceId: string;
  branchId: string;
  config: BranchProtectionConfig | null;
}): Promise<void> {
  if (!db) return;
  await db
    .update(branches)
    .set({
      protectionConfig: input.config,
      updatedAt: new Date(),
    })
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
}
