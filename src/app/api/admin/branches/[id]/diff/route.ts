import { diffEntry, getBranchById, resolveEntryForBranch } from "@/branches";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/branches/[id]/diff?entry=<entryId>
 * Devuelve diff completo (blocks + meta) entre la versión main y la versión branch.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const wsCtx = await requireWorkspace("viewer");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Branch inválida" }, { status: 400 });
  }
  const branch = await getBranchById(wsCtx.workspace.id, id);
  if (!branch) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const entryId = new URL(req.url).searchParams.get("entry");
  if (!entryId || !/^[0-9a-f-]{36}$/i.test(entryId)) {
    return NextResponse.json({ error: "entry param requerido" }, { status: 400 });
  }

  const resolved = await resolveEntryForBranch({
    workspaceId: wsCtx.workspace.id,
    entryId,
    branch,
  });
  if (!resolved) return NextResponse.json({ error: "Entry no encontrada" }, { status: 404 });

  const diff = diffEntry(resolved.base, resolved.entry);
  return NextResponse.json({
    diff,
    visibility: resolved.visibility,
    base: resolved.base
      ? { id: resolved.base.id, title: resolved.base.title, updatedAt: resolved.base.updatedAt }
      : null,
    current: {
      id: resolved.entry.id,
      title: resolved.entry.title,
      updatedAt: resolved.entry.updatedAt,
    },
  });
}
