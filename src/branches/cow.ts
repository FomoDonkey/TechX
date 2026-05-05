import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import {
  type Branch,
  type Entry,
  type EntryBranchState,
  branchActivity,
  branches,
  entries,
} from "@/db/schema";
import { ensureUniqueEntrySlug } from "@/lib/entries";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

/**
 * Filtro para "entries en main" — `branchId IS NULL`.
 *
 * **Regla F9b**: cualquier consulta del sitio público (blog, sitemap, feed, OG,
 * REST/GraphQL public, search, dashboard counters) DEBE incluir este filtro
 * para no leakear contenido de branches no mergeadas.
 *
 * Ejemplo: `where: and(eq(entries.workspaceId, ws), mainEntryFilter(), ...)`
 */
export const mainEntryFilter = () => isNull(entries.branchId);

/**
 * Copy-on-write lazy:
 * - Si la entry vive en main (`branchId IS NULL`) y el caller quiere editarla en `branch`,
 *   creamos la fila COW (branchId=branch, branchState='forked', originalEntryId=mainEntry.id).
 *   Idempotente: si ya existe COW para esta branch, devolvemos esa.
 * - Si la entry ya está en `branch` (forked, new, o deleted), devolvemos la misma.
 * - Si la entry es de OTRA branch, lanzamos error (no se puede editar cross-branch).
 *
 * Devuelve la entry "writable" — el caller debe escribir contra `result.id`.
 *
 * Conflict detection: `branchedFromUpdatedAt` snapshot del main.updatedAt al crear el COW.
 * Si después main cambia, listBranchConflicts() detecta esa entry como conflictiva.
 */
export async function materializeForkOnEdit(input: {
  workspaceId: string;
  entryId: string;
  branch: Branch;
  actorId: string;
}): Promise<Entry> {
  if (!db) throw new Error("DB no configurada");
  const { workspaceId, entryId, branch, actorId } = input;
  if (branch.workspaceId !== workspaceId) {
    throw new Error("Branch no pertenece al workspace");
  }

  const [current] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), eq(entries.id, entryId)))
    .limit(1);
  if (!current) throw new Error("Entrada no encontrada");

  // Caso main → main: branch activa es la default y la entry es de main, sin COW.
  if (branch.isDefault) {
    if (current.branchId !== null) {
      throw new Error("Esta entrada vive en otra branch. Cambia a esa branch para editarla.");
    }
    return current;
  }

  // Caso entry ya está en la misma branch (forked/new/deleted) → escribir directamente.
  if (current.branchId === branch.id) return current;

  // Caso cross-branch (ni main ni la activa): bloquear.
  if (current.branchId !== null && current.branchId !== branch.id) {
    throw new Error("Esta entrada pertenece a otra branch. Cambia a esa branch para editarla.");
  }

  // Caso COW lazy: current está en main, branch ≠ main → buscar/crear fork.
  const [existingFork] = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.branchId, branch.id),
        eq(entries.originalEntryId, current.id),
      ),
    )
    .limit(1);
  if (existingFork) return existingFork;

  // Insertar COW con copia de campos. Stripeamos campos que no se forkean
  // (originRef, embedding) y forzamos slug único pre-fork (puede colisionar
  // dentro de la misma branch si dos entries de main tenían slugs únicos en
  // distintas collections, pero el unique index lo cubre por (ws, coll, slug, locale)).
  const newId = crypto.randomUUID();
  const created = (await insertReturning(entries, {
    id: newId,
    workspaceId: current.workspaceId,
    collectionId: current.collectionId,
    branchId: branch.id,
    originalEntryId: current.id,
    branchState: "forked",
    branchedFromUpdatedAt: current.updatedAt,
    title: current.title,
    // Slug: para evitar choque con la entry de main, prefijamos slug+id corto de branch.
    // Esto se reserva el unique constraint (ws,coll,slug,locale). Al merge, devolvemos al slug original.
    slug: cowSlug(current.slug, branch.slug, branch.id),
    excerpt: current.excerpt,
    body: current.body as never,
    bodyText: current.bodyText,
    coverId: current.coverId,
    status: current.status,
    locale: current.locale,
    parentTranslationId: current.parentTranslationId,
    scheduledAt: current.scheduledAt,
    publishedAt: current.publishedAt,
    authorId: current.authorId,
    updatedById: actorId,
    seo: current.seo as never,
    ogImageUrl: current.ogImageUrl,
    fields: current.fields as never,
    // originRef y embedding NO se duplican.
  })) as Entry;
  if (!created) throw new Error("No se pudo forkear la entrada");

  await db.insert(branchActivity).values({
    workspaceId,
    branchId: branch.id,
    entryId: created.id,
    type: "entry.forked",
    actorId,
    payload: { originalEntryId: current.id, title: current.title },
  });

  return created;
}

