import { type MediaKind, listMedia } from "@/lib/media";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireWorkspace("viewer");
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const type = (url.searchParams.get("type") ?? "image") as MediaKind | "all";
  const limit = Math.min(60, Number(url.searchParams.get("limit") ?? 30));
  const list = await listMedia({
    workspaceId: ctx.workspace.id,
    q,
    type,
    limit,
  });
  return NextResponse.json({
    items: list.rows.map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename,
      mime: r.mime,
      width: r.width,
      height: r.height,
      alt: r.alt,
      focalX: r.focalX,
      focalY: r.focalY,
      blurhash: r.blurhash,
      dominantColor: r.dominantColor,
      variants: r.variants,
    })),
    total: list.total,
  });
}
