/**
 * F11d — POST /api/admin/workspaces
 *
 * Crea un workspace nuevo. El usuario actual queda como owner. Setea la
 * cookie del workspace activo para que la UI cambie automáticamente al
 * recién creado.
 *
 * Body: { name: string; slug: string }
 * Resp: { ok: true; workspace: {id, slug, name} }
 *     | { ok: false; reason; message }
 */

import { getCurrentUser } from "@/auth/server";
import { createWorkspace } from "@/domain/create-workspace";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    name: z.string().trim().min(2).max(60),
    slug: z.string().trim().min(1).max(100),
  })
  .strict();

export async function POST(req: Request) {
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

  const r = await createWorkspace({
    name: body.name,
    slug: body.slug,
    ownerId: user.id,
  });

  if (!r.ok) {
    const status =
      r.reason === "slug_taken" || r.reason === "reserved_slug"
        ? 409
        : r.reason === "db_disabled"
          ? 503
          : 400;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json(r);
}