/**
 * Helper público: dado un slug original y una branch, genera el slug para la fork
 * (evita colisión con entry de main del mismo collection/locale).
 *
 * Incluimos un sufijo determinista derivado de `branchId` para evitar colisiones
 * cuando dos branches con slugs largos comparten los primeros 12 chars (ej.
 * `feature-redesign-v3` y `feature-redesign-v4`). Sin el sufijo del id, ambas
 * generarían `${original}__b-feature-redes` y la 2ª fork fallaría con violation
 * de `entries_ws_coll_slug_locale_idx`.
 */
export function cowSlug(originalSlug: string, branchSlug: string, branchId?: string): string {
  const sanitizedBranch = branchSlug.replace(/[^a-z0-9-]/g, "-").slice(0, 12);
  // 6 hex chars del branchId (~16M valores) — suficiente para deduplicar dentro de un workspace.
  const idTail = branchId ? `-${branchId.replace(/-/g, "").slice(0, 6)}` : "";
  const base = `${originalSlug}__b-${sanitizedBranch}${idTail}`;
  return base.slice(0, 96);
}

/**
 * Marca una entry de main como "borrada en esta branch" (tombstone).
 * No borra la fila de main — sólo crea/actualiza COW con branchState='deleted'.
 * Al merge, esta entry desaparecerá de main.
 */
export async function markDeletedInBranch(input: {
  workspaceId: string;
  entryId: string;
  branch: Branch;
  actorId: string;
}): Promise<Entry> {
  if (!db) throw new Error("DB no configurada");
  if (input.branch.workspaceId !== input.workspaceId) {
    throw new Error("Branch no pertenece al workspace");
  }
  if (input.branch.isDefault) throw new Error("Borrado en main usa la action normal");
  const fork = await materializeForkOnEdit({
    workspaceId: input.workspaceId,
    entryId: input.entryId,
    branch: input.branch,
    actorId: input.actorId,
  });
  if (fork.branchState === "deleted") return fork;
  if (fork.branchState === "new") {
    // Entry creada en la branch — borrar directamente.
    await db
      .delete(entries)
      .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, fork.id)));
    await db.insert(branchActivity).values({
      workspaceId: input.workspaceId,
      branchId: input.branch.id,
      entryId: fork.id,
      type: "entry.deleted_in_branch",
      actorId: input.actorId,
      payload: { wasNew: true },
    });
    return fork;
  }
  await db
    .update(entries)
    .set({
      branchState: "deleted",
      updatedById: input.actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, fork.id)));
  const [updated] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, fork.id)))
    .limit(1);
  if (!updated) throw new Error("No se pudo marcar como borrada");
  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branch.id,
    entryId: updated.id,
    type: "entry.deleted_in_branch",
    actorId: input.actorId,
  });
  return updated;
}

/**
 * Revierte una fork (forked/deleted) eliminando la copia COW. La entry queda visible
 * desde main de nuevo, sin cambios.
 */
export async function revertForkInBranch(input: {
  workspaceId: string;
  entryId: string;
  branch: Branch;
  actorId: string;
}): Promise<{ revertedToMainEntryId: string | null }> {
  if (!db) throw new Error("DB no configurada");
  if (input.branch.workspaceId !== input.workspaceId) {
    throw new Error("Branch no pertenece al workspace");
  }
  const [fork] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, input.entryId)))
    .limit(1);
  if (!fork) throw new Error("Entrada no encontrada");
  if (fork.branchId !== input.branch.id) {
    throw new Error("La entrada no pertenece a esta branch");
  }
  if (fork.branchState === "new") {
    // Borrar directamente — no había main a la que volver.
    await db
      .delete(entries)
      .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, fork.id)));
    await db.insert(branchActivity).values({
      workspaceId: input.workspaceId,
      branchId: input.branch.id,
      entryId: fork.id,
      type: "entry.reverted_in_branch",
      actorId: input.actorId,
      payload: { wasNew: true },
    });
    return { revertedToMainEntryId: null };
  }
  const originalId = fork.originalEntryId;
  await db
    .delete(entries)
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, fork.id)));
  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branch.id,
    entryId: originalId,
    type: "entry.reverted_in_branch",
    actorId: input.actorId,
    payload: { revertedFork: fork.id },
  });
  return { revertedToMainEntryId: originalId };
}

