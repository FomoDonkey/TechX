"use server";

import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { dismissIssue, scanEntry, scanWorkspace } from "@/health";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Re-escanea un solo entry síncronamente. Devuelve el score actualizado.
 * Roles: editor o superior.
 */
export async function rescanEntryAction(input: { entryId: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) throw new Error("db_unavailable");
  const [entry] = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.id, input.entryId),
        eq(entries.workspaceId, ctx.workspace.id),
        isNull(entries.branchId),
      ),
    )
    .limit(1);
  if (!entry) throw new Error("entry_not_found");
  const result = await scanEntry({ entry, force: true });
  revalidatePath("/admin/salud");
  revalidatePath(`/admin/contenido/${input.entryId}`);
  return { score: result.score, issues: result.issues.length, userId: user.id };
}

/**
 * Dispara un escaneo completo del workspace. En workspaces grandes puede
 * tardar minutos — no bloquea la UI gracias a `revalidatePath` al final.
 */
export async function rescanWorkspaceAction() {
  await requireUser();
  const ctx = await requireWorkspace("editor");
  const result = await scanWorkspace({ workspaceId: ctx.workspace.id, force: true });
  revalidatePath("/admin/salud");
  return result;
}

/**
 * Marca un issue como descartado (false positive). No se borra, sólo se oculta
 * en el dashboard por defecto. Audit log queda intacto.
 */
export async function dismissIssueAction(input: { issueId: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  await dismissIssue({
    workspaceId: ctx.workspace.id,
    issueId: input.issueId,
    userId: user.id,
  });
  revalidatePath("/admin/salud");
  return { ok: true };
}
