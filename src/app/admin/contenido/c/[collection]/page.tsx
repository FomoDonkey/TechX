import { ensureSingletonEntryAction } from "@/app/admin/contenido/_actions";
import { CollectionContentHeader } from "@/components/admin/contenido/collection-content-header";
import { PostsTable } from "@/components/admin/contenido/posts-table";
import { SearchInput } from "@/components/admin/contenido/search-input";
import { StatusTabs } from "@/components/admin/contenido/status-tabs";
import { getCollectionBySlug } from "@/lib/collections";
import { listEntries } from "@/lib/entries";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type SP = { status?: string; q?: string; page?: string };
const VALID_STATUSES = new Set([
  "all",
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string }>;
}): Promise<Metadata> {
  const { collection } = await params;
  const ctx = await requireWorkspace("editor");
  const c = await getCollectionBySlug(ctx.workspace.id, collection);
  return { title: c ? `${c.name} · Contenido · CSM` : "Colección · CSM" };
}

export default async function CollectionContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<SP>;
}) {
  const { collection: slug } = await params;
  const ctx = await requireWorkspace("editor");
  const collection = await getCollectionBySlug(ctx.workspace.id, slug);
  if (!collection) notFound();

  if (collection.isSingleton) {
    // Para singletons, asegura entry y redirige al editor
    const res = await ensureSingletonEntryAction({
      collectionId: collection.id,
      collectionName: collection.name,
    });
    if (res.ok) redirect(`/admin/contenido/${res.id}`);
    notFound();
  }

  const sp = await searchParams;
  const status = (VALID_STATUSES.has(sp.status ?? "") ? sp.status : "all") as
    | "all"
    | "draft"
    | "review"
    | "approved"
    | "scheduled"
    | "published"
    | "archived";
  const q = sp.q ?? "";
  const pageNum = Math.max(Number.parseInt(sp.page ?? "1", 10) || 1, 1);
  const PER_PAGE = 50;

  const { rows, total, counts } = await listEntries({
    workspaceId: ctx.workspace.id,
    collectionSlug: slug,
    status,
    q: q || undefined,
    limit: PER_PAGE,
    offset: (pageNum - 1) * PER_PAGE,
  });

  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <CollectionContentHeader
        collection={{
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          icon: collection.icon,
          description: collection.description,
          isBuiltin: collection.isBuiltin,
          totalCount: counts.all,
        }}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <StatusTabs
          current={status}
          counts={counts}
          q={q || undefined}
          basePath={`/admin/contenido/c/${slug}`}
        />
        <SearchInput initial={q} />
      </div>

      <PostsTable rows={rows} workspaceSlug={ctx.workspace.slug} />

      {totalPages > 1 ? (
        <Pagination
          base={`/admin/contenido/c/${slug}`}
          total={total}
          page={pageNum}
          totalPages={totalPages}
          status={status}
          q={q}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  base,
  page,
  totalPages,
  total,
  status,
  q,
}: {
  base: string;
  page: number;
  totalPages: number;
  total: number;
  status: string;
  q: string;
}) {
  function href(p: number) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return params.toString() ? `${base}?${params.toString()}` : base;
  }
  return (
    <nav className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Página {page} de {totalPages} · {total} entradas
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
