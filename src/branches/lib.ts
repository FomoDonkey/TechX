import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import {
  type Branch,
  type NewBranch,
  branchActivity,
  branchComments,
  branches,
  entries,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { isReservedSlug } from "@/lib/slug";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { BRANCH_COOKIE, type BranchStats, type BranchWithStats } from "./types";

const RESERVED_BRANCH_SLUGS = new Set(["main", "master", "head", "default", "trunk"]);

/**
 * Slugify para branches: permite `/` como separador (`feat/v3-redesign`),
 * pero recorta a [a-z0-9-/] y trunca a 60 chars.
 */
export function slugifyBranchName(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .normalize("NFD")
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: combining diacritics range U+0300..U+036F
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9/\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^-+|-+$/g, "")
      .replace(/^\/+|\/+$/g, "")
      .slice(0, 60)
  );
}

export function isValidBranchSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 60) return false;
  if (!/^[a-z0-9](?:[a-z0-9/-]*[a-z0-9])?$/.test(slug)) return false;
  if (slug.includes("//") || slug.includes("--")) return false;
  if (isReservedSlug(slug)) return false;
  // "main" se permite SOLO al backfill — el create user-facing rechaza.
  return true;
}

/** Devuelve la branch main del workspace; si no existe, la crea (idempotente). */
export async function getOrCreateMainBranch(workspaceId: string): Promise<Branch> {
  if (!db) throw new Error("DB no configurada");
  const [existing] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.isDefault, true)))
    .limit(1);
  if (existing) return existing;

  // race-safe: insert con onConflictDoNothing por (ws, slug) y re-select.
  await db
    .insert(branches)
    .values({
      workspaceId,
      name: "main",
      slug: "main",
      description: "Rama principal del workspace",
      isDefault: true,
      isProtected: true,
      status: "draft",
      color: "oklch(0.78 0.18 180)",
      icon: "git-branch",
    })
    .onConflictDoNothing({ target: [branches.workspaceId, branches.slug] });

  const [final] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.isDefault, true)))
    .limit(1);
  if (!final) throw new Error("No se pudo crear/leer la branch main");
  return final;
}

export async function getBranchById(workspaceId: string, branchId: string): Promise<Branch | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.id, branchId)))
    .limit(1);
  return row ?? null;
}