/**
 * Crea una entry NUEVA dentro de una branch (no COW). Usado cuando el usuario
 * crea un post estando con una branch ≠ main activa.
 */
export async function createEntryInBranch(input: {
  workspaceId: string;
  collectionId: string;
  branch: Branch;
  authorId: string;
  title: string;
  slug: string;
  body: unknown;
  locale: string;
}): Promise<Entry> {
  if (!db) throw new Error("DB no configurada");
  if (input.branch.workspaceId !== input.workspaceId) {
    throw new Error("Branch no pertenece al workspace");
  }
  if (input.branch.isDefault) {
    throw new Error("Para crear en main usa la action normal");
  }
  // H3: garantizar slug único dentro del scope (ws, collection, locale).
  // Sin esto, dos posts del mismo título en la misma branch reventaban el unique
  // index `entries_ws_coll_slug_locale_idx` con un 500 genérico.
  const baseSlug = input.slug || "sin-titulo";
  const finalSlug = await ensureUniqueEntrySlug(
    input.workspaceId,
    input.collectionId,
    input.locale,
    baseSlug,
  );
  const newId = crypto.randomUUID();
  const created = (await insertReturning(entries, {
    id: newId,
    workspaceId: input.workspaceId,
    collectionId: input.collectionId,
    branchId: input.branch.id,
    branchState: "new",
    title: input.title || "Sin título",
    slug: finalSlug,
    locale: input.locale,
    status: "draft",
    body: input.body as never,
    bodyText: "",
    authorId: input.authorId,
    updatedById: input.authorId,
  })) as Entry;
  if (!created) throw new Error("No se pudo crear la entrada en la branch");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branch.id,
    entryId: created.id,
    type: "entry.created_in_branch",
    actorId: input.authorId,
    payload: { title: input.title, slug: finalSlug },
  });
  return created;
}

/**
 * Devuelve las entries visibles en una branch dada (resolviendo COW + tombstones).
 *
 * Para `branchId === main.id` o `branch.isDefault === true`, devuelve sólo entries con
 * `branchId IS NULL` (legacy) Y `branchId = main.id` (futura). En la implementación F9b
 * todas las entries main siguen viviendo en `branchId IS NULL` por compat.
 *
 * Para `branch ≠ main`:
 *   - Entries main (branchId IS NULL) que NO tienen COW en esta branch  → visibility "main"
 *   - Entries con branchId=branch.id y state='forked'   → visibility "forked"
 *   - Entries con branchId=branch.id y state='new'      → visibility "new"
 *   - Entries con branchId=branch.id y state='deleted'  → visibility "deleted" (NO se incluyen por defecto;
 *     pasar `includeTombstones: true` para verlas)
 */
export async function listEntriesForBranch(input: {
  workspaceId: string;
  branch: Branch;
  collectionId?: string;
  includeTombstones?: boolean;
}): Promise<Array<{ entry: Entry; visibility: EntryBranchState | "main" }>> {
  if (!db) return [];
  const { workspaceId, branch, collectionId, includeTombstones } = input;

  if (branch.isDefault) {
    const where = collectionId
      ? and(
          eq(entries.workspaceId, workspaceId),
          isNull(entries.branchId),
          eq(entries.collectionId, collectionId),
        )
      : and(eq(entries.workspaceId, workspaceId), isNull(entries.branchId));
    const rows = await db.select().from(entries).where(where);
    return rows.map((entry) => ({ entry, visibility: "main" as const }));
  }

  // Entries en la branch (forked/new/deleted)
  const branchWhere = collectionId
    ? and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.branchId, branch.id),
        eq(entries.collectionId, collectionId),
      )
    : and(eq(entries.workspaceId, workspaceId), eq(entries.branchId, branch.id));
  const branchRows = await db.select().from(entries).where(branchWhere);

  const forkedOriginals = new Set<string>();
  const out: Array<{ entry: Entry; visibility: EntryBranchState | "main" }> = [];
  for (const e of branchRows) {
    if (!e.branchState) continue;
    if (e.originalEntryId) forkedOriginals.add(e.originalEntryId);
    if (e.branchState === "deleted" && !includeTombstones) continue;
    out.push({ entry: e, visibility: e.branchState });
  }

  // Entries main que NO tienen COW en esta branch
  const mainWhere = collectionId
    ? and(
        eq(entries.workspaceId, workspaceId),
        isNull(entries.branchId),
        eq(entries.collectionId, collectionId),
      )
    : and(eq(entries.workspaceId, workspaceId), isNull(entries.branchId));
  const mainRows = await db.select().from(entries).where(mainWhere);
  for (const e of mainRows) {
    if (forkedOriginals.has(e.id)) continue;
    out.push({ entry: e, visibility: "main" });
  }

  return out;
}

