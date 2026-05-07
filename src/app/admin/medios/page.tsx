import { AssetDetailPanel } from "@/components/admin/medios/asset-detail-panel";
import { MediosEmpty } from "@/components/admin/medios/empty-state";
import { FilterBar } from "@/components/admin/medios/filter-bar";
import { type FolderNode, FolderTree } from "@/components/admin/medios/folder-tree";
import { MediaGridShell } from "@/components/admin/medios/media-grid";
import { MediaList } from "@/components/admin/medios/media-list";
import { db } from "@/db/client";
import { countInt } from "@/db/dialect";
import { media } from "@/db/schema";
import { findAssetUsages } from "@/lib/asset-usage";
import { type MediaKind, getMediaById, listFolders, listMedia } from "@/lib/media";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Medios · techx",
};

const PAGE_SIZE = 60;

type PageProps = {
  searchParams: Promise<{
    folder?: string;
    view?: string;
    type?: string;
    q?: string;
    alt?: string;
    sort?: string;
    page?: string;
    asset?: string;
  }>;
};

export default async function MediosPage({ searchParams }: PageProps) {
  const ctx = await requireWorkspace("viewer");
  const sp = await searchParams;

  const folderId = sp.folder && isUuid(sp.folder) ? sp.folder : null;
  const view: "grid" | "list" = sp.view === "list" ? "list" : "grid";
  const q = sp.q?.trim() ?? "";
  const altMissing = sp.alt === "missing";
  const type = (sp.type ?? "all") as MediaKind | "all";
  const sort = (sp.sort ?? "newest") as "newest" | "oldest" | "size";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const assetParam = sp.asset && isUuid(sp.asset) ? sp.asset : null;

  const [folders, list, allCounts, asset] = await Promise.all([
    listFolders(ctx.workspace.id),
    listMedia({
      workspaceId: ctx.workspace.id,
      folderId,
      q: q || undefined,
      type,
      altMissing,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db
      ? db
          .select({
            folderId: media.folderId,
            count: countInt(),
          })
          .from(media)
          .where(eq(media.workspaceId, ctx.workspace.id))
          .groupBy(media.folderId)
      : Promise.resolve([]),
    assetParam ? getMediaById(ctx.workspace.id, assetParam) : Promise.resolve(null),
  ]);

  const usages = asset ? await findAssetUsages(ctx.workspace.id, asset.url, 25) : [];

  const countsByFolder = new Map<string | null, number>();
  for (const row of allCounts) {
    countsByFolder.set(row.folderId ?? null, row.count);
  }

  const folderNodes: FolderNode[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    count: countsByFolder.get(f.id) ?? 0,
  }));
  const rootCount = Array.from(countsByFolder.entries()).reduce((acc, [, n]) => acc + n, 0);

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  const isEmpty = list.total === 0 && !q && !altMissing && type === "all" && folderId === null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <FolderTree folders={folderNodes} rootCount={rootCount} current={folderId} />

      <div className="flex flex-1 flex-col">
        <header className="border-b px-6 py-4">
          <h1 className="font-display text-2xl font-semibold">Medios</h1>
          <p className="text-sm text-muted-foreground">
            {list.total > 0 ? `${list.total} archivo(s)` : "Aún no hay archivos en esta carpeta"}
          </p>
        </header>

        <FilterBar
          view={view}
          type={type === "all" ? "" : type}
          q={q}
          altMissing={altMissing}
          folderId={folderId}
        />

        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <MediosEmpty />
          ) : list.rows.length === 0 ? (
            <div className="grid place-items-center p-20 text-center text-muted-foreground">
              <p>No hay resultados con esos filtros.</p>
            </div>
          ) : view === "grid" ? (
            <Suspense>
              <MediaGridShell items={list.rows} />
            </Suspense>
          ) : (
            <MediaList items={list.rows} />
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <PagerLink to={page - 1} disabled={page <= 1} searchParams={sp} label="Anterior" />
                <PagerLink
                  to={page + 1}
                  disabled={page >= totalPages}
                  searchParams={sp}
                  label="Siguiente"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {asset ? <AssetDetailPanel asset={asset} usages={usages} /> : null}
    </div>
  );
}

function PagerLink({
  to,
  disabled,
  searchParams,
  label,
}: {
  to: number;
  disabled: boolean;
  searchParams: Awaited<PageProps["searchParams"]>;
  label: string;
}) {
  if (disabled) {
    return <span className="rounded-lg border px-3 py-1 opacity-50">{label}</span>;
  }
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) sp.set(k, v);
  }
  sp.set("page", String(to));
  const href = `/admin/medios?${sp.toString()}`;
  return (
    <a className="rounded-lg border px-3 py-1 hover:bg-muted" href={href}>
      {label}
    </a>
  );
}
