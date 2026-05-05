import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { scanWorkspace } from "@/health";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Functions: 5min máximo en hobby, 15min Pro. Suficiente para batch.
export const maxDuration = 300;

/**
 * Cron weekly de Content Health Scan. Recorre workspaces y escanea entries
 * publicados. Idempotente: si el `inputHash` no cambió, no re-corre detectores
 * ni toca DB.
 *
 * **Schedule:** lunes 02:00 UTC ("0 2 * * 1") — definido en `vercel.json`.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  if (!db) return Response.json({ ok: false, error: "db_unavailable" }, { status: 500 });

  const start = Date.now();
  const list = await db.select({ id: workspaces.id, slug: workspaces.slug }).from(workspaces);

  const results: Array<{
    workspaceId: string;
    slug: string;
    scanned: number;
    cached: number;
  }> = [];

  for (const ws of list) {
    try {
      const r = await scanWorkspace({ workspaceId: ws.id });
      results.push({ workspaceId: ws.id, slug: ws.slug, scanned: r.scanned, cached: r.cached });
    } catch (e) {
      console.error("[cron/health-scan] failed", { ws: ws.id, err: String(e) });
    }
  }

  return Response.json({
    ok: true,
    durationMs: Date.now() - start,
    workspaces: results.length,
    results,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
