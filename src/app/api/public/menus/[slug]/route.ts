/**
 * GET /api/public/menus/[slug]
 *
 * Devuelve el menú resuelto (items con href finales) para consumirlo desde el
 * frontend público o desde apps externas. Sin auth, CORS abierto, cache 60s.
 */

import { getPublicMenuBySlug, resolveMenu } from "@/menus/lib";
import type { MenuItem } from "@/menus/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "origin",
};

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const host = req.headers.get("host") ?? undefined;
  const menu = await getPublicMenuBySlug(slug, host);
  if (!menu) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Menú no encontrado" } },
      { status: 404, headers: CORS },
    );
  }
  const items = (menu.items as unknown as MenuItem[] | null) ?? [];
  const resolved = await resolveMenu(menu.workspaceId, items);
  return NextResponse.json(
    {
      data: {
        id: menu.id,
        slug: menu.slug,
        name: menu.name,
        description: menu.description,
        location: menu.location,
        version: menu.version,
        items: resolved,
      },
    },
    {
      headers: {
        ...CORS,
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
