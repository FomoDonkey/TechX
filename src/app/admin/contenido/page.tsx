import { createNewPostFormAction } from "@/app/admin/contenido/_actions";
import { NewPostButton } from "@/components/admin/contenido/new-post-button";
import { PostsTable } from "@/components/admin/contenido/posts-table";
import { SearchInput } from "@/components/admin/contenido/search-input";
import { StatusTabs } from "@/components/admin/contenido/status-tabs";
import { POSTS_SLUG, listEntries } from "@/lib/entries";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Contenido" };

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

export default async function ContenidoPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const ctx = await requireWorkspace();
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
    collectionSlug: POSTS_SLUG,
    status,
    q: q || undefined,
    limit: PER_PAGE,
    offset: (pageNum - 1) * PER_PAGE,
  });

  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contenido</p>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">
            Posts <span className="text-muted-foreground">· {counts.all}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Borradores, programados y publicados de tu blog. Búsqueda y bulk actions integradas.
          </p>
        </div>
        <form action={createNewPostFormAction}>
          <NewPostButton />
        </form>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <StatusTabs current={status} counts={counts} q={q || undefined} />
        <SearchInput initial={q} />
      </div>

      <PostsTable rows={rows} workspaceSlug={ctx.workspace.slug} />

      {totalPages > 1 ? (
        <Pagination total={total} page={pageNum} totalPages={totalPages} status={status} q={q} />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  status,
  q,
}: {
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
    return params.toString() ? `/admin/contenido?${params.toString()}` : "/admin/contenido";
  }

  return (
    <nav className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Página {page} de {totalPages} · {total} entradas
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a href={href(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
            Anterior
          </a>
        ) : null}
        {page < totalPages ? (
          <a href={href(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
            Siguiente
          </a>
        ) : null}
      </div>
    </nav>
  );
}
