import { CollectionsList } from "@/components/admin/collections/list";
import { NewCollectionDialog } from "@/components/admin/collections/new-dialog";
import { listCollections } from "@/lib/collections";
import { requireWorkspace } from "@/lib/workspace";
import { Layers, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Colecciones · techx" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; new?: string }>;
}) {
  const ctx = await requireWorkspace("editor");
  const sp = await searchParams;
  const collections = await listCollections(ctx.workspace.id);

  const errorMessage =
    sp.error === "slug"
      ? "El slug no es válido (solo minúsculas, números y guiones)."
      : sp.error === "reserved"
        ? "Ese slug está reservado."
        : sp.error === "create-failed"
          ? "No se pudo crear la colección."
          : sp.error
            ? "Hubo un error al procesar la solicitud."
            : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Layers className="size-3.5" /> Estructura
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Colecciones
          </h1>
          <p className="mt-2 max-w-prose text-sm text-foreground/70">
            Define las estructuras de contenido de tu workspace. Crea colecciones custom con campos
            arbitrarios o configura singletons (página única).
          </p>
        </div>
        <NewCollectionDialog
          trigger={
            <Link
              href="?new=1"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" /> Nueva colección
            </Link>
          }
          openInitial={sp.new === "1"}
        />
      </header>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <CollectionsList collections={collections} />
    </div>
  );
}
