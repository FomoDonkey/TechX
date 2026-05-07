import { CollectionBuilder } from "@/components/admin/collections/builder";
import { getCollectionById, getCollectionSchemaSafe } from "@/lib/collections";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Colección · techx" };
  const ctx = await requireWorkspace("editor");
  const c = await getCollectionById(ctx.workspace.id, id);
  return { title: c ? `${c.name} · Colecciones · techx` : "Colección · techx" };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireWorkspace("editor");
  const collection = await getCollectionById(ctx.workspace.id, id);
  if (!collection) notFound();

  const schema = getCollectionSchemaSafe(collection);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/colecciones"
            className="grid size-8 place-items-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {collection.isBuiltin ? "Builtin" : "Colección"}
            </div>
            <h1 className="font-display text-lg font-semibold leading-tight">{collection.name}</h1>
          </div>
          <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            /{collection.slug}
          </span>
          {collection.isSingleton ? (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
              singleton
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href={`/admin/contenido/c/${collection.slug}`}
            className="rounded-md border px-3 py-1.5 text-foreground/80 hover:bg-muted"
          >
            Ir al contenido →
          </Link>
        </div>
      </header>

      <CollectionBuilder
        collectionId={collection.id}
        initialSchema={schema}
        initialName={collection.name}
        initialIcon={collection.icon}
        initialDescription={collection.description}
        initialSingleton={collection.isSingleton}
        isBuiltin={collection.isBuiltin}
      />
    </div>
  );
}
