"use server";

import { requireUser } from "@/auth/server";
import {
  abandonBranch,
  clearPreviewToken,
  createBranch,
  createBranchComment,
  deleteBranchComment,
  getBranchById,
  isValidBranchSlug,
  markDeletedInBranch,
  mergeBranch,
  resolveBranchComment,
  revertForkInBranch,
  rotatePreviewToken,
  updateBranch,
} from "@/branches";
import type { MergeOptions } from "@/branches/merge";
import {
  type BranchProtectionConfig,
  evaluateBranchProtection,
  setBranchProtectionConfig,
} from "@/branches/protection";
import { BRANCH_COOKIE, BRANCH_COOKIE_MAX_AGE } from "@/branches/types";
import { db } from "@/db/client";
import { branchActivity } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

type Ok = { ok: true };
type OkWith<T extends object> = { ok: true } & T;
type Err = { ok: false; error: string };
type Result<T extends object | undefined = undefined> = T extends object
  ? OkWith<T> | Err
  : Ok | Err;

function fail(error: string): Err {
  return { ok: false, error };
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(2).max(60).optional(),
  description: z.string().max(280).optional().nullable(),
  baseBranchId: z.string().uuid().optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
});

export async function createBranchAction(
  input: z.input<typeof CreateSchema>,
): Promise<Result<{ id: string; slug: string }>> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    if (parsed.data.slug && !isValidBranchSlug(parsed.data.slug)) {
      return fail("Slug inválido (a-z 0-9, guiones, sin / al inicio o final)");
    }
    const created = await createBranch({
      workspaceId: ctx.workspace.id,
      createdById: user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      baseBranchId: parsed.data.baseBranchId ?? null,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
    });
    revalidatePath("/admin/branches");
    return { ok: true, id: created.id, slug: created.slug };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo crear la branch");
  }
}

const UpdateSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});

export async function updateBranchAction(input: z.input<typeof UpdateSchema>): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = UpdateSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    await updateBranch({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      actorId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      icon: parsed.data.icon,
    });
    revalidatePath("/admin/branches");
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo actualizar");
  }
}

const AbandonSchema = z.object({ branchId: z.string().uuid() });

export async function abandonBranchAction(input: z.input<typeof AbandonSchema>): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = AbandonSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    // H7: solo el creador o un admin pueden abandonar — evita que un editor
    // cualquiera nuke el trabajo de un compañero.
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    const isCreator = branch.createdById === user.id;
    const isAdmin = ctx.role === "admin" || ctx.role === "owner";
    if (!isCreator && !isAdmin) {
      return fail("Sólo el creador o un admin pueden abandonar esta branch");
    }
    await abandonBranch({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      actorId: user.id,
    });
    revalidatePath("/admin/branches");
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo abandonar");
  }
}

const MergeSchema = z.object({
  branchId: z.string().uuid(),
  resolutions: z.record(z.enum(["use_branch", "use_main", "skip"])).optional(),
  force: z.boolean().optional(),
});

export async function mergeBranchAction(input: z.input<typeof MergeSchema>): Promise<
  Result<{
    promoted: number;
    deletedFromMain: number;
    createdInMain: number;
    skipped: number;
    conflictsBlocked?: string[];
  }>
> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("admin"); // merge requiere admin
    const parsed = MergeSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");

    const opts: MergeOptions = {
      resolutions: parsed.data.resolutions,
      force: parsed.data.force,
    };
    const result = await mergeBranch({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      actorId: user.id,
      options: opts,
    });

    revalidatePath("/admin/branches");
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    revalidatePath("/admin/contenido");
    revalidatePath("/blog");

    if (!result.ok) {
      if (result.protectionBlocked && result.protectionBlocked.length > 0) {
        const summary = result.protectionBlocked.map((b) => b.message).join(" · ");
        return fail(`Reglas de protección no cumplidas: ${summary}`);
      }
      if (result.conflictsBlocked && result.conflictsBlocked.length > 0) {
        return fail(
          `Hay ${result.conflictsBlocked.length} conflictos sin resolver. Decide qué versión usar antes de mergear.`,
        );
      }
      return fail(result.errors[0]?.error ?? "El merge falló");
    }
    return {
      ok: true,
      promoted: result.promoted,
      deletedFromMain: result.deletedFromMain,
      createdInMain: result.createdInMain,
      skipped: result.skipped,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "El merge falló");
  }
}

