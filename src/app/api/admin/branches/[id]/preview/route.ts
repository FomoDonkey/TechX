import { getBranchById } from "@/branches";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/branches/[id]/preview
 * Devuelve la URL pública del preview (si hay token activo).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const wsCtx = await requireWorkspace("viewer");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Branch inválida" }, { status: 400 });
  }
  const branch = await getBranchById(wsCtx.workspace.id, id);
  if (!branch) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (!branch.previewToken) {
    return NextResponse.json({
      ok: false,
      reason: "no-token",
      hint: "Rota un token desde la página de la branch para activar el preview.",
    });
  }
  if (branch.previewExpiresAt && branch.previewExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, reason: "expired" });
  }
  return NextResponse.json({
    ok: true,
    url: `/preview/branch/${branch.previewToken}/`,
    hasPassword: !!branch.previewPasswordHash,
    expiresAt: branch.previewExpiresAt,
    views: branch.previewViews,
  });
}
