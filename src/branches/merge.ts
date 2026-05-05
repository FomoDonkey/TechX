import { db } from "@/db/client";
import { atomicClaim } from "@/db/dialect";
import {
  type Branch,
  type Entry,
  branchActivity,
  branches,
  editorialThreads,
  entries,
  entryAssignments,
  entryWorkflowEvents,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { ensureUniqueEntrySlug } from "@/lib/entries";
import { enqueueIndex } from "@/search/jobs";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { listBranchConflicts } from "./cow";
import { type ProtectionBlocker, evaluateBranchProtection } from "./protection";

/**
 * F9c.9a fix C-4: antes de borrar una entry fork (al merge), reapuntamos
 * el audit trail editorial (assignments, workflow events, threads) al `mainId`.
 * Si `mainId` es null (es decir, la fork era 'new' y se promueve creando una
 * nueva entry main), reapuntamos al id que reemplaza al fork.
 * Sin esto, el FK cascade borraría el historial al merge.
 */
async function transferEditorialAuditToMain(
  workspaceId: string,
  forkId: string,
  newOwnerEntryId: string,
) {
  if (!db) return;
  if (forkId === newOwnerEntryId) return;
  await Promise.all([
    db
      .update(entryAssignments)
      .set({ entryId: newOwnerEntryId })
      .where(
        and(eq(entryAssignments.workspaceId, workspaceId), eq(entryAssignments.entryId, forkId)),
      ),
    db
      .update(entryWorkflowEvents)
      .set({ entryId: newOwnerEntryId })
      .where(
        and(
          eq(entryWorkflowEvents.workspaceId, workspaceId),
          eq(entryWorkflowEvents.entryId, forkId),
        ),
      ),
    db
      .update(editorialThreads)
      .set({ entryId: newOwnerEntryId })
      .where(
        and(eq(editorialThreads.workspaceId, workspaceId), eq(editorialThreads.entryId, forkId)),
      ),
  ]);
}

/**
 * Resolución por entry para el merge:
 *  - "use_branch": el contenido de la fork sobreescribe main.
 *  - "use_main":  descartar la fork (efectivamente revert).
 *  - "skip":      no tocar esta entry — quedará en la branch tras el merge (parcial).
 */
export type MergeResolution = "use_branch" | "use_main" | "skip";

export type MergePlanItem = {
  forkId: string;
  /** mainId puede ser null si la entry es 'new' (creada en branch). */
  mainId: string | null;
  state: "forked" | "new" | "deleted";
  isConflict: boolean;
  /** Qué hará el merge si nadie pasa override. */
  defaultAction: "promote" | "delete_main" | "create_in_main";
};

export type MergePlan = {
  branchId: string;
  branchSlug: string;
  branchName: string;
  items: MergePlanItem[];
  conflicts: MergePlanItem[];
  /** True si hay conflictos no resueltos por el caller. */
  blocked: boolean;
};

export async function buildMergePlan(input: {
  workspaceId: string;
  branchId: string;
}): Promise<MergePlan | null> {
  if (!db) return null;
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)))
    .limit(1);
  if (!branch) return null;
  if (branch.isDefault) {
    return {
      branchId: branch.id,
      branchSlug: branch.slug,
      branchName: branch.name,
      items: [],
      conflicts: [],
      blocked: true,
    };
  }

  const branchEntries = await db
    .select({
      id: entries.id,
      originalEntryId: entries.originalEntryId,
      branchState: entries.branchState,
      branchedFromUpdatedAt: entries.branchedFromUpdatedAt,
    })
    .from(entries)
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.branchId, input.branchId)));

  const conflicts = await listBranchConflicts({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
  });
  const conflictForkIds = new Set(conflicts.map((c) => c.forkId));

  const items: MergePlanItem[] = branchEntries
    .filter((e) => e.branchState !== null)
    .map((e) => {
      const state = e.branchState as "forked" | "new" | "deleted";
      const defaultAction =
        state === "new"
          ? ("create_in_main" as const)
          : state === "deleted"
            ? ("delete_main" as const)
            : ("promote" as const);
      return {
        forkId: e.id,
        mainId: e.originalEntryId ?? null,
        state,
        isConflict: conflictForkIds.has(e.id),
        defaultAction,
      };
    });

  return {
    branchId: branch.id,
    branchSlug: branch.slug,
    branchName: branch.name,
    items,
    conflicts: items.filter((i) => i.isConflict),
    blocked: items.some((i) => i.isConflict),
  };
}

export type MergeOptions = {
  /** Override por forkId. Si ausente, se usa defaultAction y bloquea por conflicts. */
  resolutions?: Record<string, MergeResolution>;
  /** Si true, ignora isConflict y aplica resolutions / defaults sin importar mainUpdatedAt. */
  force?: boolean;
};

