import { requireWorkspace } from "@/lib/workspace";
import { processIndexJobs } from "@/search/jobs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Procesa un lote de embeddings pendientes.
 * Llamado desde:
 *  - botón "Reindexar" en /admin/buscar
 *  - cron diario (futuro Vercel Cron)
 */
export async function POST(req: Request) {
  let ctx: Awaited<ReturnType<typeof requireWorkspace>>;
  try {
    ctx = await requireWorkspace("editor");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const batchSize = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "10")));
  // IMPORTANTE: pasar workspaceId para evitar que un editor de wsA gaste
  // presupuesto de embeddings procesando jobs de wsB (multi-tenant compute leak).
  const result = await processIndexJobs(batchSize, ctx.workspace.id);
  return NextResponse.json(result);
}
