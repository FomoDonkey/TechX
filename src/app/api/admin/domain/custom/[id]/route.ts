/**
 * F11a — DELETE /api/admin/domain/custom/[id]
 *
 * Quita un dominio custom del workspace. Si era el dominio "primary"
 * (`workspaces.customDomain`), también lo limpiamos allí.
 */

import { getCurrentUser } from "@/auth/server";
import { removeCustomDomain } from "@/domain/custom";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("admin");
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }
  const r = await removeCustomDomain({
    workspaceId: ctx.workspace.id,
    domainId: id,
    actorId: user.id,
  });
  if (!r.ok) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
