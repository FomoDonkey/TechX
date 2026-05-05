/**
 * POST /api/admin/live-edit — actualiza props de un bloque en la página pública
 * actual desde el overlay Live-Edit (F8c).
 *
 * Auth: requiere sesión Better-Auth + rol >= editor en el workspace que posee
 * la página.
 *
 * Body:
 *   { pageId, blockId, props } — props se valida contra el spec del bloque
 *   antes de mergear; sólo strings/textos para v1 (rich/imágenes via admin).
 */

import { getCurrentUser } from "@/auth/server";
import { validateProps } from "@/blocks/registry";
import { type BlockNode, findNode, normalizeLayout, updateNode } from "@/blocks/types";
import { db } from "@/db/client";
import { members, pages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { updatePage } from "@/lib/pages";
import { type Role, can } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    pageId: z.string().uuid(),
    blockId: z.string().min(1).max(64),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "db_disabled" }, { status: 503 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Cap props payload size (anti-abuse)
  if (JSON.stringify(body.props).length > 64 * 1024) {
    return NextResponse.json({ error: "props_too_large" }, { status: 400 });
  }

  // 1) Lookup página + workspace + verificar permiso del usuario
  const [page] = await db.select().from(pages).where(eq(pages.id, body.pageId)).limit(1);
  if (!page) return NextResponse.json({ error: "page_not_found" }, { status: 404 });

  // Live-Edit sólo opera sobre páginas publicadas. Páginas en `draft` o
  // `archived` se editan desde /admin/paginas con el editor completo (que
  // expone también campos rich/items que el overlay no soporta). Bloquear
  // POST directo con pageId conocido evita revertir cambios pendientes.
  if (page.status !== "published") {
    return NextResponse.json({ error: "page_not_published" }, { status: 403 });
  }

  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.workspaceId, page.workspaceId), eq(members.userId, user.id)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!can(membership.role as Role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) Encuentra el nodo y aplica patch sobre props validadas
  const layout = normalizeLayout(page.layout);
  const node = findNode(layout, body.blockId);
  if (!node) return NextResponse.json({ error: "block_not_found" }, { status: 404 });

  const merged = { ...node.props, ...body.props };
  const validated = validateProps(node.kind, merged);
  const newLayout = updateNode(layout, body.blockId, (n: BlockNode) => ({
    ...n,
    props: validated,
  }));

  await updatePage({
    workspaceId: page.workspaceId,
    id: page.id,
    layout: newLayout,
    userId: user.id,
  });

  await logActivity({
    workspaceId: page.workspaceId,
    actorId: user.id,
    action: "page.live_edit",
    targetType: "page",
    targetId: page.id,
    meta: { blockId: body.blockId, kind: node.kind },
  });

  revalidatePath(page.path === "/" ? "/" : page.path);
  if (page.isHome) revalidatePath("/");

  return NextResponse.json({ ok: true });
}