export async function getBranchBySlug(workspaceId: string, slug: string): Promise<Branch | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, workspaceId), eq(branches.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function listBranches(workspaceId: string): Promise<Branch[]> {
  if (!db) return [];
  return (
    db
      .select()
      .from(branches)
      .where(eq(branches.workspaceId, workspaceId))
      // main primero; resto por updatedAt desc.
      .orderBy(desc(branches.isDefault), desc(branches.updatedAt))
  );
}

/**
 * Lista branches con stats agregados (forked/created/deleted/conflicts/openComments).
 * Usado por /admin/branches listing.
 */
export async function listBranchesWithStats(workspaceId: string): Promise<BranchWithStats[]> {
  const list = await listBranches(workspaceId);
  if (list.length === 0 || !db) return [];

  // 1. Stats de entries por branch.
  const entryRows = await db
    .select({
      branchId: entries.branchId,
      branchState: entries.branchState,
    })
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), isNotNull(entries.branchId)));

  // 2. Comentarios abiertos por branch.
  const commentRows = await db
    .select({
      branchId: branchComments.branchId,
      n: sql<number>`count(*)::int`,
    })
    .from(branchComments)
    .where(and(eq(branchComments.workspaceId, workspaceId), eq(branchComments.status, "open")))
    .groupBy(branchComments.branchId);

  // 3. Conflicts: para cada entry forked, comparar branchedFromUpdatedAt vs entry main.updatedAt.
  // Hacer 1 query agregada con LEFT JOIN.
  // Conflicto = fork (forked|deleted) cuya entry main cambió tras el snapshot.
  // `m.workspace_id = e.workspace_id` es defense-in-depth contra cross-tenant pollution.
  const conflictRows = await db.execute(sql<{ branch_id: string; n: number }>`
    SELECT
      e.branch_id::text AS branch_id,
      COUNT(*)::int AS n
    FROM entries e
    INNER JOIN entries m
      ON m.id = e.original_entry_id
      AND m.workspace_id = e.workspace_id
    WHERE e.workspace_id = ${workspaceId}
      AND e.branch_id IS NOT NULL
      AND e.branch_state IN ('forked', 'deleted')
      AND e.branched_from_updated_at IS NOT NULL
      AND m.updated_at > e.branched_from_updated_at
    GROUP BY e.branch_id
  `);

  const commentByBranch = new Map<string, number>();
  for (const c of commentRows) if (c.branchId) commentByBranch.set(c.branchId, c.n);

  const conflictByBranch = new Map<string, number>();
  for (const row of conflictRows as unknown as Array<{ branch_id: string; n: number }>) {
    conflictByBranch.set(row.branch_id, row.n);
  }

  const statsByBranch = new Map<string, BranchStats>();
  for (const row of entryRows) {
    if (!row.branchId) continue;
    const cur = statsByBranch.get(row.branchId) ?? {
      forked: 0,
      created: 0,
      deleted: 0,
      conflicts: 0,
      openComments: 0,
    };
    if (row.branchState === "forked") cur.forked++;
    else if (row.branchState === "new") cur.created++;
    else if (row.branchState === "deleted") cur.deleted++;
    statsByBranch.set(row.branchId, cur);
  }

  return list.map((b) => {
    const cur = statsByBranch.get(b.id) ?? {
      forked: 0,
      created: 0,
      deleted: 0,
      conflicts: 0,
      openComments: 0,
    };
    cur.conflicts = conflictByBranch.get(b.id) ?? 0;
    cur.openComments = commentByBranch.get(b.id) ?? 0;
    return { ...b, stats: cur };
  });
}

export type CreateBranchInput = {
  workspaceId: string;
  createdById: string;
  name: string;
  slug?: string;
  description?: string | null;
  baseBranchId?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  if (!db) throw new Error("DB no configurada");
  const baseSlug = (input.slug || slugifyBranchName(input.name) || "rama").trim();
  if (!isValidBranchSlug(baseSlug)) throw new Error("Slug inválido");
  if (RESERVED_BRANCH_SLUGS.has(baseSlug)) throw new Error("Slug reservado");

  // Garantizar único: probar baseSlug, baseSlug-2, baseSlug-3...
  let slug = baseSlug;
  let n = 1;
  while (n < 32) {
    const [hit] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.slug, slug)))
      .limit(1);
    if (!hit) break;
    n++;
    slug = `${baseSlug}-${n}`;
  }

  // Validar baseBranchId pertenece al workspace.
  if (input.baseBranchId) {
    const base = await getBranchById(input.workspaceId, input.baseBranchId);
    if (!base) throw new Error("Branch base inválida");
  }

  const values: NewBranch = {
    workspaceId: input.workspaceId,
    createdById: input.createdById,
    name: input.name.trim().slice(0, 80) || "Rama sin título",
    slug,
    description: input.description?.slice(0, 280) ?? null,
    baseBranchId: input.baseBranchId ?? null,
    isDefault: false,
    isProtected: false,
    status: "draft",
    color: input.color ?? "oklch(0.55 0.22 290)",
    icon: input.icon ?? "git-branch",
  };
  const newId = crypto.randomUUID();
  const created = (await insertReturning(branches, {
    id: newId,
    ...values,
  })) as Branch;
  if (!created) throw new Error("No se pudo crear la branch");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: created.id,
    type: "branch.created",
    actorId: input.createdById,
    payload: { name: created.name, slug: created.slug, baseBranchId: input.baseBranchId ?? null },
  });
  await logActivity({
    workspaceId: input.workspaceId,
    actorId: input.createdById,
    action: "branch.created",
    targetType: "branch",
    targetId: created.id,
    meta: { name: created.name, slug: created.slug },
  });
  return created;
}

