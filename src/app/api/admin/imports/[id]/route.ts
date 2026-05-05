import { db } from "@/db/client";
import { collections, importItems, imports } from "@/db/schema";
import type { ImportMapping } from "@/imports/types";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

type ImportMediaPolicy = "download" | "link" | "skip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/imports/[id] — fila + últimas 200 import_items. */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select()
    .from(importItems)
    .where(and(eq(importItems.importId, id), eq(importItems.workspaceId, ctx.workspace.id)))
    .orderBy(desc(importItems.createdAt))
    .limit(200);

  return NextResponse.json({ row, items });
}

const PatchSchema = z.object({
  mapping: z
    .object({
      collectionId: z.string().min(1),
      defaultLocale: z.string().min(2).max(10).optional(),
      defaultStatus: z.enum(["draft", "published"]).optional(),
      fields: z.record(z.string(), z.string()).optional(),
      createRedirects: z.boolean().optional(),
      autoCreateTerms: z.boolean().optional(),
    })
    .optional(),
  mediaPolicy: z.enum(["download", "link", "skip"] as const).optional(),
  status: z.enum(["uploaded", "ready"] as const).optional(),
});

/** PATCH — actualizar mapping/mediaPolicy antes de correr. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ status: imports.status })
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    existing.status === "running" ||
    existing.status === "completed" ||
    existing.status === "reverted"
  ) {
    return NextResponse.json(
      { error: `No se puede editar en estado ${existing.status}` },
      { status: 409 },
    );
  }

  // Si el mapping incluye collectionId, valida tenant antes de persistir.
  if (parsed.data.mapping?.collectionId && parsed.data.mapping.collectionId !== "_builtin_posts") {
    const target = parsed.data.mapping.collectionId;
    if (!isUuid(target)) {
      return NextResponse.json({ error: "collectionId inválido" }, { status: 400 });
    }
    const owned = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, target), eq(collections.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!owned[0]) {
      return NextResponse.json({ error: "Colección no pertenece al workspace" }, { status: 403 });
    }
  }

  const next: Partial<typeof imports.$inferInsert> = {};
  if (parsed.data.mapping) next.mapping = parsed.data.mapping as ImportMapping;
  if (parsed.data.mediaPolicy) next.mediaPolicy = parsed.data.mediaPolicy as ImportMediaPolicy;
  if (parsed.data.status) next.status = parsed.data.status;

  await db
    .update(imports)
    .set(next)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)));
  const [updated] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  return NextResponse.json({ row: updated });
}

/** DELETE — borrar fila import (solo si no está running). El archivo en storage también. */
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "running") {
    return NextResponse.json({ error: "Está en ejecución" }, { status: 409 });
  }

  // Borrar también el archivo en storage si existe
  if (row.fileKey) {
    try {
      const { currentStorage } = await import("@/storage");
      await currentStorage().delete(row.fileKey);
    } catch {
      // best-effort
    }
  }

  await db.delete(imports).where(eq(imports.id, id));
  return NextResponse.json({ ok: true });
}
