import { resolveLayout } from "@/blocks/resolve";
import { normalizeLayout } from "@/blocks/types";
import { PageBuilder } from "@/components/admin/builder/page-builder";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { getPageById } from "@/lib/pages";
import { listSymbols } from "@/lib/symbols";
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
  if (!isUuid(id)) return { title: "Editor de página · techx" };
  const ctx = await requireWorkspace("editor");
  const p = await getPageById(ctx.workspace.id, id);
  return { title: p ? `${p.title} · Builder · techx` : "Editor de página · techx" };
}

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireWorkspace("author");
  const page = await getPageById(ctx.workspace.id, id);
  if (!page) notFound();

  const layout = normalizeLayout(page.layout);
  const initialCtx = await resolveLayout(ctx.workspace.id, layout, { followSymbols: true });

  // Lista de símbolos para el selector del bloque "symbol"
  const symbols = await listSymbols(ctx.workspace.id);

  // Lista de media reciente para picker rápido (top 200)
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
    <PageBuilder
      pageId={page.id}
      initialTitle={page.title}
      initialPath={page.path}
      initialStatus={page.status}
      initialIsHome={page.isHome}
      initialLayout={layout}
      initialSeo={page.seo ?? null}
      initialMediaIndex={Array.from(initialCtx.mediaMap.values())}
      symbols={symbols.map((s) => ({ id: s.id, name: s.name }))}
      recentMedia={recentMedia.map((m) => ({
        id: m.id,
        url: m.url,
        alt: m.alt,
        width: m.width,
        height: m.height,
        mime: m.mime,
      }))}
      workspaceSlug={ctx.workspace.slug}
    />
  );
}
