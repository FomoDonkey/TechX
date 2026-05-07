/**
 * F11a — PATCH /api/admin/domain/slug
 *
 * Cambia el slug del workspace activo. Registra el viejo en
 * `workspace_slug_history` durante 30 días para que enlaces externos
 * compartidos con el slug viejo sigan funcionando vía 301.
 *
 * Body: { slug: string }
 * Resp: { ok: true; oldSlug; newSlug }
 *     | { ok: false; reason; message }
 */

import { getCurrentUser } from "@/auth/server";
import { renameWorkspaceSlug } from "@/domain/rename";
import { slugErrorMessage } from "@/domain/slug";
import { WS_COOKIE, requireWorkspace } from "@/lib/workspace";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().trim().min(1).max(100) }).strict();

export async function PATCH(req: Request) {
  const ctx = await requireWorkspace("admin");
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, reason: "invalid_body" }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const r = await renameWorkspaceSlug({
    workspaceId: ctx.workspace.id,
    newSlug: body.slug,
    actorId: user.id,
  });

  if (!r.ok) {
    const status =
      r.reason === "taken_workspace" || r.reason === "taken_history" || r.reason === "reserved"
        ? 409
        : r.reason === "no_change"
          ? 400
          : 400;
    return NextResponse.json(
      { ok: false, reason: r.reason, message: reasonToMessage(r.reason) },
      { status },
    );
  }

  // F11a-fix: actualiza cookie `csm_ws` al nuevo slug. Si no la actualizamos,
  // el `currentWorkspace()` no encuentra el workspace al recargar (la cookie
  // tiene el slug viejo y `eq(workspaces.slug, oldSlug)` no matchea).
  const c = await cookies();
  c.set(WS_COOKIE, r.newSlug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, oldSlug: r.oldSlug, newSlug: r.newSlug });
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "taken_workspace":
      return "Ese nombre ya lo usa otro sitio.";
    case "taken_history":
      return "Ese nombre estuvo en uso recientemente. Inténtalo en 30 días.";
    case "no_change":
      return "Ya estás usando ese nombre.";
    case "reserved":
      return "Ese nombre está reservado por el sistema.";
    case "invalid":
      return "El nombre no es válido.";
    case "workspace_not_found":
      return "Workspace no encontrado.";
    default:
      return slugErrorMessage(reason as never) ?? "No se pudo cambiar el nombre.";
  }
}
