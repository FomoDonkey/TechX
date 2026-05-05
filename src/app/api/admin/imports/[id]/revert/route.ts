import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { revertImport } from "@/imports/engine";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/imports/[id]/revert — borra todas las entries del lote. */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "running")
    return NextResponse.json({ error: "Está en ejecución" }, { status: 409 });
  if (row.status !== "completed") {
    return NextResponse.json({ error: "Solo se revierten imports completos" }, { status: 409 });
  }

  const result = await revertImport({
    importId: id,
    workspaceId: ctx.workspace.id,
    userId: user?.id ?? null,
  });
  return NextResponse.json(result);
}
