/**
 * F11a — Rename del slug de un workspace, con registro en
 * `workspace_slug_history` para que enlaces externos al slug viejo
 * sigan funcionando 30 días vía 301.
 */

import { db, dialect } from "@/db/client";
import { workspaceSlugHistory, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { and, eq, gt, sql } from "drizzle-orm";
import { RESERVED_SLUGS, validateSlug } from "./slug";

// MySQL no usa drizzle defaultRandom() para uuid; el id se genera app-side
// pero solo lo necesitamos cuando dialect=mysql.

export const SLUG_HISTORY_TTL_DAYS = 30;

export type SlugRenameResult =
  | { ok: true; oldSlug: string; newSlug: string }
  | { ok: false; reason: SlugRenameError };

export type SlugRenameError =
  | "invalid"
  | "reserved"
  | "taken_workspace"
  | "taken_history"
  | "no_change"
  | "db_disabled"
  | "workspace_not_found";

/**
 * Comprueba si un slug está disponible (sin hacer cambios). Verde si:
 *  - es válido sintácticamente y no reservado
 *  - no es el slug actual de OTRO workspace
 *  - no es un slug histórico no expirado de OTRO workspace
 *
 * Si el slug coincide con el slug actual del workspace que llama,
 * `availableForSelf=true` para que la UI muestre "ya es el tuyo".
 */
export async function checkSlugAvailability(
  slug: string,
  callerWorkspaceId: string,
): Promise<
  { ok: true; slug: string; availableForSelf: boolean } | { ok: false; reason: SlugRenameError }
> {
  const v = validateSlug(slug);
  if (!v.ok) return { ok: false, reason: v.error === "reserved" ? "reserved" : "invalid" };
  if (!db) return { ok: false, reason: "db_disabled" };

  const [taken] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, v.slug))
    .limit(1);
  if (taken) {
    return taken.id === callerWorkspaceId
      ? { ok: true, slug: v.slug, availableForSelf: true }
      : { ok: false, reason: "taken_workspace" };
  }

  const [history] = await db
    .select({ workspaceId: workspaceSlugHistory.workspaceId })
    .from(workspaceSlugHistory)
    .where(
      and(eq(workspaceSlugHistory.oldSlug, v.slug), gt(workspaceSlugHistory.expiresAt, sql`now()`)),
    )
    .limit(1);
  if (history && history.workspaceId !== callerWorkspaceId) {
    return { ok: false, reason: "taken_history" };
  }

  return { ok: true, slug: v.slug, availableForSelf: false };
}

/**
 * Renombra el slug del workspace + registra el viejo en el historial.
 * Atomic: usa transacción para que no quede el workspace renombrado sin
 * historial (si reload el viejo slug antes de añadirlo, daría 404).
 */
export async function renameWorkspaceSlug(args: {
  workspaceId: string;
  newSlug: string;
  actorId: string;
}): Promise<SlugRenameResult> {
  if (!db) return { ok: false, reason: "db_disabled" };

  const v = validateSlug(args.newSlug);
  if (!v.ok) {
    return { ok: false, reason: v.error === "reserved" ? "reserved" : "invalid" };
  }

  // Lookup workspace actual
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId))
    .limit(1);
  if (!ws) return { ok: false, reason: "workspace_not_found" };
  if (ws.slug === v.slug) return { ok: false, reason: "no_change" };

  // Ya tomado por otro workspace?
  const [taken] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, v.slug))
    .limit(1);
  if (taken && taken.id !== args.workspaceId) {
    return { ok: false, reason: "taken_workspace" };
  }
  // Ya tomado por historial vivo de otro workspace?
  const [history] = await db
    .select({ workspaceId: workspaceSlugHistory.workspaceId })
    .from(workspaceSlugHistory)
    .where(
      and(eq(workspaceSlugHistory.oldSlug, v.slug), gt(workspaceSlugHistory.expiresAt, sql`now()`)),
    )
    .limit(1);
  if (history && history.workspaceId !== args.workspaceId) {
    return { ok: false, reason: "taken_history" };
  }

  const oldSlug = ws.slug;
  const expiresAt = new Date(Date.now() + SLUG_HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Atomic rename + history insert. Si el INSERT del history falla porque
  // ya había una fila con ese oldSlug (ej. el workspace ya fue renombrado
  // antes a otro slug y luego de vuelta), hacemos UPDATE de la fila existente.
  // Usamos drizzle's onConflictDoUpdate (typed) en lugar de raw SQL para que
  // el driver convierta correctamente Date → timestamp.
  await db.transaction(async (tx) => {
    await tx
      .update(workspaces)
      .set({ slug: v.slug, updatedAt: new Date() })
      .where(eq(workspaces.id, args.workspaceId));

    if (dialect === "postgres") {
      await tx
        .insert(workspaceSlugHistory)
        .values({
          workspaceId: args.workspaceId,
          oldSlug,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: workspaceSlugHistory.oldSlug,
          set: {
            workspaceId: args.workspaceId,
            changedAt: new Date(),
            expiresAt,
          },
        });
    } else {
      // MySQL: ON DUPLICATE KEY UPDATE. Generamos id app-side (ADR-003).
      const insertChain = tx.insert(workspaceSlugHistory).values({
        id: crypto.randomUUID(),
        workspaceId: args.workspaceId,
        oldSlug,
        expiresAt,
      });
      // biome-ignore lint/suspicious/noExplicitAny: drizzle MySQL chain typing — el barrel re-exporta tipos PG
      await (insertChain as any).onDuplicateKeyUpdate({
        set: {
          workspaceId: args.workspaceId,
          changedAt: new Date(),
          expiresAt,
        },
      });
    }
  });

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    action: "workspace.slug_rename",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { oldSlug, newSlug: v.slug, expiresAt: expiresAt.toISOString() },
  });

  return { ok: true, oldSlug, newSlug: v.slug };
}

/**
 * Limpia historial expirado. Llamable desde un cron diario (defensa: el
 * resolver ya filtra por `expiresAt > now()`, pero la tabla se limpia para
 * mantenerla pequeña y liberar slugs).
 */
export async function purgeExpiredSlugHistory(): Promise<number> {
  if (!db) return 0;
  const r = await db
    .delete(workspaceSlugHistory)
    .where(sql`${workspaceSlugHistory.expiresAt} <= now()`);
  // drizzle delete devuelve diferentes shapes según driver; tratamos best-effort.
  const count = (r as unknown as { rowCount?: number }).rowCount ?? 0;
  return count;
}

/**
 * Util para tests/admin: lista los slugs reservados (proxy del Set).
 */
export function listReservedSlugs(): string[] {
  return [...RESERVED_SLUGS].sort();
}
