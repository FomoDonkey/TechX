import { listKeyAudit } from "@/api/keys";
import { requireUser } from "@/auth/server";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exporta el audit log de una API key como CSV. Sólo admin del workspace
 * puede descargar — `requireWorkspace("admin")` aplica el gate.
 *
 * Headers: Content-Disposition con timestamp para que el browser sugiera
 * un filename estable. Cap a 1000 filas para evitar exports gigantes;
 * F10e añadirá paginación o async export a Blob si crece la demanda.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const wsCtx = await requireWorkspace("admin");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const rows = (await listKeyAudit(wsCtx.workspace.id, id, 1000)) as Array<{
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    denyReason: string | null;
    ipHash: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;

  const header = [
    "createdAt",
    "method",
    "path",
    "statusCode",
    "durationMs",
    "denyReason",
    "ipHash",
    "userAgent",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.method,
      csvEscape(r.path),
      String(r.statusCode),
      String(r.durationMs),
      csvEscape(r.denyReason ?? ""),
      csvEscape(r.ipHash ?? ""),
      csvEscape(r.userAgent ?? ""),
    ].join(","),
  );
  const body = `${header}\n${lines.join("\n")}\n`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="api-key-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(v: string): string {
  if (!v) return "";
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
