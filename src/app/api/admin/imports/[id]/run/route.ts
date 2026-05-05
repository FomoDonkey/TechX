import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { atomicClaim } from "@/db/dialect";
import { imports } from "@/db/schema";
import { runImport } from "@/imports/engine";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/admin/imports/[id]/run — lanza el engine. Devuelve 202 inmediato
 * y procesa en background con `after()` (Next 15 / Fluid Compute). El cliente
 * suscribe a /stream para ver el progreso en vivo.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });

  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const dryRun = parsed.success ? (parsed.data.dryRun ?? false) : false;

  // Claim atómico: solo un caller puede transicionar a `running`. Ventana
  // entre el SELECT y el UPDATE en runImport era explotable con doble-click
  // o requests paralelos — ambos engines arrancaban y corrompían stats /
  // generaban colisiones de originRef. El UPDATE ... RETURNING con WHERE en
  // los estados aceptados es atómico.
  const ALLOWED_PRECLAIM_STATUSES = new Set(["uploaded", "ready", "failed"]);
  const claimed = await atomicClaim<{
    id: string;
    workspaceId: string;
    status: string;
    mapping: unknown;
  }>(imports, {
    where: and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id))!,
    precondition: (row) => ALLOWED_PRECLAIM_STATUSES.has(row.status),
    set: { status: "running", startedAt: new Date(), errorLog: [], dryRun },
  });

  if (!claimed) {
    // Determinar por qué falló: not found / running / terminal
    const [existing] = await db
      .select({ status: imports.status, mapping: imports.mapping })
      .from(imports)
      .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "running")
      return NextResponse.json({ error: "Ya en ejecución" }, { status: 409 });
    return NextResponse.json(
      { error: `Import en estado ${existing.status}; crea uno nuevo` },
      { status: 409 },
    );
  }

  if (!claimed.mapping) {
    // Revertir el claim si falta mapping (raro: el wizard lo enforcea antes)
    await db.update(imports).set({ status: "uploaded", startedAt: null }).where(eq(imports.id, id));
    return NextResponse.json({ error: "Falta mapping; configura primero" }, { status: 400 });
  }

  // Off-band: el engine arranca después de devolver 202. Como ya hicimos el
  // claim atómico, el engine asume status='running' y procede directamente.
  after(async () => {
    try {
      await runImport({
        importId: id,
        workspaceId: ctx.workspace.id,
        userId: user?.id ?? null,
      });
    } catch (err) {
      console.error("[runImport] failed", err);
    }
  });

  return NextResponse.json({ ok: true, dryRun }, { status: 202 });
}