const RotateTokenSchema = z.object({
  branchId: z.string().uuid(),
  password: z.string().min(4).max(80).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function rotatePreviewTokenAction(
  input: z.input<typeof RotateTokenSchema>,
): Promise<Result<{ token: string; expiresAt: string | null }>> {
  try {
    const user = await requireUser();
    // H6: el preview público expone CONTENIDO no publicado. Si role<admin
    // requerimos password obligatoria — un editor puede generar token, pero
    // tiene que poner clave para no dejarlo abierto al mundo.
    const ctx = await requireWorkspace("editor");
    const parsed = RotateTokenSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    const isAdmin = ctx.role === "admin" || ctx.role === "owner";
    if (!isAdmin && !parsed.data.password) {
      return fail("Como editor debes poner una contraseña en el preview");
    }
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    if (branch.isDefault) return fail("No se puede previsualizar main con token público");

    const { token, expiresAt } = await rotatePreviewToken({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      actorId: user.id,
      password: parsed.data.password ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    return { ok: true, token, expiresAt: expiresAt?.toISOString() ?? null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo rotar el token");
  }
}

export async function clearPreviewTokenAction(input: { branchId: string }): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    if (!input.branchId || !/^[0-9a-f-]{36}$/i.test(input.branchId)) {
      return fail("BranchId inválido");
    }
    await clearPreviewToken({
      workspaceId: ctx.workspace.id,
      branchId: input.branchId,
      actorId: user.id,
    });
    revalidatePath(`/admin/branches/${input.branchId}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo limpiar el token");
  }
}

const SwitchSchema = z.object({ branchId: z.string().uuid() });

/**
 * Cambia la branch activa del usuario (cookie). El branchId DEBE pertenecer al workspace.
 */
export async function switchBranchAction(input: z.input<typeof SwitchSchema>): Promise<Result> {
  try {
    await requireUser();
    const ctx = await requireWorkspace("viewer");
    const parsed = SwitchSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    if (branch.status === "abandoned" || branch.status === "merged") {
      return fail("Esta branch ya no está activa");
    }
    // M15: cookie httpOnly — el switcher la consume desde props server-side
    // (admin/layout.tsx llama a resolveActiveBranch). NO se lee desde JS.
    const store = await cookies();
    store.set(BRANCH_COOKIE, branch.id, {
      maxAge: BRANCH_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo cambiar la branch");
  }
}

export async function clearActiveBranchAction(): Promise<Result> {
  try {
    await requireUser();
    const store = await cookies();
    store.delete(BRANCH_COOKIE);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo limpiar la branch");
  }
}

const RevertSchema = z.object({
  branchId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export async function revertEntryInBranchAction(
  input: z.input<typeof RevertSchema>,
): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = RevertSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    if (branch.isDefault) return fail("No se puede revertir en main");
    await revertForkInBranch({
      workspaceId: ctx.workspace.id,
      entryId: parsed.data.entryId,
      branch,
      actorId: user.id,
    });
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    revalidatePath("/admin/contenido");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo revertir");
  }
}

const DeleteInBranchSchema = z.object({
  branchId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export async function deleteEntryInBranchAction(
  input: z.input<typeof DeleteInBranchSchema>,
): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = DeleteInBranchSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    if (branch.isDefault) {
      return fail("Para borrar en main usa la action de contenido normal");
    }
    await markDeletedInBranch({
      workspaceId: ctx.workspace.id,
      entryId: parsed.data.entryId,
      branch,
      actorId: user.id,
    });
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    revalidatePath("/admin/contenido");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo marcar como borrada");
  }
}

const CommentCreateSchema = z.object({
  branchId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  entryId: z.string().uuid().nullable().optional(),
  blockId: z.string().max(80).nullable().optional(),
  anchorRange: z
    .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
    .nullable()
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
  mentions: z.array(z.string().min(1).max(48)).max(32).nullable().optional(),
});

export async function createBranchCommentAction(
  input: z.input<typeof CommentCreateSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("viewer");
    const parsed = CommentCreateSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    const created = await createBranchComment({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      authorId: user.id,
      body: parsed.data.body,
      entryId: parsed.data.entryId ?? null,
      blockId: parsed.data.blockId ?? null,
      anchorRange: parsed.data.anchorRange ?? null,
      parentId: parsed.data.parentId ?? null,
      mentions: parsed.data.mentions ?? null,
    });
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    return { ok: true, id: created.id };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo comentar");
  }
}

const CommentResolveSchema = z.object({
  branchId: z.string().uuid(),
  commentId: z.string().uuid(),
});

export async function resolveBranchCommentAction(
  input: z.input<typeof CommentResolveSchema>,
): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("editor");
    const parsed = CommentResolveSchema.safeParse(input);
    if (!parsed.success) return fail("Datos inválidos");
    await resolveBranchComment({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      commentId: parsed.data.commentId,
      actorId: user.id,
    });
    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo resolver");
  }
}

const ProtectionConfigSchema = z.object({
  branchId: z.string().uuid(),
  /** null para desactivar reglas avanzadas (sólo `isProtected` controla). */
  config: z
    .object({
      requireReviewers: z.coerce.number().int().min(0).max(10),
      requireApprovers: z.coerce.number().int().min(0).max(10),
      requireCommentsResolved: z.boolean(),
      requireStatusApproved: z.boolean(),
    })
    .nullable(),
});

export async function setBranchProtectionAction(
  input: z.input<typeof ProtectionConfigSchema>,
): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("admin");
    const parsed = ProtectionConfigSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    const branch = await getBranchById(ctx.workspace.id, parsed.data.branchId);
    if (!branch) return fail("Branch no encontrada");
    if (branch.isDefault) return fail("La protección de main se gestiona aparte");

    await setBranchProtectionConfig({
      workspaceId: ctx.workspace.id,
      branchId: parsed.data.branchId,
      config: (parsed.data.config as BranchProtectionConfig | null) ?? null,
    });

    if (db) {
      await db.insert(branchActivity).values({
        workspaceId: ctx.workspace.id,
        branchId: parsed.data.branchId,
        type: "branch.protected_changed",
        actorId: user.id,
        payload: { config: parsed.data.config },
      });
    }
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "branch.protection_changed",
      targetType: "branch",
      targetId: parsed.data.branchId,
      meta: parsed.data.config as Record<string, unknown> | null,
    });

    revalidatePath(`/admin/branches/${parsed.data.branchId}`);
    revalidatePath(`/admin/branches/${parsed.data.branchId}/protection`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo actualizar la protección");
  }
}

export async function previewBranchProtectionAction(input: {
  branchId: string;
}): Promise<
  Result<{
    blockers: Array<{ rule: string; message: string }>;
    config: BranchProtectionConfig;
  }>
> {
  try {
    await requireUser();
    const ctx = await requireWorkspace("editor");
    if (!input.branchId || !/^[0-9a-f-]{36}$/i.test(input.branchId)) {
      return fail("BranchId inválido");
    }
    const result = await evaluateBranchProtection(ctx.workspace.id, input.branchId);
    return {
      ok: true,
      blockers: result.blockers.map((b) => ({ rule: b.rule, message: b.message })),
      config: result.config,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo evaluar la protección");
  }
}

export async function deleteBranchCommentAction(input: {
  branchId: string;
  commentId: string;
}): Promise<Result> {
  try {
    await requireUser();
    const ctx = await requireWorkspace("admin");
    if (!input.branchId || !input.commentId) return fail("Datos inválidos");
    await deleteBranchComment({
      workspaceId: ctx.workspace.id,
      branchId: input.branchId,
      commentId: input.commentId,
    });
    revalidatePath(`/admin/branches/${input.branchId}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo borrar");
  }
}