export type UpdateBranchInput = {
  workspaceId: string;
  branchId: string;
  actorId: string;
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function updateBranch(input: UpdateBranchInput): Promise<Branch> {
  if (!db) throw new Error("DB no configurada");
  const current = await getBranchById(input.workspaceId, input.branchId);
  if (!current) throw new Error("Branch no encontrada");
  const patch: Partial<NewBranch> = { updatedAt: new Date() };
  if (input.name && input.name !== current.name) {
    patch.name = input.name.trim().slice(0, 80) || current.name;
  }
  if (input.description !== undefined) patch.description = input.description?.slice(0, 280) ?? null;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.icon !== undefined) patch.icon = input.icon ?? null;

  await db
    .update(branches)
    .set(patch)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
  const [updated] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)))
    .limit(1);
  if (!updated) throw new Error("No se pudo actualizar la branch");

  if (input.name && input.name !== current.name) {
    await db.insert(branchActivity).values({
      workspaceId: input.workspaceId,
      branchId: input.branchId,
      type: "branch.renamed",
      actorId: input.actorId,
      payload: { from: current.name, to: input.name },
    });
  }
  return updated;
}

/**
 * Marca branch como abandonada. NO borra entries forked — un restore (F10) puede recuperarlas.
 * Bloqueado para branches protegidas (main).
 */
export async function abandonBranch(input: {
  workspaceId: string;
  branchId: string;
  actorId: string;
}): Promise<Branch> {
  if (!db) throw new Error("DB no configurada");
  const current = await getBranchById(input.workspaceId, input.branchId);
  if (!current) throw new Error("Branch no encontrada");
  if (current.isProtected) throw new Error("No se puede abandonar una branch protegida");
  if (current.status === "merged" || current.status === "abandoned") return current;

  // Limpiar también preview token al abandonar — evita que el token siga
  // siendo válido si la branch se restaurara (status='draft') manualmente.
  await db
    .update(branches)
    .set({
      status: "abandoned",
      abandonedAt: new Date(),
      abandonedById: input.actorId,
      previewToken: null,
      previewPasswordHash: null,
      previewExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)));
  const [updated] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.workspaceId, input.workspaceId), eq(branches.id, input.branchId)))
    .limit(1);
  if (!updated) throw new Error("No se pudo abandonar");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    type: "branch.abandoned",
    actorId: input.actorId,
  });
  return updated;
}

/** Cookie helpers para la branch activa del usuario. */
export async function readActiveBranchCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(BRANCH_COOKIE)?.value ?? null;
}

/**
 * Resuelve la branch activa para el usuario, validando que pertenezca al workspace.
 * Si no hay cookie o es inválida, devuelve la main del workspace.
 */
export async function resolveActiveBranch(workspaceId: string): Promise<Branch> {
  const main = await getOrCreateMainBranch(workspaceId);
  const cookieValue = await readActiveBranchCookie();
  if (!cookieValue) return main;
  // UUID rough check antes de query.
  if (!/^[0-9a-f-]{36}$/i.test(cookieValue)) return main;
  if (cookieValue === main.id) return main;
  const branch = await getBranchById(workspaceId, cookieValue);
  if (!branch) return main;
  // Branch abandoned/merged/merging no debe aceptarse como activa
  // (escribir durante merge dejaría forks huérfanos tras el commit final).
  if (branch.status === "merged" || branch.status === "abandoned" || branch.status === "merging") {
    return main;
  }
  return branch;
}

/**
 * Lista cronológica de branches (sólo draft+merging) que un usuario puede activar
 * desde el switcher. Incluye main siempre.
 */
export async function listSwitchableBranches(workspaceId: string): Promise<Branch[]> {
  if (!db) return [];
  return db
    .select()
    .from(branches)
    .where(
      and(eq(branches.workspaceId, workspaceId), sql`${branches.status} IN ('draft', 'merging')`),
    )
    .orderBy(desc(branches.isDefault), asc(branches.name));
}