export type MergeResult = {
  ok: boolean;
  promoted: number;
  deletedFromMain: number;
  createdInMain: number;
  skipped: number;
  errors: Array<{ forkId: string; error: string }>;
  conflictsBlocked?: string[];
  /**
   * Reglas de `branches.protectionConfig` que no se cumplen. Si está presente y
   * no vacío, el merge fue rechazado antes incluso de claim. La UI muestra esto
   * como checklist; el user debe satisfacer las reglas y reintentar.
   */
  protectionBlocked?: ProtectionBlocker[];
};

/**
 * Merge atómico:
 *  1. Claim atómico: UPDATE branches SET status='merging' WHERE status='draft' RETURNING.
 *     Si returning vacío → ya hay un caller mergeando.
 *  2. Para cada fork item, aplicar acción según defaultAction + override.
 *     - promote: copia campos de fork a main entry, borra fork
 *     - delete_main: borra main entry (y todas sus referencias por cascade)
 *     - create_in_main: limpia branchId/branchState y deja la entry como main, ajusta slug
 *  3. Marcar branch.status='merged' + mergedAt + mergedById.
 *
 * Si algún item falla, se intenta continuar con los demás (best-effort) y se reportan
 * en `errors[]`. La branch queda en `status='merging'` si hubo errores, para que el
 * usuario pueda re-intentar tras corregir.
 */
