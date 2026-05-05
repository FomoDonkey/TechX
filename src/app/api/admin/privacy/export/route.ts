import { getCurrentUser } from "@/auth/server";
import { buildExportZip } from "@/privacy/lib";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR data export. Devuelve un ZIP con todos los datos personales del user
 * autenticado. Stream-safe — el ZIP se construye in-memory pero JSZip lo
 * comprime al vuelo.
 */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const bytes = await buildExportZip(user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(bytes) as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="csm-export-${stamp}.zip"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "export_failed", message: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
