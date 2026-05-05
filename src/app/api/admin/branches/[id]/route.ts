import {
  getBranchById,
  listBranchActivity,
  listBranchComments,
  listEntriesForBranch,
} from "@/branches";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const wsCtx = await requireWorkspace("viewer");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Branch inválida" }, { status: 400 });
  }
  const branch = await getBranchById(wsCtx.workspace.id, id);
  if (!branch) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const [entries, activity, comments] = await Promise.all([
    listEntriesForBranch({
      workspaceId: wsCtx.workspace.id,
      branch,
      includeTombstones: true,
    }),
    listBranchActivity({
      workspaceId: wsCtx.workspace.id,
      branchId: id,
      limit: 60,
    }),
    listBranchComments({ workspaceId: wsCtx.workspace.id, branchId: id }),
  ]);

  return NextResponse.json({
    branch,
    entries: entries.map(({ entry, visibility }) => ({
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      collectionId: entry.collectionId,
      updatedAt: entry.updatedAt,
      visibility,
      originalEntryId: entry.originalEntryId,
    })),
    activity,
    comments,
  });
}
