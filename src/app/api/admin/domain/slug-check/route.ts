/**
 * F11a — POST /api/admin/domain/slug-check
 *
 * Comprueba disponibilidad de un slug propuesto. Llamado por la UI con
 * debounce mientras el usuario escribe en el input. NO muta nada.
 *
 * Body: { slug: string }
 * Resp: { ok: true; available: boolean; selfMatch: boolean }
 *     | { ok: false; reason: string; message: string }
 */

import { checkSlugAvailability } from "@/domain/rename";
import { slugErrorMessage, validateSlug } from "@/domain/slug";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().trim().min(1).max(100) }).strict();

export async function POST(req: Request) {
  // Read-only: solo verifica disponibilidad. `viewer` basta. Lo llaman
  // tanto el form de rename (admin) como el form de "Crear nuevo sitio"
  // (editor), así que el rol más bajo del set permitidos es viewer.
  const ctx = await requireWorkspace("viewer");

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

  // Validación sintáctica primero — devuelve mensaje user-facing localizado.
  const v = validateSlug(body.slug);
  if (!v.ok) {
    return NextResponse.json({
      ok: false,
      reason: v.error,
      message: slugErrorMessage(v.error),
    });
  }

  const r = await checkSlugAvailability(v.slug, ctx.workspace.id);
  if (!r.ok) {
    return NextResponse.json({
      ok: false,
      reason: r.reason,
      message: reasonToMessage(r.reason),
    });
  }
  return NextResponse.json({
    ok: true,
    available: true,
    selfMatch: r.availableForSelf,
    slug: r.slug,
  });
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "taken_workspace":
      return "Ese nombre ya lo usa otro sitio.";
    case "taken_history":
      return "Ese nombre estuvo en uso recientemente. Inténtalo en 30 días.";
    case "reserved":
      return "Ese nombre está reservado por el sistema.";
    case "invalid":
      return "El nombre no es válido.";
    case "db_disabled":
      return "Base de datos no disponible.";
    default:
      return "No se pudo verificar disponibilidad.";
  }
}
