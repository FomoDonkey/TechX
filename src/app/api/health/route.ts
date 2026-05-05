/**
 * Health endpoint para Docker / load balancers / Vercel monitor.
 *
 * Lo más mínimo posible: 200 OK con un payload tiny. NO toca BD para
 * que un container que arranca ANTES de que la BD esté lista pase el
 * healthcheck en cuanto Next.js esté escuchando.
 *
 * Para diagnosticar el estado de BD/AI/etc usa `/admin/salud` (UI completa).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
