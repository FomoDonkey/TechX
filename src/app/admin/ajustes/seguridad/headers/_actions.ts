"use server";

import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { cspReports } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Marca un report CSP como tratado por un admin. No borra: el row queda
 * en la tabla con `resolvedAt` y `resolvedById` para audit. Si el browser
 * vuelve a enviarlo (regresión), el UPSERT en `/api/security/csp-report`
 * lo reabre (set `resolvedAt = NULL`).
 */
export async function resolveCspReportAction(reportId: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!db) return { ok: false as const, error: "DB no disponible" };

  await db
    .update(cspReports)
    .set({ resolvedAt: sql`NOW()`, resolvedById: user.id })
    .where(eq(cspReports.id, reportId));

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "security.csp_report_resolved",
    targetType: "csp_report",
    targetId: reportId,
  });

  revalidatePath("/admin/ajustes/seguridad/headers");
  return { ok: true as const };
}

/** Bulk: marca como tratados todos los reports de una directiva. */
export async function resolveCspDirectiveAction(directive: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!db) return { ok: false as const, error: "DB no disponible" };

  const result = await db
    .update(cspReports)
    .set({ resolvedAt: sql`NOW()`, resolvedById: user.id })
    .where(
      sql`${cspReports.violatedDirective} = ${directive} AND ${cspReports.resolvedAt} IS NULL`,
    );

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "security.csp_directive_resolved",
    targetType: "csp_directive",
    targetId: directive,
    meta: { directive, affected: (result as { rowCount?: number }).rowCount ?? null },
  });

  revalidatePath("/admin/ajustes/seguridad/headers");
  return { ok: true as const };
}
