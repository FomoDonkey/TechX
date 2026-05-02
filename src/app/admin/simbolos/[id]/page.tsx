import { resolveLayout } from "@/blocks/resolve";
import { normalizeLayout } from "@/blocks/types";
import { SymbolBuilder } from "@/components/admin/builder/symbol-builder";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { getSymbolById, listSymbols } from "@/lib/symbols";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Símbolo · CSM" };
  const ctx = await requireWorkspace("editor");
  const s = await getSymbolById(ctx.workspace.id, id);
  return { title: s ? `${s.name} · Símbolos · CSM` : "Símbolo · CSM" };
}

export default async function SymbolEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireWorkspace("editor");
  const symbol = await getSymbolById(ctx.workspace.id, id);
  if (!symbol) notFound();

  const layout = normalizeLayout(symbol.layout);
  const initialCtx = await resolveLayout(ctx.workspace.id, layout, { followSymbols: true });

  // Otros símbolos disponibles para insertar (excluyendo este)
  const otherSymbols = (await listSymbols(ctx.workspace.id)).filter((s) => s.id !== symbol.id);

  const recentMedia = db
    ? await db
        .select({
          id: media.id,
          url: media.url,
          alt: media.alt,
          width: media.width,
          height: media.height,
          mime: media.mime,
        })
        .from(media)
        .where(eq(media.workspaceId, ctx.workspace.id))
        .orderBy(desc(media.createdAt))
        .limit(200)
    : [];

  return (
    <SymbolBuilder
      symbolId={symbol.id}
      initialName={symbol.name}
      initialDescription={symbol.description}
      initialLayout={layout}
      initialMediaIndex={Array.from(initialCtx.mediaMap.values())}
      symbols={otherSymbols.map((s) => ({ id: s.id, name: s.name }))}
      recentMedia={recentMedia.map((m) => ({
        id: m.id,
        url: m.url,
        alt: m.alt,
        width: m.width,
        height: m.height,
        mime: m.mime,
      }))}
    />
  );
}