export async function mergeBranch(input: {
  workspaceId: string;
  branchId: string;
  actorId: string;
  options?: MergeOptions;
}): Promise<MergeResult> {
  if (!db) {
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [{ forkId: "", error: "DB no configurada" }],
    };
  }
  const opts = input.options ?? {};
  const resolutions = opts.resolutions ?? {};

  // Pre-check: branch existe + no es main + en draft. (Sin claim aún.)
  const [pre] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)))
    .limit(1);
  if (!pre) {
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [{ forkId: "", error: "Branch no encontrada" }],
    };
  }
  if (pre.isDefault) {
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [{ forkId: "", error: "No se puede mergear main sobre sí misma" }],
    };
  }

  // F10a parte 2 bloque 3: gate de protección antes del claim. Si hay reglas
  // configuradas y no se cumplen, devolvemos `protectionBlocked` con la lista
  // de blockers para que la UI los muestre como checklist. NO claim aún —
  // un merge fallido por protección no debería ocupar `status='merging'`.
  // `force` NO bypassa protección (a diferencia de conflicts) por diseño:
  // las reglas se cambian en /admin/branches/[id]/protection si hace falta.
  const protection = await evaluateBranchProtection(input.workspaceId, input.branchId);
  if (!protection.ok) {
    await db.insert(branchActivity).values({
      workspaceId: input.workspaceId,
      branchId: input.branchId,
      type: "branch.merge_failed",
      actorId: input.actorId,
      payload: {
        reason: "protection",
        blockers: protection.blockers.map((b) => b.rule),
      },
    });
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [],
      protectionBlocked: protection.blockers,
    };
  }

  // 1. Claim atómico: status='draft' → 'merging'. Patrón anti-race ya usado en F8b/F9a.
  // Permitimos también claim si la branch lleva ≥5 min en 'merging' (proceso muerto)
  // — sin esto, un crash entre claim y commit dejaría la branch indefinidamente bloqueada.
  const STUCK_MERGE_THRESHOLD_MS = 5 * 60 * 1000;
  const stuckCutoff = new Date(Date.now() - STUCK_MERGE_THRESHOLD_MS);
  const claimed = await atomicClaim<{
    id: string;
    isDefault: boolean;
    status: string;
    updatedAt: Date;
  }>(branches, {
    where: and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId))!,
    precondition: (row) =>
      row.isDefault === false &&
      (row.status === "draft" ||
        (row.status === "merging" && row.updatedAt.getTime() < stuckCutoff.getTime())),
    set: { status: "merging", updatedAt: new Date() },
  });

  if (!claimed) {
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [
        {
          forkId: "",
          error: `Branch en estado ${pre.status} — ya hay un merge en curso o terminó`,
        },
      ],
    };
  }

  const plan = await buildMergePlan(input);
  if (!plan) {
    await releaseMerging(input);
    return {
      ok: false,
      promoted: 0,
      deletedFromMain: 0,
      createdInMain: 0,
      skipped: 0,
      errors: [{ forkId: "", error: "Plan no calculable" }],
    };
  }

  // Bloqueo por conflictos no resueltos.
  if (!opts.force) {
    const unresolved = plan.conflicts.filter((c) => !resolutions[c.forkId]);
    if (unresolved.length > 0) {
      await releaseMerging(input);
      await db.insert(branchActivity).values({
        workspaceId: input.workspaceId,
        branchId: input.branchId,
        type: "branch.merge_failed",
        actorId: input.actorId,
        payload: { reason: "conflicts", count: unresolved.length },
      });
      return {
        ok: false,
        promoted: 0,
        deletedFromMain: 0,
        createdInMain: 0,
        skipped: 0,
        errors: [],
        conflictsBlocked: unresolved.map((c) => c.forkId),
      };
    }
  }

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    type: "branch.merge_attempted",
    actorId: input.actorId,
    payload: { items: plan.items.length, conflicts: plan.conflicts.length },
  });

  let promoted = 0;
  let deletedFromMain = 0;
  let createdInMain = 0;
  let skipped = 0;
  const errors: Array<{ forkId: string; error: string }> = [];

  for (const item of plan.items) {
    const resolution = resolutions[item.forkId] ?? "use_branch";
    if (resolution === "skip") {
      skipped++;
      continue;
    }

    try {
      if (resolution === "use_main") {
        // Descartar la fork — borrar la copia COW.
        // F9c.9a fix C-4: si hay mainId, mover audit trail; si no, simplemente
        // se pierde (es 'new' descartada — no hay destino).
        if (item.mainId) {
          await transferEditorialAuditToMain(input.workspaceId, item.forkId, item.mainId);
        }
        await db
          .delete(entries)
          .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.forkId)));
        await db.insert(branchActivity).values({
          workspaceId: input.workspaceId,
          branchId: input.branchId,
          entryId: item.mainId,
          type: "entry.reverted_in_branch",
          actorId: input.actorId,
          payload: { duringMerge: true, resolution },
        });
        skipped++;
        continue;
      }

      // resolution === "use_branch" → aplicar defaultAction.
      if (item.state === "deleted" && item.mainId) {
        // delete_main: convertir sibling forks (otras branches con originalEntryId=mainId)
        // a `branchState='new'` antes del delete. Si no, su INNER JOIN al main
        // en buildMergePlan / listBranchConflicts las dejaría órfanas y al mergear
        // esas otras branches el promote fallaría con "Entry main desapareció".
        await db
          .update(entries)
          .set({
            branchState: "new",
            originalEntryId: null,
            branchedFromUpdatedAt: null,
          })
          .where(
            and(
              eq(entries.workspaceId, input.workspaceId),
              eq(entries.originalEntryId, item.mainId),
              ne(entries.id, item.forkId),
            ),
          );
        await db
          .delete(entries)
          .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.mainId)));
        await db
          .delete(entries)
          .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.forkId)));
        // L3-9: notificar al sitio público + suscriptores externos
        emitAsync({
          workspaceId: input.workspaceId,
          event: "entry.deleted",
          payload: { id: item.mainId, via: "branch.merge", branchId: input.branchId },
        });
        deletedFromMain++;
        continue;
      }

      const [fork] = await db
        .select()
        .from(entries)
        .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.forkId)))
        .limit(1);
      if (!fork) {
        errors.push({ forkId: item.forkId, error: "Fork desapareció" });
        continue;
      }

      if (item.state === "new") {
        // create_in_main: ajustar slug si colisiona en main, limpiar branch fields.
        // Restauramos el slug original (sin sufijo COW) — el slug del fork puede
        // venir con `__b-…` si se forkeó desde una entry main; las entries
        // 'new' creadas in-branch no tienen sufijo así que normalmente es no-op.
        const baseSlug = fork.slug.replace(/__b-[^/]+$/, "") || fork.slug;
        // M5: retry loop sobre unique violation — entre ensureUniqueEntrySlug y
        // el UPDATE puede colarse otro merge/createEntry con el mismo slug.
        let promotedNew = false;
        let lastNewSlug = baseSlug;
        for (let attempt = 0; attempt < 5 && !promotedNew; attempt++) {
          const candidate =
            attempt === 0
              ? await ensureUniqueEntrySlug(
                  input.workspaceId,
                  fork.collectionId,
                  fork.locale,
                  baseSlug,
                )
              : `${baseSlug}-${Date.now().toString(36).slice(-4)}-${attempt}`;
          lastNewSlug = candidate;
          try {
            await db
              .update(entries)
              .set({
                branchId: null,
                branchState: null,
                originalEntryId: null,
                branchedFromUpdatedAt: null,
                slug: candidate,
                updatedById: input.actorId,
                updatedAt: new Date(),
              })
              .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.forkId)));
            promotedNew = true;
          } catch (err) {
            const code =
              (err as { code?: string; cause?: { code?: string } })?.code ??
              (err as { cause?: { code?: string } })?.cause?.code;
            if (code !== "23505") throw err;
            // unique violation → reintenta con sufijo.
          }
        }
        if (!promotedNew) {
          errors.push({ forkId: item.forkId, error: "No se pudo asignar un slug único en main" });
          continue;
        }
        // L3-9: re-indexar + notificar.
        void enqueueIndex({ workspaceId: input.workspaceId, entryId: item.forkId }).catch(() => {});
        emitAsync({
          workspaceId: input.workspaceId,
          event: fork.status === "published" ? "entry.published" : "entry.updated",
          payload: {
            id: item.forkId,
            title: fork.title,
            slug: lastNewSlug,
            status: fork.status,
            via: "branch.merge",
            branchId: input.branchId,
          },
        });
        createdInMain++;
        continue;
      }

      if (item.state === "forked" && item.mainId) {
        // promote: copiar campos de fork a main, restaurar slug original (asumimos main slug correcto)
        const [main] = await db
          .select({
            slug: entries.slug,
            collectionId: entries.collectionId,
            locale: entries.locale,
            status: entries.status,
          })
          .from(entries)
          .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.mainId)))
          .limit(1);
        if (!main) {
          errors.push({ forkId: item.forkId, error: "Entry main desapareció" });
          continue;
        }
        // H2: usar atomic claim — si entre el SELECT de main y este UPDATE alguien
        // borró main (otro merge con state='deleted', delete admin), el update afecta
        // 0 filas. Si no chequeamos, borraríamos la fork debajo y perderíamos el
        // contenido del autor de la branch. SELECT FOR UPDATE adquiere lock para
        // evitar el race entre nuestro check y el UPDATE.
        const updated = await atomicClaim<{ id: string }>(entries, {
          where: and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.mainId))!,
          precondition: () => true,
          set: {
            title: fork.title,
            slug: main.slug, // se mantiene el slug de main (la fork tenía slug COW prefijado)
            excerpt: fork.excerpt,
            body: fork.body as never,
            bodyText: fork.bodyText,
            coverId: fork.coverId,
            status: fork.status,
            scheduledAt: fork.scheduledAt,
            publishedAt: fork.publishedAt,
            seo: fork.seo as never,
            ogImageUrl: fork.ogImageUrl,
            fields: fork.fields as never,
            updatedById: input.actorId,
            updatedAt: new Date(),
          },
        });
        if (!updated) {
          errors.push({
            forkId: item.forkId,
            error: "Entry main desapareció entre check y update — fork preservada",
          });
          continue;
        }
        // F9c.9a fix C-4: preservar audit trail editorial reapuntando al main.
        await transferEditorialAuditToMain(input.workspaceId, item.forkId, item.mainId);
        await db
          .delete(entries)
          .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, item.forkId)));
        // L3-9: re-indexar contenido nuevo + notificar (entry.published si transicionó)
        void enqueueIndex({ workspaceId: input.workspaceId, entryId: item.mainId }).catch(() => {});
        const justPublished = main.status !== "published" && fork.status === "published";
        emitAsync({
          workspaceId: input.workspaceId,
          event: justPublished ? "entry.published" : "entry.updated",
          payload: {
            id: item.mainId,
            title: fork.title,
            slug: main.slug,
            status: fork.status,
            via: "branch.merge",
            branchId: input.branchId,
          },
        });
        promoted++;
        continue;
      }

      errors.push({ forkId: item.forkId, error: `Estado inesperado: ${item.state}` });
    } catch (err) {
      errors.push({
        forkId: item.forkId,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  // 3. Cerrar branch.
  if (errors.length === 0) {
    await db
      .update(branches)
      .set({
        status: "merged",
        mergedAt: new Date(),
        mergedById: input.actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
    await db.insert(branchActivity).values({
      workspaceId: input.workspaceId,
      branchId: input.branchId,
      type: "branch.merged",
      actorId: input.actorId,
      payload: { promoted, deletedFromMain, createdInMain, skipped },
    });
    await logActivity({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "branch.merged",
      targetType: "branch",
      targetId: input.branchId,
      meta: { promoted, deletedFromMain, createdInMain, skipped },
    });
    // L3-9: invalidar cachés del sitio público.
    revalidatePath("/blog");
    revalidatePath("/");
    revalidateTag(`workspace:${input.workspaceId}:entries`);
    return { ok: true, promoted, deletedFromMain, createdInMain, skipped, errors };
  }

  // Hubo errores — dejar branch en 'merging' para reintento. Pero si no quedan items
  // pendientes (todos procesados), volver a 'draft' para no bloquear.
  await releaseMerging(input);
  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    type: "branch.merge_failed",
    actorId: input.actorId,
    payload: { errors, promoted, deletedFromMain, createdInMain, skipped },
  });
  return { ok: false, promoted, deletedFromMain, createdInMain, skipped, errors };
}

async function releaseMerging(input: { workspaceId: string; branchId: string }): Promise<void> {
  if (!db) return;
  await db
    .update(branches)
    .set({ status: "draft", updatedAt: new Date() })
    .where(
      and(
        eq(branches.workspaceId, input.workspaceId),
        eq(branches.id, input.branchId),
        eq(branches.status, "merging"),
      ),
    );
}
