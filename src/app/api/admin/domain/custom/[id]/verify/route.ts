/**
 * F11a — POST /api/admin/domain/custom/[id]/verify
 *
 * Lanza un DNS lookup contra el dominio. Acepta verificación por:
 *   - TXT `_csm-verify.<domain>` con el token de la fila
 *   - CNAME `<domain>` apuntando al ROOT_DOMAIN o a `cname.vercel-dns.com`
 *
 * Si OK → marca `verifiedAt`. A partir de ese momento el resolver acepta
 * `Host: <domain>` para servir el workspace.
 */

import { getCurrentUser } from "@/auth/server";
import { verifyCustomDomain } from "@/domain/custom";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("admin");
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  const r = await verifyCustomDomain({
    workspaceId: ctx.workspace.id,
    domainId: id,
    actorId: user.id,
  });
  if (!r.ok) {
    const status = r.reason === "not_found" ? 404 : 400;
    return NextResponse.json(
      { ok: false, reason: r.reason, message: reasonToMessage(r.reason) },
      { status },
    );
  }
  return NextResponse.json({ ok: true, domain: r.domain });
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "not_found":
      return "Dominio no encontrado.";
    case "already_verified":
      return "Ya está verificado.";
    case "dns_lookup_failed":
      return "No se pudo consultar el DNS. Inténtalo en unos minutos.";
    case "no_record_match":
      return "No encontramos el registro DNS esperado. Asegúrate de haber configurado el CNAME o TXT y espera unos minutos a que propague.";
    case "db_disabled":
      return "Base de datos no disponible.";
    default:
      return "Verificación fallida.";
  }
}