/**
 * Resuelve UNA entry para una branch dada por id de la entry "lógica" (puede ser id de main
 * que tiene fork, o id directo de fork). Devuelve la versión visible en la branch + base.
 */
export async function resolveEntryForBranch(input: {
  workspaceId: string;
  entryId: string;
  branch: Branch;
}): Promise<{ entry: Entry; base: Entry | null; visibility: EntryBranchState | "main" } | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, input.entryId)))
    .limit(1);
  if (!row) return null;

  // Si pasaron id de main pero estamos en branch ≠ main, intentar buscar fork.
  if (input.branch.isDefault === false && row.branchId === null) {
    const [fork] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.workspaceId, input.workspaceId),
          eq(entries.branchId, input.branch.id),
          eq(entries.originalEntryId, row.id),
        ),
      )
      .limit(1);
    if (fork?.branchState) {
      return { entry: fork, base: row, visibility: fork.branchState };
    }
    return { entry: row, base: null, visibility: "main" };
  }

  // Si pasaron id de fork: resolver base.
  if (row.branchId && row.originalEntryId) {
    const [base] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.workspaceId, input.workspaceId), eq(entries.id, row.originalEntryId)))
      .limit(1);
    return {
      entry: row,
      base: base ?? null,
      visibility: row.branchState ?? "forked",
    };
  }

  // Entry pasada es nueva en la branch (sin original) o main.
  return {
    entry: row,
    base: null,
    visibility: row.branchId ? (row.branchState ?? "new") : "main",
  };
}

/**
 * Devuelve las entries main que cambiaron desde que el COW las captó — conflictos al merge.
 */
export async function listBranchConflicts(input: {
  workspaceId: string;
  branchId: string;
}): Promise<
  Array<{
    forkId: string;
    mainId: string;
    mainUpdatedAt: Date;
    branchedFromUpdatedAt: Date;
    state: "forked" | "deleted";
  }>
> {
  if (!db) return [];
  // Defense-in-depth: el JOIN exige también `m.workspace_id = e.workspace_id`
  // por si un futuro bug introdujera fork con originalEntryId cross-workspace.
  // Incluye también `branchState='deleted'` — borrar una entry en branch cuando
  // main fue editada después es también un conflicto a resolver.
  const result = await db.execute<{
    fork_id: string;
    main_id: string;
    main_updated_at: Date;
    branched_from_updated_at: Date;
    state: string;
  }>(sql`
    SELECT
      e.id::text AS fork_id,
      m.id::text AS main_id,
      m.updated_at AS main_updated_at,
      e.branched_from_updated_at AS branched_from_updated_at,
      e.branch_state::text AS state
    FROM entries e
    INNER JOIN entries m
      ON m.id = e.original_entry_id
      AND m.workspace_id = e.workspace_id
    WHERE e.workspace_id = ${input.workspaceId}
      AND e.branch_id = ${input.branchId}
      AND e.branch_state IN ('forked', 'deleted')
      AND e.branched_from_updated_at IS NOT NULL
      AND m.updated_at > e.branched_from_updated_at
  `);

  return (
    result as unknown as Array<{
      fork_id: string;
      main_id: string;
      main_updated_at: Date;
      branched_from_updated_at: Date;
      state: string;
    }>
  ).map((r) => ({
    forkId: r.fork_id,
    mainId: r.main_id,
    mainUpdatedAt: r.main_updated_at,
    branchedFromUpdatedAt: r.branched_from_updated_at,
    state: r.state === "deleted" ? ("deleted" as const) : ("forked" as const),
  }));
}

/** Helper para asegurar que el branchId que viene del cliente pertenece al workspace. */
export async function assertBranchInWorkspace(
  workspaceId: string,
  branchId: string,
): Promise<Branch> {
  if (!db) throw new Error("DB no configurada");
  const [row] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.id, branchId)))
    .limit(1);
  if (!row) throw new Error("Branch inválida");
  return row;
}

/** No-op por ahora — usado por queries que pueden filtrar entries excluyendo tombstones. */
export function nonTombstoneFilter() {
  return or(isNull(entries.branchState), ne(entries.branchState, "deleted"));
}
