/**
 * F11a — POST /api/admin/domain/custom
 *
 * Añade un dominio custom al workspace. Crea fila pending en
 * `workspace_domains` con `verifyToken`. La UI muestra al usuario los
 * registros DNS que tiene que configurar; cuando estén listos llama a
 * `POST /api/admin/domain/custom/<id>/verify`.
 *
 * Body: { domain: string }
 * Resp: { ok: true; domain: WorkspaceDomain }
 *     | { ok: false; reason; message }
 */

import { getCurrentUser } from "@/auth/server";
import { addCustomDomain } from "@/domain/custom";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ domain: z.string().trim().min(1).max(255) }).strict();

export async function POST(req: Request) {
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

  const r = await addCustomDomain({
    workspaceId: ctx.workspace.id,
    domain: body.domain,
    actorId: user.id,
  });

  if (!r.ok) {
    const status = r.reason === "taken" || r.reason === "already_added" ? 409 : 400;
    return NextResponse.json(
      { ok: false, reason: r.reason, message: reasonToMessage(r.reason) },
      { status },
    );
  }
  return NextResponse.json({ ok: true, domain: r.domain });
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "invalid":
      return "El formato del dominio no es válido. Ejemplo: miblog.com";
    case "ip_address":
      return "No puedes usar una IP como dominio.";
    case "too_long":
      return "El dominio es demasiado largo.";
    case "taken":
      return "Ese dominio ya está vinculado a otro sitio.";
    case "already_added":
      return "Ya añadiste ese dominio a este sitio.";
    case "db_disabled":
      return "Base de datos no disponible.";
    default:
      return "No se pudo añadir el dominio.";
  }
}
